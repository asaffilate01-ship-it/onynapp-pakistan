begin;

-- Customer support records make cancellation escalation auditable instead of
-- silently mutating orders that a restaurant has already started preparing.
create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  category text not null check (category in ('cancellation_request', 'order_issue', 'payment_issue', 'other')),
  description text not null check (char_length(description) between 5 and 1000),
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_cases_customer_created_idx
  on public.support_cases(customer_id, created_at desc);
create index if not exists support_cases_order_idx
  on public.support_cases(order_id);

alter table public.support_cases enable row level security;

drop policy if exists "Customers can read own support cases" on public.support_cases;
create policy "Customers can read own support cases"
  on public.support_cases for select
  to authenticated
  using (customer_id = auth.uid());

drop policy if exists "Authorised support staff can read support cases" on public.support_cases;
create policy "Authorised support staff can read support cases"
  on public.support_cases for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      join public.branches b on b.id = o.branch_id
      join public.memberships m on m.organisation_id = b.organisation_id
      where o.id = support_cases.order_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'manager', 'support', 'admin')
    )
  );

revoke all on public.support_cases from anon, authenticated;
grant select on public.support_cases to authenticated;

-- Do not expose records belonging to inactive branches through otherwise
-- public catalog policies. Staff-specific policies remain permissive for their
-- own branch where Phase 3B requires operational access.
drop policy if exists zones_public_active_select on public.service_zones;
create policy zones_public_active_select
  on public.service_zones for select to anon, authenticated
  using (
    active and exists (
      select 1 from public.branches b where b.id = service_zones.branch_id and b.active
    )
  );

drop policy if exists categories_public_active_select on public.menu_categories;
create policy categories_public_active_select
  on public.menu_categories for select to anon, authenticated
  using (
    active and exists (
      select 1 from public.branches b where b.id = menu_categories.branch_id and b.active
    )
  );

drop policy if exists menu_public_active_select on public.menu_items;
create policy menu_public_active_select
  on public.menu_items for select to anon, authenticated
  using (
    active and exists (
      select 1 from public.branches b where b.id = menu_items.branch_id and b.active
    )
  );

-- Delivery orders must use a customer-owned address whose saved area matches
-- an active zone for the selected branch. This trigger protects every insert,
-- including future order creation paths, rather than relying on the browser.
create or replace function public.enforce_order_serviceability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.fulfilment = 'delivery' then
    if new.address_id is null then
      raise exception 'A delivery address is required';
    end if;

    if not exists (
      select 1
      from public.addresses a
      join public.branches b on b.id = new.branch_id
      join public.service_zones z
        on z.branch_id = b.id
       and z.active = true
       and lower(trim(z.zone_name)) = lower(trim(split_part(a.label, ',', 1)))
      where a.id = new.address_id
        and a.user_id = new.customer_id
        and lower(trim(a.city)) = lower(trim(b.city))
        and b.active = true
        and b.accepting_orders = true
    ) then
      raise exception 'This address is outside the selected branch service area';
    end if;
  elsif new.address_id is not null then
    raise exception 'Collection orders must not include a delivery address';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_order_serviceability on public.orders;
create trigger enforce_order_serviceability
  before insert or update of branch_id, address_id, fulfilment
  on public.orders
  for each row execute function public.enforce_order_serviceability();

revoke all on function public.enforce_order_serviceability() from public;

-- Save or reuse a delivery address only when the area is currently served by
-- at least one active Lahore pilot branch. The order trigger performs the final
-- branch-specific check at placement time.
create or replace function public.customer_save_pilot_address(
  p_label text,
  p_city text,
  p_address_line text,
  p_landmark text,
  p_delivery_note text default null
)
returns public.addresses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_address public.addresses;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(coalesce(p_address_line, ''))) < 5 then
    raise exception 'A complete street address is required';
  end if;
  if char_length(trim(coalesce(p_landmark, ''))) < 3 then
    raise exception 'A nearby landmark is required';
  end if;
  if lower(trim(coalesce(p_city, ''))) <> 'lahore' then
    raise exception 'The current pilot is available in Lahore only';
  end if;
  if not exists (
    select 1
    from public.service_zones z
    join public.branches b on b.id = z.branch_id
    where z.active = true
      and b.active = true
      and b.accepting_orders = true
      and lower(trim(b.city)) = 'lahore'
      and lower(trim(z.zone_name)) = lower(trim(split_part(coalesce(p_label, ''), ',', 1)))
  ) then
    raise exception 'This delivery area is not currently served';
  end if;

  select a.* into v_address
  from public.addresses a
  where a.user_id = v_user_id
    and lower(trim(a.label)) = lower(trim(p_label))
    and lower(trim(a.city)) = 'lahore'
    and lower(trim(a.address_line)) = lower(trim(p_address_line))
    and lower(trim(a.landmark)) = lower(trim(p_landmark))
  order by a.created_at desc
  limit 1;

  if found then
    update public.addresses
      set delivery_note = nullif(trim(p_delivery_note), '')
      where id = v_address.id
      returning * into v_address;
    return v_address;
  end if;

  insert into public.addresses (
    user_id, label, city, address_line, landmark, delivery_note
  ) values (
    v_user_id,
    trim(p_label),
    'Lahore',
    trim(p_address_line),
    trim(p_landmark),
    nullif(trim(p_delivery_note), '')
  ) returning * into v_address;

  return v_address;
end;
$$;

-- A single protected snapshot prevents the client from having to assemble
-- order, line and event tables with error-prone joins.
create or replace function public.customer_list_orders()
returns table (
  id uuid,
  reference text,
  branch_id uuid,
  branch_name text,
  status public.order_status,
  fulfilment public.fulfilment_type,
  payment_method text,
  subtotal_paisa integer,
  delivery_fee_paisa integer,
  service_fee_paisa integer,
  total_paisa integer,
  customer_note text,
  placed_at timestamptz,
  order_lines jsonb,
  order_events jsonb,
  open_support_case_id uuid
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    o.id,
    o.reference,
    o.branch_id,
    b.name,
    o.status,
    o.fulfilment,
    o.payment_method,
    o.subtotal_paisa,
    o.delivery_fee_paisa,
    o.service_fee_paisa,
    o.total_paisa,
    o.customer_note,
    o.placed_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ol.id,
          'name', ol.item_name,
          'unit_price_paisa', ol.unit_price_paisa,
          'quantity', ol.quantity,
          'line_total_paisa', ol.line_total_paisa
        ) order by ol.created_at
      )
      from public.order_lines ol
      where ol.order_id = o.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', oe.to_status,
          'note', oe.note,
          'created_at', oe.created_at
        ) order by oe.created_at
      )
      from public.order_events oe
      where oe.order_id = o.id
    ), '[]'::jsonb),
    (
      select sc.id
      from public.support_cases sc
      where sc.order_id = o.id
        and sc.customer_id = auth.uid()
        and sc.status in ('new', 'in_review')
      order by sc.created_at desc
      limit 1
    )
  from public.orders o
  join public.branches b on b.id = o.branch_id
  where o.customer_id = auth.uid()
  order by o.placed_at desc
  limit 50;
$$;

-- Placed orders can be cancelled immediately. Once a restaurant has accepted
-- the order, create a support case for human review and preserve the audit trail.
create or replace function public.customer_request_cancellation(
  p_order_id uuid,
  p_reason text
)
returns table (outcome text, order_status public.order_status, support_case_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
  v_case_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Please provide a cancellation reason';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and customer_id = v_user_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status = 'placed' then
    update public.orders set status = 'cancelled', updated_at = now() where id = v_order.id;
    insert into public.order_events (order_id, from_status, to_status, note, actor_id)
    values (v_order.id, 'placed', 'cancelled', trim(p_reason), v_user_id);
    return query select 'cancelled'::text, 'cancelled'::public.order_status, null::uuid;
    return;
  end if;

  if v_order.status in ('accepted', 'preparing', 'ready') then
    select sc.id into v_case_id
    from public.support_cases sc
    where sc.order_id = v_order.id
      and sc.customer_id = v_user_id
      and sc.category = 'cancellation_request'
      and sc.status in ('new', 'in_review')
    limit 1;

    if v_case_id is null then
      insert into public.support_cases (customer_id, order_id, category, description)
      values (v_user_id, v_order.id, 'cancellation_request', trim(p_reason))
      returning id into v_case_id;
    end if;

    return query select 'review_requested'::text, v_order.status, v_case_id;
    return;
  end if;

  return query select 'not_allowed'::text, v_order.status, null::uuid;
end;
$$;

revoke all on function public.customer_save_pilot_address(text, text, text, text, text) from public;
revoke all on function public.customer_list_orders() from public;
revoke all on function public.customer_request_cancellation(uuid, text) from public;
grant execute on function public.customer_save_pilot_address(text, text, text, text, text) to authenticated;
grant execute on function public.customer_list_orders() to authenticated;
grant execute on function public.customer_request_cancellation(uuid, text) to authenticated;

commit;
