begin;

-- Phase 5: launch-useful retention. Favourites, verified-order ratings and
-- repeat COD orders use server ownership checks and current menu pricing.
create table public.customer_favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

create table public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) between 3 and 500),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_reviews_branch_idx
  on public.customer_reviews(branch_id, moderation_status, created_at desc);

alter table public.customer_favourites enable row level security;
alter table public.customer_reviews enable row level security;

create policy customer_favourites_own_select on public.customer_favourites
for select to authenticated using (user_id = auth.uid());
create policy customer_reviews_own_select on public.customer_reviews
for select to authenticated using (customer_id = auth.uid());
create policy customer_reviews_public_published_select on public.customer_reviews
for select to anon, authenticated using (moderation_status = 'published');

revoke all on public.customer_favourites, public.customer_reviews from anon, authenticated;
grant select on public.customer_favourites to authenticated;
grant select on public.customer_reviews to anon, authenticated;

create or replace function public.customer_list_favourites()
returns table (branch_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.branch_id from public.customer_favourites f
  join public.branches b on b.id = f.branch_id and b.active
  where f.user_id = auth.uid() order by f.created_at desc;
$$;

create or replace function public.customer_set_favourite(p_branch_id uuid, p_favourite boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.branches where id = p_branch_id and active)
    then raise exception 'Restaurant not found'; end if;
  if p_favourite then
    insert into public.customer_favourites(user_id, branch_id)
    values (auth.uid(), p_branch_id) on conflict do nothing;
  else
    delete from public.customer_favourites
    where user_id = auth.uid() and branch_id = p_branch_id;
  end if;
  return p_favourite;
end;
$$;

create or replace function public.marketplace_review_summary(p_city text default 'Lahore')
returns table (branch_id uuid, rating numeric, review_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.branch_id, round(avg(r.rating)::numeric, 1), count(*)
  from public.customer_reviews r
  join public.branches b on b.id = r.branch_id
  where b.active and b.city = p_city and r.moderation_status <> 'hidden'
  group by r.branch_id;
$$;

create or replace function public.customer_submit_review(
  p_order_id uuid, p_rating smallint, p_comment text default null
)
returns public.customer_reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders%rowtype; v_review public.customer_reviews%rowtype;
begin
  if p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if p_comment is not null and char_length(trim(p_comment)) not between 3 and 500
    then raise exception 'Review comment must be 3 to 500 characters'; end if;
  select * into v_order from public.orders
  where id = p_order_id and customer_id = auth.uid()
    and status in ('delivered', 'collected');
  if not found then raise exception 'Only completed orders can be reviewed'; end if;
  insert into public.customer_reviews(order_id, customer_id, branch_id, rating, comment, moderation_status)
  values (
    v_order.id, auth.uid(), v_order.branch_id, p_rating, nullif(trim(p_comment), ''),
    case when nullif(trim(p_comment), '') is null then 'published' else 'pending' end
  )
  on conflict (order_id) do update set
    rating = excluded.rating, comment = excluded.comment,
    moderation_status = case when excluded.comment is null then 'published' else 'pending' end,
    updated_at = now()
  where customer_reviews.customer_id = auth.uid()
  returning * into v_review;
  return v_review;
end;
$$;

create or replace function public.customer_list_own_reviews()
returns table (
  order_id uuid, rating smallint, comment text, moderation_status text, updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.order_id, r.rating, r.comment, r.moderation_status, r.updated_at
  from public.customer_reviews r where r.customer_id = auth.uid()
  order by r.updated_at desc;
$$;

create or replace function public.customer_repeat_cod_order(
  p_source_order_id uuid, p_idempotency_key uuid
)
returns table (order_id uuid, reference text, total_paisa bigint, status public.order_status)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_source public.orders%rowtype; v_items jsonb;
begin
  select * into v_source from public.orders
  where id = p_source_order_id and customer_id = auth.uid()
    and status in ('delivered', 'collected', 'cancelled', 'rejected', 'delivery_failed');
  if not found then raise exception 'Source order is not available to repeat'; end if;

  select jsonb_agg(jsonb_build_object(
    'menu_item_id', l.menu_item_id,
    'quantity', l.quantity,
    'option_ids', coalesce((select jsonb_agg(o.option_id order by o.option_id)
      from public.order_line_options o where o.order_line_id = l.id and o.option_id is not null), '[]'::jsonb)
  ) order by l.id) into v_items
  from public.order_lines l where l.order_id = v_source.id and l.menu_item_id is not null;

  if v_items is null or jsonb_array_length(v_items) = 0
    then raise exception 'The original menu items are no longer available'; end if;

  return query select * from public.create_cod_order(
    v_source.branch_id, v_source.address_id, v_source.fulfilment,
    v_items, v_source.customer_note, p_idempotency_key
  );
end;
$$;

revoke all on function public.customer_list_favourites() from public;
revoke all on function public.customer_set_favourite(uuid, boolean) from public;
revoke all on function public.marketplace_review_summary(text) from public;
revoke all on function public.customer_submit_review(uuid, smallint, text) from public;
revoke all on function public.customer_list_own_reviews() from public;
revoke all on function public.customer_repeat_cod_order(uuid, uuid) from public;

grant execute on function public.customer_list_favourites() to authenticated;
grant execute on function public.customer_set_favourite(uuid, boolean) to authenticated;
grant execute on function public.marketplace_review_summary(text) to anon, authenticated;
grant execute on function public.customer_submit_review(uuid, smallint, text) to authenticated;
grant execute on function public.customer_list_own_reviews() to authenticated;
grant execute on function public.customer_repeat_cod_order(uuid, uuid) to authenticated;

commit;
