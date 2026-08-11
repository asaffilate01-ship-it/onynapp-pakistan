begin;

alter table public.branches
  add column default_prep_minutes integer not null default 25
    check (default_prep_minutes between 10 and 90),
  add column busy_mode boolean not null default false,
  add column active_order_limit integer not null default 15
    check (active_order_limit between 1 and 100),
  add column paused_until timestamptz;

create or replace function public.vendor_set_branch_operations(
  p_branch_id uuid,
  p_accepting_orders boolean,
  p_busy_mode boolean,
  p_default_prep_minutes integer,
  p_active_order_limit integer
) returns public.branches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_branch public.branches%rowtype;
begin
  if not public.is_branch_member(
    p_branch_id,
    array['owner', 'manager']::public.app_role[]
  ) then
    raise exception 'not authorised';
  end if;
  if p_default_prep_minutes not between 10 and 90 then
    raise exception 'invalid preparation time';
  end if;
  if p_active_order_limit not between 1 and 100 then
    raise exception 'invalid active order limit';
  end if;

  update public.branches
  set accepting_orders = p_accepting_orders,
      busy_mode = p_busy_mode,
      default_prep_minutes = p_default_prep_minutes,
      active_order_limit = p_active_order_limit
  where id = p_branch_id
  returning * into v_branch;

  if not found then raise exception 'branch not found'; end if;

  insert into public.audit_events (
    organisation_id, actor_id, action, target_type, target_id, metadata
  ) values (
    v_branch.organisation_id,
    auth.uid(),
    'branch.operations_updated',
    'branch',
    p_branch_id,
    jsonb_build_object(
      'accepting_orders', p_accepting_orders,
      'busy_mode', p_busy_mode,
      'default_prep_minutes', p_default_prep_minutes,
      'active_order_limit', p_active_order_limit
    )
  );

  return v_branch;
end;
$$;

create or replace function public.vendor_set_menu_availability(
  p_menu_item_id uuid,
  p_available boolean
) returns public.menu_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.menu_items%rowtype;
  v_org_id uuid;
begin
  select * into v_item
  from public.menu_items
  where id = p_menu_item_id
  for update;

  if not found then raise exception 'menu item not found'; end if;
  if not public.is_branch_member(
    v_item.branch_id,
    array['owner', 'manager', 'kitchen']::public.app_role[]
  ) then
    raise exception 'not authorised';
  end if;

  select organisation_id into v_org_id
  from public.branches
  where id = v_item.branch_id;

  update public.menu_items
  set available = p_available, updated_at = now()
  where id = p_menu_item_id
  returning * into v_item;

  insert into public.audit_events (
    organisation_id, actor_id, action, target_type, target_id, metadata
  ) values (
    v_org_id,
    auth.uid(),
    'menu.availability_updated',
    'menu_item',
    p_menu_item_id,
    jsonb_build_object('available', p_available)
  );

  return v_item;
end;
$$;

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

revoke all on function public.vendor_set_branch_operations(uuid, boolean, boolean, integer, integer) from public;
revoke all on function public.vendor_set_menu_availability(uuid, boolean) from public;
revoke all on function public.vendor_transition_order(uuid, public.order_status, public.order_status, text) from public;

grant execute on function public.vendor_set_branch_operations(uuid, boolean, boolean, integer, integer) to authenticated;
grant execute on function public.vendor_set_menu_availability(uuid, boolean) to authenticated;
grant execute on function public.vendor_transition_order(uuid, public.order_status, public.order_status, text) to authenticated;

commit;
