-- Phase 7: Onyn-derived rider presence and live operations, adapted for the
-- controlled Pakistan pilot. Precise location remains private to the rider
-- and separately authorised operations staff.

create table public.rider_presence (
  rider_id uuid primary key references auth.users(id) on delete cascade,
  availability_status text not null default 'offline'
    check (availability_status in ('offline', 'online', 'on_delivery')),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  accuracy_metres double precision check (accuracy_metres is null or accuracy_metres between 0 and 1000),
  last_location_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.rider_presence enable row level security;
create policy rider_presence_own_select on public.rider_presence
for select to authenticated using (rider_id = auth.uid());
create policy rider_presence_ops_select on public.rider_presence
for select to authenticated using (public.is_platform_staff(array['operations', 'admin']));
revoke all on public.rider_presence from anon, authenticated;
grant select on public.rider_presence to authenticated;

create or replace function public.rider_set_availability(p_online boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_presence public.rider_presence%rowtype;
begin
  if not exists (
    select 1 from public.rider_applications
    where applicant_id = auth.uid() and status = 'approved' and verification_status = 'verified'
  ) then raise exception 'Approved and verified rider required'; end if;

  if not p_online and exists (
    select 1 from public.delivery_jobs
    where rider_id = auth.uid() and status in ('offered', 'accepted', 'at_pickup', 'picked_up')
  ) then raise exception 'Finish or resolve the active delivery before going offline'; end if;

  insert into public.rider_presence(rider_id, availability_status, updated_at)
  values (auth.uid(), case when p_online then 'online' else 'offline' end, now())
  on conflict (rider_id) do update set
    availability_status = excluded.availability_status,
    updated_at = now()
  returning * into v_presence;

  return jsonb_build_object(
    'availability_status', v_presence.availability_status,
    'last_location_at', v_presence.last_location_at,
    'updated_at', v_presence.updated_at
  );
end;
$$;

create or replace function public.rider_update_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_metres double precision
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_presence public.rider_presence%rowtype;
  v_distance_km double precision;
  v_seconds double precision;
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180
    then raise exception 'Invalid rider coordinates'; end if;
  if p_accuracy_metres < 1 or p_accuracy_metres > 100
    then raise exception 'Location accuracy is not sufficient'; end if;

  select * into v_presence from public.rider_presence
  where rider_id = auth.uid() and availability_status in ('online', 'on_delivery')
  for update;
  if not found then raise exception 'Rider must be online before sharing location'; end if;

  if v_presence.latitude is not null and v_presence.last_location_at is not null then
    v_seconds := extract(epoch from (now() - v_presence.last_location_at));
    v_distance_km := 6371 * 2 * asin(sqrt(
      power(sin(radians(p_latitude - v_presence.latitude) / 2), 2) +
      cos(radians(v_presence.latitude)) * cos(radians(p_latitude)) *
      power(sin(radians(p_longitude - v_presence.longitude) / 2), 2)
    ));
    if v_seconds < 30 and v_distance_km > 2
      then raise exception 'Implausible rider location change'; end if;
  end if;

  update public.rider_presence set
    latitude = p_latitude,
    longitude = p_longitude,
    accuracy_metres = p_accuracy_metres,
    last_location_at = now(),
    updated_at = now()
  where rider_id = auth.uid();
end;
$$;

create or replace function public.sync_rider_presence_from_job()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('accepted', 'at_pickup', 'picked_up') then
    insert into public.rider_presence(rider_id, availability_status, updated_at)
    values (new.rider_id, 'on_delivery', now())
    on conflict (rider_id) do update set availability_status = 'on_delivery', updated_at = now();
  elsif new.status in ('delivered', 'failed', 'cancelled') and not exists (
    select 1 from public.delivery_jobs
    where rider_id = new.rider_id and id <> new.id
      and status in ('accepted', 'at_pickup', 'picked_up')
  ) then
    update public.rider_presence set availability_status = 'online', updated_at = now()
    where rider_id = new.rider_id;
  end if;
  return new;
end;
$$;

create trigger delivery_job_presence_sync
after insert or update of status on public.delivery_jobs
for each row execute function public.sync_rider_presence_from_job();

create or replace function public.rider_workspace_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_application public.rider_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_application from public.rider_applications where applicant_id = auth.uid();
  return jsonb_build_object(
    'application', case when v_application.id is null then null else to_jsonb(v_application) end,
    'presence', coalesce((select jsonb_build_object(
      'availability_status', p.availability_status,
      'last_location_at', p.last_location_at,
      'updated_at', p.updated_at
    ) from public.rider_presence p where p.rider_id = auth.uid()),
      jsonb_build_object('availability_status', 'offline', 'last_location_at', null, 'updated_at', null)),
    'cash_balance_paisa', coalesce((select sum(e.amount_paisa)
      from public.cod_ledger_entries e where e.rider_id = auth.uid()), 0),
    'completed_today', coalesce((select count(*) from public.delivery_jobs j
      where j.rider_id = auth.uid() and j.status = 'delivered'
        and j.completed_at >= (date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi')), 0),
    'documents', coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.id, 'document_kind', d.document_kind, 'status', d.status,
      'review_note', d.review_note, 'created_at', d.created_at
    ) order by d.created_at) from public.rider_verification_documents d
      where d.applicant_id = auth.uid()), '[]'::jsonb),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', j.id, 'order_id', j.order_id, 'reference', o.reference,
      'status', j.status, 'cash_to_collect_paisa', j.cash_to_collect_paisa,
      'cash_collected_paisa', j.cash_collected_paisa, 'cod_status', j.cod_status,
      'restaurant', b.name, 'pickup_address', b.address_text,
      'delivery_address', a.address_line, 'landmark', a.landmark,
      'delivery_note', a.delivery_note, 'created_at', j.created_at
    ) order by
      case when j.status in ('offered', 'accepted', 'at_pickup', 'picked_up') then 0 else 1 end,
      j.created_at desc)
    from public.delivery_jobs j
    join public.orders o on o.id = j.order_id
    join public.branches b on b.id = o.branch_id
    left join public.addresses a on a.id = o.address_id
    where j.rider_id = auth.uid()), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ops_assign_delivery(p_order_id uuid, p_rider_id uuid)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders%rowtype; v_job public.delivery_jobs%rowtype;
begin
  if not public.is_platform_staff(array['operations', 'admin'])
    then raise exception 'Not authorised'; end if;
  if not exists (select 1 from public.rider_applications
    where applicant_id = p_rider_id and status = 'approved' and verification_status = 'verified')
    then raise exception 'Approved and verified rider required'; end if;
  if not exists (select 1 from public.rider_presence
    where rider_id = p_rider_id and availability_status = 'online')
    then raise exception 'Rider is not online and available'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.fulfilment <> 'delivery' or v_order.status <> 'ready'
    then raise exception 'Order is not ready for dispatch'; end if;
  insert into public.delivery_jobs(
    order_id, rider_id, status, cash_to_collect_paisa, assigned_by, assigned_at
  ) values (v_order.id, p_rider_id, 'offered', v_order.total_paisa, auth.uid(), now())
  on conflict (order_id) do update set rider_id = excluded.rider_id, status = 'offered',
    assigned_by = auth.uid(), assigned_at = now(), updated_at = now()
  where delivery_jobs.status in ('unassigned', 'offered')
  returning * into v_job;
  if v_job.id is null then raise exception 'Delivery is already active'; end if;
  return v_job;
end;
$$;

revoke all on function public.rider_set_availability(boolean) from public;
revoke all on function public.rider_update_location(double precision, double precision, double precision) from public;
grant execute on function public.rider_set_availability(boolean) to authenticated;
grant execute on function public.rider_update_location(double precision, double precision, double precision) to authenticated;
