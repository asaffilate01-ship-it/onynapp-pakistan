begin;

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'owner', 'manager', 'kitchen', 'cashier', 'rider', 'agent', 'support', 'finance', 'admin'
);
create type public.membership_status as enum ('invited', 'active', 'suspended');
create type public.fulfilment_type as enum ('delivery', 'collection');
create type public.order_status as enum (
  'placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered',
  'collected', 'rejected', 'cancelled', 'delivery_failed', 'refund_pending',
  'partially_refunded', 'refunded'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+923[0-9]{9}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, phone_e164)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'display_name', 100), ''), new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(legal_name) between 2 and 180),
  trading_name text not null check (char_length(trading_name) between 2 and 120),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'closed')),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  status public.membership_status not null default 'invited',
  created_at timestamptz not null default now(),
  unique (organisation_id, user_id, role)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  city text not null check (city in ('Lahore', 'Karachi', 'Islamabad', 'Rawalpindi')),
  address_text text not null check (char_length(address_text) between 5 and 300),
  landmark text check (char_length(landmark) <= 160),
  delivery_fee_paisa integer not null default 0 check (delivery_fee_paisa between 0 and 1000000),
  service_fee_paisa integer not null default 0 check (service_fee_paisa between 0 and 1000000),
  minimum_order_paisa integer not null default 0 check (minimum_order_paisa between 0 and 10000000),
  accepts_delivery boolean not null default true,
  accepts_collection boolean not null default true,
  accepting_orders boolean not null default false,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.service_zones (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  zone_name text not null check (char_length(zone_name) between 2 and 120),
  city text not null,
  postal_prefixes text[] not null default '{}',
  landmarks text[] not null default '{}',
  active boolean not null default true,
  unique (branch_id, zone_name)
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  sort_order integer not null default 0,
  active boolean not null default true
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 140),
  description text check (char_length(description) <= 600),
  price_paisa integer not null check (price_paisa between 0 and 100000000),
  available boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text check (char_length(label) <= 50),
  city text not null,
  address_line text not null check (char_length(address_line) between 5 and 240),
  landmark text not null check (char_length(landmark) between 2 and 160),
  delivery_note text check (char_length(delivery_note) <= 300),
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null references auth.users(id),
  branch_id uuid not null references public.branches(id),
  address_id uuid references public.addresses(id),
  fulfilment public.fulfilment_type not null,
  status public.order_status not null default 'placed',
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  currency text not null default 'PKR' check (currency = 'PKR'),
  subtotal_paisa bigint not null check (subtotal_paisa >= 0),
  delivery_fee_paisa bigint not null check (delivery_fee_paisa >= 0),
  service_fee_paisa bigint not null check (service_fee_paisa >= 0),
  total_paisa bigint not null check (total_paisa >= 0),
  customer_note text check (char_length(customer_note) <= 300),
  idempotency_key uuid not null,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  check ((fulfilment = 'delivery' and address_id is not null) or fulfilment = 'collection'),
  check (total_paisa = subtotal_paisa + delivery_fee_paisa + service_fee_paisa)
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id),
  item_name text not null,
  unit_price_paisa bigint not null check (unit_price_paisa >= 0),
  quantity integer not null check (quantity between 1 and 20),
  line_total_paisa bigint not null check (line_total_paisa = unit_price_paisa * quantity),
  unique (order_id, menu_item_id)
);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references auth.users(id),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organisation_id uuid references public.organisations(id),
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index memberships_user_idx on public.memberships(user_id, status);
create index branches_org_idx on public.branches(organisation_id);
create index menu_items_branch_idx on public.menu_items(branch_id, active, available);
create index orders_customer_idx on public.orders(customer_id, placed_at desc);
create index orders_branch_status_idx on public.orders(branch_id, status, placed_at);
create index order_events_order_idx on public.order_events(order_id, created_at);
create index audit_events_org_idx on public.audit_events(organisation_id, created_at desc);

create or replace function public.is_org_member(
  target_organisation_id uuid, allowed_roles public.app_role[] default null
) returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
    where m.organisation_id = target_organisation_id and m.user_id = auth.uid()
      and m.status = 'active' and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create or replace function public.is_branch_member(
  target_branch_id uuid, allowed_roles public.app_role[] default null
) returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.branches b
    where b.id = target_branch_id and public.is_org_member(b.organisation_id, allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid, public.app_role[]) from public;
revoke all on function public.is_branch_member(uuid, public.app_role[]) from public;
grant execute on function public.is_org_member(uuid, public.app_role[]) to authenticated;
grant execute on function public.is_branch_member(uuid, public.app_role[]) to authenticated;

create or replace function public.create_cod_order(
  p_branch_id uuid, p_address_id uuid, p_fulfilment public.fulfilment_type,
  p_items jsonb, p_note text, p_idempotency_key uuid
) returns table (order_id uuid, reference text, total_paisa bigint, status public.order_status)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid := auth.uid();
  v_branch public.branches%rowtype;
  v_subtotal bigint;
  v_delivery_fee bigint;
  v_order_id uuid;
  v_reference text;
  v_existing public.orders%rowtype;
begin
  if v_customer_id is null then raise exception 'authentication required'; end if;
  if p_idempotency_key is null then raise exception 'idempotency key required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text || p_idempotency_key::text, 0));
  if p_note is not null and char_length(p_note) > 300 then raise exception 'note too long'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'order must contain 1 to 20 items';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(menu_item_id text, quantity integer)
    where x.quantity is null or x.quantity < 1 or x.quantity > 20
  ) or exists (
    select 1 from jsonb_to_recordset(p_items) as x(menu_item_id text, quantity integer)
    group by (x.menu_item_id)::uuid having sum(x.quantity) > 20
  ) then raise exception 'item quantity must be between 1 and 20'; end if;

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
  if p_fulfilment = 'delivery' and not v_branch.accepts_delivery then raise exception 'delivery unavailable'; end if;
  if p_fulfilment = 'collection' and not v_branch.accepts_collection then raise exception 'collection unavailable'; end if;
  if p_fulfilment = 'delivery' and not exists (
    select 1 from public.addresses where id = p_address_id and user_id = v_customer_id
  ) then raise exception 'delivery address not found'; end if;

  with requested as (
    select (x.menu_item_id)::uuid menu_item_id, sum(x.quantity)::integer quantity
    from jsonb_to_recordset(p_items) as x(menu_item_id text, quantity integer)
    group by (x.menu_item_id)::uuid
  ), priced as (
    select r.menu_item_id, r.quantity, m.price_paisa from requested r
    join public.menu_items m on m.id = r.menu_item_id
    where m.branch_id = p_branch_id and m.active and m.available and r.quantity between 1 and 20
  ) select sum(price_paisa::bigint * quantity) into v_subtotal from priced;

  if v_subtotal is null or (
    select count(distinct (x.menu_item_id)::uuid)
    from jsonb_to_recordset(p_items) as x(menu_item_id text, quantity integer)
  ) <> (
    select count(*) from public.menu_items m where m.branch_id = p_branch_id and m.active and m.available
    and m.id in (select (x.menu_item_id)::uuid from jsonb_to_recordset(p_items) as x(menu_item_id text, quantity integer))
  ) then raise exception 'one or more items are unavailable'; end if;
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

  insert into public.order_lines (order_id, menu_item_id, item_name, unit_price_paisa, quantity, line_total_paisa)
  select v_order_id, m.id, m.name, m.price_paisa, r.quantity, m.price_paisa::bigint * r.quantity
  from (
    select (x.menu_item_id)::uuid menu_item_id, sum(x.quantity)::integer quantity
    from jsonb_to_recordset(p_items) as x(menu_item_id text, quantity integer)
    group by (x.menu_item_id)::uuid
  ) r join public.menu_items m on m.id = r.menu_item_id and m.branch_id = p_branch_id;

  insert into public.order_events (order_id, to_status, actor_id) values (v_order_id, 'placed', v_customer_id);
  return query select o.id, o.reference, o.total_paisa, o.status from public.orders o where o.id = v_order_id;
end;
$$;

create or replace function public.vendor_transition_order(
  p_order_id uuid, p_expected public.order_status, p_next public.order_status, p_note text default null
) returns public.orders language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if not public.is_branch_member(v_order.branch_id, array['owner','manager','kitchen']::public.app_role[]) then
    raise exception 'not authorised';
  end if;
  if v_order.status <> p_expected then raise exception 'order status changed'; end if;
  if not ((p_expected = 'placed' and p_next in ('accepted','rejected'))
    or (p_expected = 'accepted' and p_next = 'preparing')
    or (p_expected = 'preparing' and p_next = 'ready')) then
    raise exception 'invalid vendor transition';
  end if;
  update public.orders set status = p_next, updated_at = now() where id = p_order_id returning * into v_order;
  insert into public.order_events (order_id, from_status, to_status, actor_id, note)
  values (p_order_id, p_expected, p_next, auth.uid(), nullif(trim(p_note), ''));
  return v_order;
end;
$$;

revoke all on function public.create_cod_order(uuid, uuid, public.fulfilment_type, jsonb, text, uuid) from public;
revoke all on function public.vendor_transition_order(uuid, public.order_status, public.order_status, text) from public;
grant execute on function public.create_cod_order(uuid, uuid, public.fulfilment_type, jsonb, text, uuid) to authenticated;
grant execute on function public.vendor_transition_order(uuid, public.order_status, public.order_status, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.memberships enable row level security;
alter table public.branches enable row level security;
alter table public.service_zones enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_events enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_own_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy organisations_member_select on public.organisations for select to authenticated using (public.is_org_member(id));
create policy memberships_self_or_manager_select on public.memberships for select to authenticated using (
  user_id = auth.uid() or public.is_org_member(organisation_id, array['owner','manager','admin']::public.app_role[])
);
create policy branches_public_active_select on public.branches for select to anon, authenticated using (active);
create policy branches_staff_select on public.branches for select to authenticated using (public.is_org_member(organisation_id));
create policy zones_public_active_select on public.service_zones for select to anon, authenticated using (active);
create policy categories_public_active_select on public.menu_categories for select to anon, authenticated using (active);
create policy menu_public_active_select on public.menu_items for select to anon, authenticated using (active);
create policy addresses_own_all on public.addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy orders_customer_or_branch_select on public.orders for select to authenticated using (
  customer_id = auth.uid() or public.is_branch_member(branch_id)
);
create policy order_lines_authorised_select on public.order_lines for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_branch_member(o.branch_id)))
);
create policy order_events_authorised_select on public.order_events for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_branch_member(o.branch_id)))
);
create policy audit_org_admin_select on public.audit_events for select to authenticated using (
  public.is_org_member(organisation_id, array['owner','admin']::public.app_role[])
);

revoke all on table public.profiles, public.organisations, public.memberships, public.branches,
  public.service_zones, public.menu_categories, public.menu_items, public.addresses, public.orders,
  public.order_lines, public.order_events, public.audit_events from anon, authenticated;
grant select on public.branches, public.service_zones, public.menu_categories, public.menu_items to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.organisations, public.memberships, public.orders, public.order_lines,
  public.order_events, public.audit_events to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;

commit;
