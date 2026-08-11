begin;

-- Phase 4A: controlled Lahore launch surfaces. Platform roles are deliberately
-- separate from restaurant memberships so a vendor admin never becomes an
-- Onyn-wide support or dispatch operator.
create table public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('support', 'operations', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users(id) on delete cascade,
  application_type text not null check (
    application_type in ('restaurant', 'home_chef', 'sales_agent', 'supplier')
  ),
  trading_name text not null check (char_length(trading_name) between 2 and 120),
  city text not null check (city in ('Lahore', 'Karachi', 'Islamabad', 'Rawalpindi')),
  area text not null check (char_length(area) between 2 and 120),
  contact_name text not null check (char_length(contact_name) between 2 and 100),
  phone_e164 text not null check (phone_e164 ~ '^\+923[0-9]{9}$'),
  email text check (email is null or char_length(email) between 5 and 254),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'submitted' check (
    status in ('submitted', 'in_review', 'approved', 'rejected', 'withdrawn')
  ),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index partner_applications_open_unique
  on public.partner_applications(applicant_id, application_type)
  where status in ('submitted', 'in_review', 'approved');
create index partner_applications_review_idx
  on public.partner_applications(status, created_at);

create table public.rider_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone_e164 text not null check (phone_e164 ~ '^\+923[0-9]{9}$'),
  city text not null check (city = 'Lahore'),
  area text not null check (char_length(area) between 2 and 120),
  vehicle_type text not null check (vehicle_type in ('motorbike', 'bicycle')),
  has_valid_licence boolean not null,
  status text not null default 'submitted' check (
    status in ('submitted', 'screening', 'approved', 'rejected', 'suspended')
  ),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rider_applications_review_idx
  on public.rider_applications(status, created_at);

create table public.delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  rider_id uuid references auth.users(id),
  status text not null default 'unassigned' check (
    status in ('unassigned', 'offered', 'accepted', 'at_pickup', 'picked_up', 'delivered', 'failed', 'cancelled')
  ),
  cash_to_collect_paisa bigint not null check (cash_to_collect_paisa >= 0),
  cash_collected_paisa bigint check (cash_collected_paisa is null or cash_collected_paisa >= 0),
  proof_note text check (proof_note is null or char_length(proof_note) <= 500),
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 500),
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delivery_jobs_rider_status_idx
  on public.delivery_jobs(rider_id, status, created_at);
create index delivery_jobs_status_idx
  on public.delivery_jobs(status, created_at);

-- General help cases can exist without an order, while order ownership remains
-- checked by the creation RPC.
alter table public.support_cases alter column order_id drop not null;
alter table public.support_cases add column subject text;
alter table public.support_cases add column assigned_to uuid references auth.users(id);
alter table public.support_cases add column resolution_note text;
alter table public.support_cases add column priority text not null default 'normal'
  check (priority in ('normal', 'urgent'));
alter table public.support_cases drop constraint if exists support_cases_category_check;
alter table public.support_cases add constraint support_cases_category_check check (
  category in ('cancellation_request', 'order_issue', 'delivery_issue', 'account_issue', 'safety_issue', 'payment_issue', 'other')
);
alter table public.support_cases add constraint support_cases_subject_check
  check (subject is null or char_length(subject) between 3 and 160);
alter table public.support_cases add constraint support_cases_resolution_check
  check (resolution_note is null or char_length(resolution_note) <= 1500);

alter table public.platform_staff enable row level security;
alter table public.partner_applications enable row level security;
alter table public.rider_applications enable row level security;
alter table public.delivery_jobs enable row level security;

create or replace function public.is_platform_staff(p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_staff s
    where s.user_id = auth.uid() and s.active
      and (p_roles is null or s.role = any(p_roles))
  );
$$;

revoke all on function public.is_platform_staff(text[]) from public;
grant execute on function public.is_platform_staff(text[]) to authenticated;

create policy platform_staff_own_select on public.platform_staff
for select to authenticated using (user_id = auth.uid());

create policy partner_applications_own_select on public.partner_applications
for select to authenticated using (applicant_id = auth.uid());
create policy rider_applications_own_select on public.rider_applications
for select to authenticated using (applicant_id = auth.uid());
create policy delivery_jobs_assigned_rider_select on public.delivery_jobs
for select to authenticated using (rider_id = auth.uid());

drop policy if exists "Authorised support staff can read support cases" on public.support_cases;
create policy support_cases_platform_or_vendor_select on public.support_cases
for select to authenticated using (
  public.is_platform_staff(array['support', 'operations', 'admin'])
  or (
    order_id is not null and exists (
      select 1 from public.orders o
      where o.id = order_id
        and public.is_branch_member(o.branch_id, array['owner', 'manager']::public.app_role[])
    )
  )
);

revoke all on public.platform_staff, public.partner_applications,
  public.rider_applications, public.delivery_jobs from anon, authenticated;
grant select on public.platform_staff, public.partner_applications,
  public.rider_applications, public.delivery_jobs to authenticated;

create or replace function public.customer_profile_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'profile', (select jsonb_build_object(
      'display_name', p.display_name, 'phone_e164', p.phone_e164
    ) from public.profiles p where p.id = auth.uid()),
    'addresses', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'label', a.label, 'city', a.city,
      'address_line', a.address_line, 'landmark', a.landmark,
      'delivery_note', a.delivery_note
    ) order by a.created_at desc) from public.addresses a
      where a.user_id = auth.uid()), '[]'::jsonb)
  ) where auth.uid() is not null;
$$;

create or replace function public.customer_update_profile(p_display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) not between 2 and 100
    then raise exception 'Display name must be 2 to 100 characters'; end if;
  update public.profiles set display_name = trim(p_display_name), updated_at = now()
  where id = auth.uid() returning * into v_profile;
  return v_profile;
end;
$$;

create or replace function public.customer_create_support_case(
  p_order_id uuid, p_category text, p_subject text, p_description text
)
returns public.support_cases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_case public.support_cases%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_category not in ('order_issue', 'delivery_issue', 'account_issue', 'safety_issue', 'payment_issue', 'other')
    then raise exception 'Invalid support category'; end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 3 and 160
    then raise exception 'Subject must be 3 to 160 characters'; end if;
  if char_length(trim(coalesce(p_description, ''))) not between 5 and 1000
    then raise exception 'Description must be 5 to 1000 characters'; end if;
  if p_order_id is not null and not exists (
    select 1 from public.orders where id = p_order_id and customer_id = auth.uid()
  ) then raise exception 'Order not found'; end if;
  insert into public.support_cases(customer_id, order_id, category, subject, description, priority)
  values (auth.uid(), p_order_id, p_category, trim(p_subject), trim(p_description),
    case when p_category = 'safety_issue' then 'urgent' else 'normal' end)
  returning * into v_case;
  return v_case;
end;
$$;

create or replace function public.customer_list_support_cases()
returns table (
  id uuid, order_id uuid, category text, subject text, description text,
  status text, resolution_note text, created_at timestamptz, updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select sc.id, sc.order_id, sc.category, coalesce(sc.subject, 'Order support'),
    sc.description, sc.status, sc.resolution_note, sc.created_at, sc.updated_at
  from public.support_cases sc where sc.customer_id = auth.uid()
  order by sc.created_at desc limit 100;
$$;

create or replace function public.submit_partner_application(
  p_application_type text, p_trading_name text, p_city text, p_area text,
  p_contact_name text, p_phone_e164 text, p_email text default null,
  p_details text default null
)
returns public.partner_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_application public.partner_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_application_type not in ('restaurant', 'home_chef', 'sales_agent', 'supplier')
    then raise exception 'Invalid application type'; end if;
  insert into public.partner_applications(
    applicant_id, application_type, trading_name, city, area, contact_name,
    phone_e164, email, details
  ) values (
    auth.uid(), p_application_type, trim(p_trading_name), p_city, trim(p_area),
    trim(p_contact_name), p_phone_e164, nullif(lower(trim(p_email)), ''),
    nullif(trim(p_details), '')
  ) returning * into v_application;
  return v_application;
exception when unique_violation then
  raise exception 'An active application of this type already exists';
end;
$$;

create or replace function public.list_own_partner_applications()
returns setof public.partner_applications
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.partner_applications where applicant_id = auth.uid()
  order by created_at desc;
$$;

create or replace function public.submit_rider_application(
  p_full_name text, p_phone_e164 text, p_area text,
  p_vehicle_type text, p_has_valid_licence boolean
)
returns public.rider_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_application public.rider_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.rider_applications(
    applicant_id, full_name, phone_e164, city, area, vehicle_type, has_valid_licence
  ) values (
    auth.uid(), trim(p_full_name), p_phone_e164, 'Lahore', trim(p_area),
    p_vehicle_type, p_has_valid_licence
  ) on conflict (applicant_id) do update set
    full_name = excluded.full_name, phone_e164 = excluded.phone_e164,
    area = excluded.area, vehicle_type = excluded.vehicle_type,
    has_valid_licence = excluded.has_valid_licence, updated_at = now()
  where rider_applications.status in ('submitted', 'rejected')
  returning * into v_application;
  if v_application.id is null then raise exception 'Approved or active applications cannot be edited'; end if;
  return v_application;
end;
$$;

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
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', j.id, 'order_id', j.order_id, 'reference', o.reference,
      'status', j.status, 'cash_to_collect_paisa', j.cash_to_collect_paisa,
      'restaurant', b.name, 'pickup_address', b.address_text,
      'delivery_address', a.address_line, 'landmark', a.landmark,
      'delivery_note', a.delivery_note, 'created_at', j.created_at
    ) order by j.created_at desc)
    from public.delivery_jobs j
    join public.orders o on o.id = j.order_id
    join public.branches b on b.id = o.branch_id
    left join public.addresses a on a.id = o.address_id
    where j.rider_id = auth.uid()), '[]'::jsonb)
  );
end;
$$;

create or replace function public.rider_transition_delivery_job(
  p_job_id uuid, p_expected text, p_next text,
  p_proof_note text default null, p_cash_collected_paisa bigint default null
)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_job public.delivery_jobs%rowtype; v_order public.orders%rowtype;
begin
  select * into v_job from public.delivery_jobs
  where id = p_job_id and rider_id = auth.uid()
    and exists (select 1 from public.rider_applications
      where applicant_id = auth.uid() and status = 'approved')
  for update;
  if not found then raise exception 'Delivery job not found'; end if;
  if v_job.status <> p_expected then raise exception 'Delivery job status changed'; end if;
  if not ((p_expected = 'offered' and p_next = 'accepted')
    or (p_expected = 'accepted' and p_next = 'at_pickup')
    or (p_expected = 'at_pickup' and p_next = 'picked_up')
    or (p_expected = 'picked_up' and p_next in ('delivered', 'failed')))
    then raise exception 'Invalid delivery transition'; end if;
  select * into v_order from public.orders where id = v_job.order_id for update;
  if p_next = 'delivered' then
    if char_length(trim(coalesce(p_proof_note, ''))) < 4 then raise exception 'Delivery proof note required'; end if;
    if p_cash_collected_paisa is distinct from v_job.cash_to_collect_paisa
      then raise exception 'COD collection must match the order total'; end if;
  end if;
  update public.delivery_jobs set status = p_next,
    accepted_at = case when p_next = 'accepted' then now() else accepted_at end,
    picked_up_at = case when p_next = 'picked_up' then now() else picked_up_at end,
    completed_at = case when p_next in ('delivered', 'failed') then now() else completed_at end,
    proof_note = case when p_next = 'delivered' then trim(p_proof_note) else proof_note end,
    failure_reason = case when p_next = 'failed' then trim(p_proof_note) else failure_reason end,
    cash_collected_paisa = case when p_next = 'delivered' then p_cash_collected_paisa else cash_collected_paisa end,
    updated_at = now() where id = p_job_id returning * into v_job;
  if p_next = 'picked_up' and v_order.status = 'ready' then
    update public.orders set status = 'picked_up', updated_at = now() where id = v_order.id;
    insert into public.order_events(order_id, from_status, to_status, actor_id)
    values (v_order.id, 'ready', 'picked_up', auth.uid());
  elsif p_next = 'delivered' and v_order.status = 'picked_up' then
    update public.orders set status = 'delivered', updated_at = now() where id = v_order.id;
    insert into public.order_events(order_id, from_status, to_status, actor_id, note)
    values (v_order.id, 'picked_up', 'delivered', auth.uid(), trim(p_proof_note));
  elsif p_next = 'failed' and v_order.status = 'picked_up' then
    update public.orders set status = 'delivery_failed', updated_at = now() where id = v_order.id;
    insert into public.order_events(order_id, from_status, to_status, actor_id, note)
    values (v_order.id, 'picked_up', 'delivery_failed', auth.uid(), trim(p_proof_note));
  end if;
  return v_job;
end;
$$;

create or replace function public.ops_launch_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_staff(array['support', 'operations', 'admin'])
    then raise exception 'Not authorised'; end if;
  return jsonb_build_object(
    'staff_role', (select role from public.platform_staff where user_id = auth.uid()),
    'partner_applications', case when public.is_platform_staff(array['operations', 'admin'])
      then coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at)
        from public.partner_applications p where p.status in ('submitted', 'in_review')), '[]'::jsonb)
      else '[]'::jsonb end,
    'rider_applications', case when public.is_platform_staff(array['operations', 'admin'])
      then coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at)
        from public.rider_applications r where r.status in ('submitted', 'screening', 'approved')), '[]'::jsonb)
      else '[]'::jsonb end,
    'support_cases', coalesce((select jsonb_agg(jsonb_build_object(
      'id', sc.id, 'order_id', sc.order_id, 'category', sc.category,
      'subject', coalesce(sc.subject, 'Order support'), 'description', sc.description,
      'status', sc.status, 'priority', sc.priority, 'created_at', sc.created_at
    ) order by case when sc.priority = 'urgent' then 0 else 1 end, sc.created_at) from public.support_cases sc
      where sc.status in ('new', 'in_review')), '[]'::jsonb),
    'delivery_jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', j.id, 'order_id', j.order_id, 'reference', o.reference,
      'status', j.status, 'rider_id', j.rider_id,
      'cash_to_collect_paisa', j.cash_to_collect_paisa,
      'restaurant', b.name, 'created_at', j.created_at
    ) order by j.created_at) from public.delivery_jobs j
      join public.orders o on o.id = j.order_id join public.branches b on b.id = o.branch_id
      where j.status not in ('delivered', 'cancelled')), '[]'::jsonb),
    'ready_delivery_orders', coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.id, 'reference', o.reference, 'total_paisa', o.total_paisa,
      'restaurant', b.name, 'placed_at', o.placed_at
    ) order by o.placed_at) from public.orders o join public.branches b on b.id = o.branch_id
      where o.fulfilment = 'delivery' and o.status = 'ready'
        and not exists (select 1 from public.delivery_jobs j where j.order_id = o.id)), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ops_review_application(
  p_kind text, p_application_id uuid, p_status text, p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_staff(array['operations', 'admin'])
    then raise exception 'Not authorised'; end if;
  if p_status not in ('in_review', 'screening', 'approved', 'rejected', 'suspended')
    then raise exception 'Invalid review status'; end if;
  if p_kind = 'partner' then
    if p_status not in ('in_review', 'approved', 'rejected') then raise exception 'Invalid partner status'; end if;
    update public.partner_applications set status = p_status, review_note = nullif(trim(p_note), ''),
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = p_application_id;
  elsif p_kind = 'rider' then
    if p_status = 'approved' and not exists (
      select 1 from public.rider_applications
      where id = p_application_id and has_valid_licence
    ) then raise exception 'A valid licence declaration is required before approval'; end if;
    update public.rider_applications set status = p_status, review_note = nullif(trim(p_note), ''),
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = p_application_id;
  else raise exception 'Invalid application kind'; end if;
  if not found then raise exception 'Application not found'; end if;
end;
$$;

create or replace function public.ops_update_support_case(
  p_case_id uuid, p_status text, p_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_staff(array['support', 'operations', 'admin'])
    then raise exception 'Not authorised'; end if;
  if p_status not in ('in_review', 'resolved', 'closed') then raise exception 'Invalid case status'; end if;
  if p_status = 'resolved' and char_length(trim(coalesce(p_resolution_note, ''))) < 5
    then raise exception 'Resolution note required'; end if;
  update public.support_cases set status = p_status, assigned_to = auth.uid(),
    resolution_note = nullif(trim(p_resolution_note), ''), updated_at = now()
  where id = p_case_id;
  if not found then raise exception 'Support case not found'; end if;
end;
$$;

create or replace function public.ops_assign_delivery(
  p_order_id uuid, p_rider_id uuid
)
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
    where applicant_id = p_rider_id and status = 'approved')
    then raise exception 'Approved rider required'; end if;
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

create or replace function public.vendor_import_menu(p_branch_id uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_item jsonb; v_category_id uuid; v_menu_id uuid; v_count integer := 0;
begin
  if not public.is_branch_member(p_branch_id, array['owner', 'manager']::public.app_role[])
    then raise exception 'Not authorised'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 200
    then raise exception 'Import must contain 1 to 200 items'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if char_length(trim(coalesce(v_item ->> 'name', ''))) not between 1 and 140
      or char_length(trim(coalesce(v_item ->> 'category', ''))) not between 1 and 100
      or (v_item ->> 'price_paisa')::integer not between 0 and 100000000
      then raise exception 'Invalid menu import row'; end if;
    select id into v_category_id from public.menu_categories
      where branch_id = p_branch_id and lower(name) = lower(trim(v_item ->> 'category')) limit 1;
    if v_category_id is null then
      insert into public.menu_categories(branch_id, name)
      values (p_branch_id, trim(v_item ->> 'category')) returning id into v_category_id;
    end if;
    select id into v_menu_id from public.menu_items
      where branch_id = p_branch_id and lower(name) = lower(trim(v_item ->> 'name')) limit 1;
    if v_menu_id is null then
      insert into public.menu_items(branch_id, category_id, name, description, price_paisa, available)
      values (p_branch_id, v_category_id, trim(v_item ->> 'name'),
        nullif(trim(v_item ->> 'description'), ''), (v_item ->> 'price_paisa')::integer,
        coalesce((v_item ->> 'available')::boolean, true));
    else
      update public.menu_items set category_id = v_category_id,
        description = nullif(trim(v_item ->> 'description'), ''),
        price_paisa = (v_item ->> 'price_paisa')::integer,
        available = coalesce((v_item ->> 'available')::boolean, true),
        active = true, updated_at = now() where id = v_menu_id;
    end if;
    v_count := v_count + 1;
  end loop;
  insert into public.audit_events(organisation_id, actor_id, action, target_type, target_id, metadata)
  select b.organisation_id, auth.uid(), 'menu.imported', 'branch', p_branch_id,
    jsonb_build_object('item_count', v_count) from public.branches b where b.id = p_branch_id;
  return v_count;
end;
$$;

revoke all on function public.customer_profile_snapshot() from public;
revoke all on function public.customer_update_profile(text) from public;
revoke all on function public.customer_create_support_case(uuid, text, text, text) from public;
revoke all on function public.customer_list_support_cases() from public;
revoke all on function public.submit_partner_application(text, text, text, text, text, text, text, text) from public;
revoke all on function public.list_own_partner_applications() from public;
revoke all on function public.submit_rider_application(text, text, text, text, boolean) from public;
revoke all on function public.rider_workspace_snapshot() from public;
revoke all on function public.rider_transition_delivery_job(uuid, text, text, text, bigint) from public;
revoke all on function public.ops_launch_snapshot() from public;
revoke all on function public.ops_review_application(text, uuid, text, text) from public;
revoke all on function public.ops_update_support_case(uuid, text, text) from public;
revoke all on function public.ops_assign_delivery(uuid, uuid) from public;
revoke all on function public.vendor_import_menu(uuid, jsonb) from public;

grant execute on function public.customer_profile_snapshot() to authenticated;
grant execute on function public.customer_update_profile(text) to authenticated;
grant execute on function public.customer_create_support_case(uuid, text, text, text) to authenticated;
grant execute on function public.customer_list_support_cases() to authenticated;
grant execute on function public.submit_partner_application(text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.list_own_partner_applications() to authenticated;
grant execute on function public.submit_rider_application(text, text, text, text, boolean) to authenticated;
grant execute on function public.rider_workspace_snapshot() to authenticated;
grant execute on function public.rider_transition_delivery_job(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.ops_launch_snapshot() to authenticated;
grant execute on function public.ops_review_application(text, uuid, text, text) to authenticated;
grant execute on function public.ops_update_support_case(uuid, text, text) to authenticated;
grant execute on function public.ops_assign_delivery(uuid, uuid) to authenticated;
grant execute on function public.vendor_import_menu(uuid, jsonb) to authenticated;

commit;
