begin;

-- Pakistan pilot opening hours and temporary closure windows.
create table public.branch_hours (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, weekday),
  check (closed or opens_at <> closes_at)
);

create table public.branch_closures (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (char_length(reason) between 3 and 160),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index branch_closures_active_idx
  on public.branch_closures(branch_id, starts_at, ends_at);

-- Modifier groups are intentionally item-scoped for the COD pilot. They can be
-- promoted to reusable menu templates after real vendor usage is understood.
create table public.menu_option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  required boolean not null default false,
  min_selections smallint not null default 0 check (min_selections between 0 and 20),
  max_selections smallint not null default 1 check (max_selections between 1 and 20),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_selections <= max_selections),
  check (not required or min_selections >= 1),
  unique (menu_item_id, name)
);

create table public.menu_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_option_groups(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  price_delta_paisa integer not null default 0 check (price_delta_paisa between -10000000 and 10000000),
  available boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, name)
);

alter table public.order_lines
  add column selection_signature text not null default '';
alter table public.order_lines
  drop constraint if exists order_lines_order_id_menu_item_id_key;
alter table public.order_lines
  add constraint order_lines_order_item_selection_key
  unique (order_id, menu_item_id, selection_signature);

create table public.order_line_options (
  id uuid primary key default gen_random_uuid(),
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  option_id uuid references public.menu_options(id) on delete set null,
  group_name text not null,
  option_name text not null,
  price_delta_paisa bigint not null,
  created_at timestamptz not null default now(),
  unique (order_line_id, option_id)
);

-- In-app notifications are customer-readable. The outbox is server-only and
-- can be drained by a signed Edge Function into the approved Pakistan SMS/push
-- provider with retries and monitoring.
create table public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  order_event_id bigint unique references public.order_events(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index customer_notifications_user_created_idx
  on public.customer_notifications(user_id, created_at desc);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  order_event_id bigint references public.order_events(id) on delete cascade,
  channel text not null check (channel in ('sms', 'push')),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'dead_letter')),
  attempts integer not null default 0 check (attempts between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (order_event_id, channel)
);

create index notification_outbox_pending_idx
  on public.notification_outbox(status, next_attempt_at)
  where status in ('pending', 'failed');

alter table public.branch_hours enable row level security;
alter table public.branch_closures enable row level security;
alter table public.menu_option_groups enable row level security;
alter table public.menu_options enable row level security;
alter table public.order_line_options enable row level security;
alter table public.customer_notifications enable row level security;
alter table public.notification_outbox enable row level security;

create policy branch_hours_public_active_select on public.branch_hours
for select to anon, authenticated
using (exists (select 1 from public.branches b where b.id = branch_id and b.active));

create policy branch_closures_staff_select on public.branch_closures
for select to authenticated
using (public.is_branch_member(branch_id));

create policy option_groups_public_active_select on public.menu_option_groups
for select to anon, authenticated
using (
  active and exists (
    select 1 from public.menu_items mi
    join public.branches b on b.id = mi.branch_id
    where mi.id = menu_item_id and mi.active and b.active
  )
);

create policy menu_options_public_active_select on public.menu_options
for select to anon, authenticated
using (
  active and exists (
    select 1 from public.menu_option_groups g
    join public.menu_items mi on mi.id = g.menu_item_id
    join public.branches b on b.id = mi.branch_id
    where g.id = group_id and g.active and mi.active and b.active
  )
);

create policy order_line_options_authorised_select on public.order_line_options
for select to authenticated
using (
  exists (
    select 1 from public.order_lines ol
    join public.orders o on o.id = ol.order_id
    where ol.id = order_line_id
      and (o.customer_id = auth.uid() or public.is_branch_member(o.branch_id))
  )
);

create policy customer_notifications_own_select on public.customer_notifications
for select to authenticated using (user_id = auth.uid());

revoke all on public.branch_hours, public.branch_closures, public.menu_option_groups,
  public.menu_options, public.order_line_options, public.customer_notifications,
  public.notification_outbox from anon, authenticated;
grant select on public.branch_hours, public.menu_option_groups, public.menu_options to anon, authenticated;
grant select on public.branch_closures, public.order_line_options to authenticated;
grant select on public.customer_notifications to authenticated;

create or replace function public.branch_is_open(
  p_branch_id uuid,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_day smallint := extract(dow from (p_at at time zone 'Asia/Karachi'))::smallint;
  v_time time := (p_at at time zone 'Asia/Karachi')::time;
begin
  if exists (
    select 1 from public.branch_closures c
    where c.branch_id = p_branch_id and p_at >= c.starts_at and p_at < c.ends_at
  ) then return false; end if;

  return exists (
    select 1 from public.branch_hours h
    where h.branch_id = p_branch_id
      and h.weekday = v_day
      and not h.closed
      and (
        (h.opens_at < h.closes_at and v_time >= h.opens_at and v_time < h.closes_at)
        or (h.opens_at > h.closes_at and v_time >= h.opens_at)
      )
  ) or exists (
    select 1 from public.branch_hours h
    where h.branch_id = p_branch_id
      and h.weekday = ((v_day + 6) % 7)
      and not h.closed
      and h.opens_at > h.closes_at
      and v_time < h.closes_at
  );
end;
$$;

create or replace function public.customer_mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.customer_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = auth.uid();

  if not found then
    raise exception 'Notification not found';
  end if;
end;
$$;

revoke all on function public.customer_mark_notification_read(uuid) from public;
grant execute on function public.customer_mark_notification_read(uuid) to authenticated;

revoke all on function public.branch_is_open(uuid, timestamptz) from public;
grant execute on function public.branch_is_open(uuid, timestamptz) to anon, authenticated;

-- One catalog snapshot avoids inconsistent branch/menu/option reads and only
-- returns public fields from active Lahore branches.
create or replace function public.marketplace_catalog(p_city text default 'Lahore')
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with selected_branches as (
    select b.* from public.branches b
    where b.active and b.city = p_city
  )
  select jsonb_build_object(
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'city', b.city,
        'address_text', b.address_text,
        'delivery_fee_paisa', b.delivery_fee_paisa,
        'service_fee_paisa', b.service_fee_paisa,
        'minimum_order_paisa', b.minimum_order_paisa,
        'accepts_delivery', b.accepts_delivery,
        'accepts_collection', b.accepts_collection,
        'accepting_orders', b.accepting_orders,
        'default_prep_minutes', b.default_prep_minutes,
        'busy_mode', b.busy_mode,
        'schedule_configured', (select count(*) = 7 from public.branch_hours h where h.branch_id = b.id),
        'is_open', public.branch_is_open(b.id)
      ) order by b.name) from selected_branches b
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'branch_id', c.branch_id, 'name', c.name
      ) order by c.branch_id, c.sort_order, c.name)
      from public.menu_categories c
      where c.active and c.branch_id in (select id from selected_branches)
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'branch_id', m.branch_id, 'category_id', m.category_id,
        'name', m.name, 'description', m.description,
        'price_paisa', m.price_paisa, 'available', m.available
      ) order by m.branch_id, m.name)
      from public.menu_items m
      where m.active and m.branch_id in (select id from selected_branches)
    ), '[]'::jsonb),
    'option_groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'menu_item_id', g.menu_item_id, 'name', g.name,
        'required', g.required, 'min_selections', g.min_selections,
        'max_selections', g.max_selections
      ) order by g.menu_item_id, g.sort_order, g.name)
      from public.menu_option_groups g
      join public.menu_items m on m.id = g.menu_item_id
      where g.active and m.active and m.branch_id in (select id from selected_branches)
    ), '[]'::jsonb),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'group_id', o.group_id, 'name', o.name,
        'price_delta_paisa', o.price_delta_paisa, 'available', o.available
      ) order by o.group_id, o.sort_order, o.name)
      from public.menu_options o
      join public.menu_option_groups g on g.id = o.group_id
      join public.menu_items m on m.id = g.menu_item_id
      where o.active and g.active and m.active
        and m.branch_id in (select id from selected_branches)
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.marketplace_catalog(text) from public;
grant execute on function public.marketplace_catalog(text) to anon, authenticated;

-- Replace Phase 3C order creation so required options and their price deltas
-- are validated and priced entirely in Postgres.
create or replace function public.create_cod_order(
  p_branch_id uuid, p_address_id uuid, p_fulfilment public.fulfilment_type,
  p_items jsonb, p_note text, p_idempotency_key uuid
) returns table (order_id uuid, reference text, total_paisa bigint, status public.order_status)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid := auth.uid();
  v_branch public.branches%rowtype;
  v_subtotal bigint := 0;
  v_delivery_fee bigint;
  v_order_id uuid;
  v_reference text;
  v_existing public.orders%rowtype;
  v_request jsonb;
  v_menu public.menu_items%rowtype;
  v_quantity integer;
  v_option_ids uuid[];
  v_option_total bigint;
  v_line_total bigint;
  v_line_id uuid;
  v_signature text;
  v_group record;
  v_selected integer;
begin
  if v_customer_id is null then raise exception 'authentication required'; end if;
  if p_idempotency_key is null then raise exception 'idempotency key required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text || p_idempotency_key::text, 0));
  if p_note is not null and char_length(p_note) > 300 then raise exception 'note too long'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'order must contain 1 to 20 lines';
  end if;

  select * into v_existing from public.orders
  where customer_id = v_customer_id and idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.reference, v_existing.total_paisa, v_existing.status;
    return;
  end if;

  select * into v_branch from public.branches where id = p_branch_id for share;
  if not found or not v_branch.active or not v_branch.accepting_orders then
    raise exception 'branch is not accepting orders';
  end if;
  if not public.branch_is_open(p_branch_id) then raise exception 'branch is currently closed'; end if;
  if p_fulfilment = 'delivery' and not v_branch.accepts_delivery then raise exception 'delivery unavailable'; end if;
  if p_fulfilment = 'collection' and not v_branch.accepts_collection then raise exception 'collection unavailable'; end if;
  if p_fulfilment = 'delivery' and not exists (
    select 1 from public.addresses where id = p_address_id and user_id = v_customer_id
  ) then raise exception 'delivery address not found'; end if;

  for v_request in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_request ->> 'quantity')::integer;
    if v_quantity < 1 or v_quantity > 20 then raise exception 'item quantity must be between 1 and 20'; end if;
    select * into v_menu from public.menu_items
    where id = (v_request ->> 'menu_item_id')::uuid
      and branch_id = p_branch_id and active and available;
    if not found then raise exception 'one or more items are unavailable'; end if;

    select coalesce(array_agg(x.option_id order by x.option_id), '{}'::uuid[])
      into v_option_ids
    from (
      select distinct value::text::uuid as option_id
      from jsonb_array_elements_text(coalesce(v_request -> 'option_ids', '[]'::jsonb))
    ) x;

    if cardinality(v_option_ids) <> jsonb_array_length(coalesce(v_request -> 'option_ids', '[]'::jsonb)) then
      raise exception 'duplicate options are not allowed';
    end if;
    if exists (
      select 1 from unnest(v_option_ids) selected_id
      where not exists (
        select 1 from public.menu_options o
        join public.menu_option_groups g on g.id = o.group_id
        where o.id = selected_id and o.active and o.available
          and g.active and g.menu_item_id = v_menu.id
      )
    ) then raise exception 'one or more options are unavailable'; end if;

    for v_group in
      select * from public.menu_option_groups
      where menu_item_id = v_menu.id and active
    loop
      select count(*) into v_selected from public.menu_options o
      where o.group_id = v_group.id and o.id = any(v_option_ids);
      if v_selected < v_group.min_selections or v_selected > v_group.max_selections then
        raise exception 'option selection is invalid for %', v_group.name;
      end if;
    end loop;

    select coalesce(sum(o.price_delta_paisa), 0) into v_option_total
    from public.menu_options o where o.id = any(v_option_ids);
    if v_menu.price_paisa + v_option_total < 0 then raise exception 'invalid option price'; end if;
    v_subtotal := v_subtotal + (v_menu.price_paisa + v_option_total) * v_quantity;
  end loop;

  if v_subtotal < v_branch.minimum_order_paisa then raise exception 'minimum order not met'; end if;
  v_delivery_fee := case when p_fulfilment = 'delivery' then v_branch.delivery_fee_paisa else 0 end;
  v_reference := 'ON-' || to_char(clock_timestamp(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (
    reference, customer_id, branch_id, address_id, fulfilment, subtotal_paisa,
    delivery_fee_paisa, service_fee_paisa, total_paisa, customer_note, idempotency_key
  ) values (
    v_reference, v_customer_id, p_branch_id,
    case when p_fulfilment = 'delivery' then p_address_id else null end,
    p_fulfilment, v_subtotal, v_delivery_fee, v_branch.service_fee_paisa,
    v_subtotal + v_delivery_fee + v_branch.service_fee_paisa, nullif(trim(p_note), ''), p_idempotency_key
  ) returning id into v_order_id;

  for v_request in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_request ->> 'quantity')::integer;
    select * into v_menu from public.menu_items where id = (v_request ->> 'menu_item_id')::uuid;
    select coalesce(array_agg(x.option_id order by x.option_id), '{}'::uuid[])
      into v_option_ids
    from (
      select distinct value::text::uuid as option_id
      from jsonb_array_elements_text(coalesce(v_request -> 'option_ids', '[]'::jsonb))
    ) x;
    select coalesce(sum(o.price_delta_paisa), 0) into v_option_total
      from public.menu_options o where o.id = any(v_option_ids);
    v_line_total := (v_menu.price_paisa + v_option_total) * v_quantity;
    v_signature := md5(array_to_string(v_option_ids, ','));

    insert into public.order_lines (
      order_id, menu_item_id, item_name, unit_price_paisa, quantity,
      line_total_paisa, selection_signature
    ) values (
      v_order_id, v_menu.id, v_menu.name, v_menu.price_paisa + v_option_total,
      v_quantity, v_line_total, v_signature
    ) returning id into v_line_id;

    insert into public.order_line_options (
      order_line_id, option_id, group_name, option_name, price_delta_paisa
    )
    select v_line_id, o.id, g.name, o.name, o.price_delta_paisa
    from public.menu_options o
    join public.menu_option_groups g on g.id = o.group_id
    where o.id = any(v_option_ids)
    order by g.sort_order, o.sort_order;
  end loop;

  insert into public.order_events (order_id, to_status, actor_id) values (v_order_id, 'placed', v_customer_id);
  return query select o.id, o.reference, o.total_paisa, o.status from public.orders o where o.id = v_order_id;
end;
$$;

-- Preserve the existing RPC signature while enriching each line with its
-- immutable option snapshot.
create or replace function public.customer_list_orders()
returns table (
  id uuid, reference text, branch_id uuid, branch_name text,
  status public.order_status, fulfilment public.fulfilment_type,
  payment_method text, subtotal_paisa integer, delivery_fee_paisa integer,
  service_fee_paisa integer, total_paisa integer, customer_note text,
  placed_at timestamptz, order_lines jsonb, order_events jsonb,
  open_support_case_id uuid
)
language sql security definer set search_path = public, pg_temp stable
as $$
  select o.id, o.reference, o.branch_id, b.name, o.status, o.fulfilment,
    o.payment_method, o.subtotal_paisa::integer, o.delivery_fee_paisa::integer,
    o.service_fee_paisa::integer, o.total_paisa::integer, o.customer_note, o.placed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ol.id, 'name', ol.item_name, 'unit_price_paisa', ol.unit_price_paisa,
        'quantity', ol.quantity, 'line_total_paisa', ol.line_total_paisa,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'group_name', olo.group_name, 'option_name', olo.option_name,
            'price_delta_paisa', olo.price_delta_paisa
          ) order by olo.created_at)
          from public.order_line_options olo where olo.order_line_id = ol.id
        ), '[]'::jsonb)
      ) order by ol.id) from public.order_lines ol where ol.order_id = o.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', oe.to_status, 'note', oe.note, 'created_at', oe.created_at
      ) order by oe.created_at) from public.order_events oe where oe.order_id = o.id
    ), '[]'::jsonb),
    (select sc.id from public.support_cases sc where sc.order_id = o.id
      and sc.customer_id = auth.uid() and sc.status in ('new', 'in_review')
      order by sc.created_at desc limit 1)
  from public.orders o join public.branches b on b.id = o.branch_id
  where o.customer_id = auth.uid() order by o.placed_at desc limit 50;
$$;

create or replace function public.vendor_list_active_orders(p_branch_id uuid)
returns table (
  id uuid, reference text, status public.order_status,
  fulfilment public.fulfilment_type, payment_method text, total_paisa bigint,
  customer_note text, placed_at timestamptz, address_text text, landmark text,
  delivery_note text, order_lines jsonb
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_branch_member(p_branch_id, array['owner', 'manager', 'kitchen']::public.app_role[])
    then raise exception 'not authorised'; end if;
  return query
  select o.id, o.reference, o.status, o.fulfilment, o.payment_method,
    o.total_paisa, o.customer_note, o.placed_at, a.address_line, a.landmark,
    a.delivery_note,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.item_name, 'quantity', l.quantity,
        'unit_price_paisa', l.unit_price_paisa,
        'options', coalesce((select jsonb_agg(olo.option_name order by olo.created_at)
          from public.order_line_options olo where olo.order_line_id = l.id), '[]'::jsonb)
      ) order by l.id) from public.order_lines l where l.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o left join public.addresses a on a.id = o.address_id
  where o.branch_id = p_branch_id and o.status in ('placed', 'accepted', 'preparing', 'ready')
  order by o.placed_at;
end;
$$;

create or replace function public.vendor_branch_schedule(p_branch_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_branch_member(p_branch_id, array['owner', 'manager']::public.app_role[])
    then raise exception 'not authorised'; end if;
  return jsonb_build_object(
    'is_open', public.branch_is_open(p_branch_id),
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
      'weekday', h.weekday, 'opens_at', h.opens_at, 'closes_at', h.closes_at,
      'closed', h.closed) order by h.weekday)
      from public.branch_hours h where h.branch_id = p_branch_id), '[]'::jsonb),
    'active_closure', (select jsonb_build_object(
      'id', c.id, 'starts_at', c.starts_at, 'ends_at', c.ends_at, 'reason', c.reason)
      from public.branch_closures c where c.branch_id = p_branch_id
        and now() >= c.starts_at and now() < c.ends_at order by c.ends_at desc limit 1)
  );
end;
$$;

create or replace function public.vendor_set_weekly_hours(p_branch_id uuid, p_hours jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_branch_member(p_branch_id, array['owner', 'manager']::public.app_role[])
    then raise exception 'not authorised'; end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) <> 7
    then raise exception 'all seven days are required'; end if;
  if (select count(distinct (x ->> 'weekday')::integer) from jsonb_array_elements(p_hours) x) <> 7
    then raise exception 'each weekday must appear once'; end if;

  delete from public.branch_hours where branch_id = p_branch_id;
  insert into public.branch_hours (branch_id, weekday, opens_at, closes_at, closed)
  select p_branch_id, (x ->> 'weekday')::smallint, (x ->> 'opens_at')::time,
    (x ->> 'closes_at')::time, coalesce((x ->> 'closed')::boolean, false)
  from jsonb_array_elements(p_hours) x;
  return public.vendor_branch_schedule(p_branch_id);
end;
$$;

create or replace function public.vendor_set_temporary_closure(
  p_branch_id uuid, p_ends_at timestamptz default null, p_reason text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_branch_member(p_branch_id, array['owner', 'manager']::public.app_role[])
    then raise exception 'not authorised'; end if;
  delete from public.branch_closures where branch_id = p_branch_id and ends_at > now();
  if p_ends_at is not null then
    if p_ends_at <= now() or p_ends_at > now() + interval '30 days'
      then raise exception 'closure end must be within 30 days'; end if;
    if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'closure reason required'; end if;
    insert into public.branch_closures(branch_id, starts_at, ends_at, reason, created_by)
    values (p_branch_id, now(), p_ends_at, trim(p_reason), auth.uid());
  end if;
  return public.vendor_branch_schedule(p_branch_id);
end;
$$;

create or replace function public.vendor_set_menu_option_availability(
  p_option_id uuid,
  p_available boolean
)
returns public.menu_options
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_option public.menu_options%rowtype;
  v_branch_id uuid;
  v_org_id uuid;
begin
  select o.* into v_option from public.menu_options o where o.id = p_option_id for update;
  if not found then raise exception 'menu option not found'; end if;
  select mi.branch_id, b.organisation_id into v_branch_id, v_org_id
  from public.menu_option_groups g
  join public.menu_items mi on mi.id = g.menu_item_id
  join public.branches b on b.id = mi.branch_id
  where g.id = v_option.group_id;
  if not public.is_branch_member(v_branch_id, array['owner', 'manager', 'kitchen']::public.app_role[])
    then raise exception 'not authorised'; end if;
  update public.menu_options set available = p_available, updated_at = now()
    where id = p_option_id returning * into v_option;
  insert into public.audit_events(organisation_id, actor_id, action, target_type, target_id, metadata)
  values (v_org_id, auth.uid(), 'menu_option.availability_updated', 'menu_option', p_option_id,
    jsonb_build_object('available', p_available));
  return v_option;
end;
$$;

create or replace function public.queue_customer_order_notification()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_title text;
  v_body text;
begin
  if new.to_status not in ('placed', 'accepted', 'preparing', 'ready', 'picked_up',
    'delivered', 'collected', 'rejected', 'cancelled', 'delivery_failed') then return new; end if;
  select * into v_order from public.orders where id = new.order_id;
  v_title := case new.to_status
    when 'placed' then 'Order received'
    when 'accepted' then 'Restaurant accepted your order'
    when 'preparing' then 'Your food is being prepared'
    when 'ready' then 'Your order is ready'
    when 'picked_up' then 'Your order is on the way'
    when 'delivered' then 'Order delivered'
    when 'collected' then 'Order collected'
    when 'rejected' then 'Restaurant could not accept the order'
    when 'cancelled' then 'Order cancelled'
    else 'Order update'
  end;
  v_body := v_title || ' · ' || v_order.reference;
  insert into public.customer_notifications(user_id, order_id, order_event_id, title, body)
  values (v_order.customer_id, v_order.id, new.id, v_title, v_body)
  on conflict (order_event_id) do nothing;
  insert into public.notification_outbox(user_id, order_id, order_event_id, channel, event_type, payload)
  values (v_order.customer_id, v_order.id, new.id, 'sms', new.to_status::text,
    jsonb_build_object('reference', v_order.reference, 'title', v_title))
  on conflict (order_event_id, channel) do nothing;
  return new;
end;
$$;

create trigger queue_customer_order_notification
after insert on public.order_events
for each row execute function public.queue_customer_order_notification();

revoke all on function public.vendor_branch_schedule(uuid) from public;
revoke all on function public.vendor_set_weekly_hours(uuid, jsonb) from public;
revoke all on function public.vendor_set_temporary_closure(uuid, timestamptz, text) from public;
revoke all on function public.vendor_set_menu_option_availability(uuid, boolean) from public;
revoke all on function public.queue_customer_order_notification() from public;
grant execute on function public.vendor_branch_schedule(uuid) to authenticated;
grant execute on function public.vendor_set_weekly_hours(uuid, jsonb) to authenticated;
grant execute on function public.vendor_set_temporary_closure(uuid, timestamptz, text) to authenticated;
grant execute on function public.vendor_set_menu_option_availability(uuid, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'customer_notifications') then
    alter publication supabase_realtime add table public.customer_notifications;
  end if;
end;
$$;

commit;
