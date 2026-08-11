begin;

-- Suspension must take effect immediately across every policy and RPC that
-- relies on the shared membership helpers.
create or replace function public.is_org_member(
  target_organisation_id uuid,
  allowed_roles public.app_role[] default null
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organisations o on o.id = m.organisation_id
    where m.organisation_id = target_organisation_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create or replace function public.is_branch_member(
  target_branch_id uuid,
  allowed_roles public.app_role[] default null
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.branches b
    where b.id = target_branch_id
      and b.active
      and public.is_org_member(b.organisation_id, allowed_roles)
  );
$$;

create or replace function public.vendor_workspace_context()
returns table (
  organisation_id uuid,
  organisation_name text,
  branch_id uuid,
  branch_name text,
  branch_city text,
  branch_address text,
  role public.app_role,
  accepting_orders boolean,
  busy_mode boolean,
  default_prep_minutes integer,
  active_order_limit integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    o.id,
    o.trading_name,
    b.id,
    b.name,
    b.city,
    b.address_text,
    m.role,
    b.accepting_orders,
    b.busy_mode,
    b.default_prep_minutes,
    b.active_order_limit
  from public.memberships m
  join public.organisations o on o.id = m.organisation_id
  join public.branches b on b.organisation_id = o.id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and m.role in ('owner', 'manager', 'kitchen')
    and o.status = 'active'
    and b.active
  order by
    case m.role when 'owner' then 1 when 'manager' then 2 else 3 end,
    b.created_at
  limit 1;
$$;

create or replace function public.vendor_list_active_orders(p_branch_id uuid)
returns table (
  id uuid,
  reference text,
  status public.order_status,
  fulfilment public.fulfilment_type,
  payment_method text,
  total_paisa bigint,
  customer_note text,
  placed_at timestamptz,
  address_text text,
  landmark text,
  delivery_note text,
  order_lines jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_branch_member(
    p_branch_id,
    array['owner', 'manager', 'kitchen']::public.app_role[]
  ) then
    raise exception 'not authorised';
  end if;

  return query
  select
    o.id,
    o.reference,
    o.status,
    o.fulfilment,
    o.payment_method,
    o.total_paisa,
    o.customer_note,
    o.placed_at,
    a.address_line,
    a.landmark,
    a.delivery_note,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'name', l.item_name,
          'quantity', l.quantity,
          'unit_price_paisa', l.unit_price_paisa
        ) order by l.id
      ) filter (where l.id is not null),
      '[]'::jsonb
    )
  from public.orders o
  left join public.addresses a on a.id = o.address_id
  left join public.order_lines l on l.order_id = o.id
  where o.branch_id = p_branch_id
    and o.status in ('placed', 'accepted', 'preparing', 'ready')
  group by o.id, a.address_line, a.landmark, a.delivery_note
  order by o.placed_at;
end;
$$;

drop policy if exists menu_staff_select on public.menu_items;
create policy menu_staff_select on public.menu_items
for select to authenticated
using (public.is_branch_member(branch_id));

-- Realtime is optional in local Postgres, but production Supabase projects expose
-- this publication. Add orders once so the workspace can refresh without polling.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

-- Only a manager or owner can accept/reject new commercial orders. Kitchen
-- members retain the minimum permissions needed to prepare and hand them off.
create or replace function public.vendor_transition_order(
  p_order_id uuid,
  p_expected public.order_status,
  p_next public.order_status,
  p_note text default null
) returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;

  if not public.is_branch_member(
    v_order.branch_id,
    array['owner', 'manager', 'kitchen']::public.app_role[]
  ) then
    raise exception 'not authorised';
  end if;

  if p_expected = 'placed'
    and not public.is_branch_member(
      v_order.branch_id,
      array['owner', 'manager']::public.app_role[]
    ) then
    raise exception 'manager approval required';
  end if;

  if v_order.status <> p_expected then raise exception 'order status changed'; end if;
  if not (
    (p_expected = 'placed' and p_next in ('accepted', 'rejected'))
    or (p_expected = 'accepted' and p_next = 'preparing')
    or (p_expected = 'preparing' and p_next = 'ready')
    or (p_expected = 'ready' and p_next in ('picked_up', 'collected'))
  ) then
    raise exception 'invalid vendor transition';
  end if;
  if p_next = 'rejected' and char_length(coalesce(nullif(trim(p_note), ''), '')) < 3 then
    raise exception 'rejection reason required';
  end if;

  update public.orders
  set status = p_next, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.order_events (order_id, from_status, to_status, actor_id, note)
  values (p_order_id, p_expected, p_next, auth.uid(), nullif(trim(p_note), ''));
  return v_order;
end;
$$;

revoke all on function public.vendor_workspace_context() from public;
revoke all on function public.vendor_list_active_orders(uuid) from public;
grant execute on function public.vendor_workspace_context() to authenticated;
grant execute on function public.vendor_list_active_orders(uuid) to authenticated;
grant execute on function public.vendor_transition_order(uuid, public.order_status, public.order_status, text) to authenticated;

commit;
