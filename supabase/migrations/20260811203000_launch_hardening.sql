begin;

-- Phase 4B: launch hardening. Sensitive rider evidence stays in a private
-- bucket, COD movements become append-only, OTP sends are rate limited and
-- the existing notification outbox gains a trusted worker contract.

alter table public.rider_applications
  add column verification_status text not null default 'not_started'
  check (verification_status in ('not_started', 'documents_required', 'in_review', 'verified', 'rejected'));

create table public.rider_verification_documents (
  id uuid primary key default gen_random_uuid(),
  rider_application_id uuid not null references public.rider_applications(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  document_kind text not null check (
    document_kind in ('cnic_front', 'cnic_back', 'licence_front', 'vehicle_registration')
  ),
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rider_application_id, document_kind)
);

create index rider_verification_review_idx
  on public.rider_verification_documents(status, created_at);

alter table public.delivery_jobs
  add column cod_status text not null default 'pending'
  check (cod_status in ('pending', 'collected', 'reconciled', 'disputed'));
alter table public.delivery_jobs add column reconciled_by uuid references auth.users(id);
alter table public.delivery_jobs add column reconciled_at timestamptz;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'rider-verification', 'rider-verification', false, 5242880,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.rider_verification_documents enable row level security;

create policy rider_documents_own_select on public.rider_verification_documents
for select to authenticated using (applicant_id = auth.uid());

create policy rider_documents_ops_select on public.rider_verification_documents
for select to authenticated using (public.is_platform_staff(array['operations', 'admin']));

create policy rider_verification_objects_own_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'rider-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.rider_applications r
    where r.applicant_id = auth.uid() and r.status = 'screening'
  )
);

create policy rider_verification_objects_own_select on storage.objects
for select to authenticated using (
  bucket_id = 'rider-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy rider_verification_objects_own_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'rider-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (
    select 1 from public.rider_verification_documents d
    where d.object_path = name and d.status = 'verified'
  )
);

create policy rider_verification_objects_ops_select on storage.objects
for select to authenticated using (
  bucket_id = 'rider-verification'
  and public.is_platform_staff(array['operations', 'admin'])
);

revoke all on public.rider_verification_documents from anon, authenticated;
grant select on public.rider_verification_documents to authenticated;

create or replace function public.rider_register_verification_document(
  p_document_kind text, p_object_path text, p_mime_type text, p_size_bytes bigint
)
returns public.rider_verification_documents
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_application public.rider_applications%rowtype;
  v_document public.rider_verification_documents%rowtype;
begin
  if p_document_kind not in ('cnic_front', 'cnic_back', 'licence_front', 'vehicle_registration')
    then raise exception 'Invalid verification document type'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'application/pdf')
    or p_size_bytes not between 1 and 5242880
    then raise exception 'Verification file must be JPEG, PNG or PDF and no larger than 5 MB'; end if;
  if p_object_path not like auth.uid()::text || '/%'
    then raise exception 'Invalid verification object path'; end if;

  select * into v_application from public.rider_applications
  where applicant_id = auth.uid() and status = 'screening' for update;
  if not found then raise exception 'Rider must be in screening before documents can be uploaded'; end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'rider-verification' and name = p_object_path and owner_id = auth.uid()::text
  ) then raise exception 'Uploaded verification object was not found'; end if;

  insert into public.rider_verification_documents(
    rider_application_id, applicant_id, document_kind, object_path, mime_type, size_bytes
  ) values (
    v_application.id, auth.uid(), p_document_kind, p_object_path, p_mime_type, p_size_bytes
  )
  on conflict (rider_application_id, document_kind) do update set
    object_path = excluded.object_path,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    status = 'pending',
    review_note = null,
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now()
  where rider_verification_documents.status <> 'verified'
  returning * into v_document;
  if v_document.id is null then raise exception 'A verified document cannot be replaced'; end if;

  update public.rider_applications
  set verification_status = 'in_review', updated_at = now()
  where id = v_application.id;
  return v_document;
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
    ) order by j.created_at desc)
    from public.delivery_jobs j
    join public.orders o on o.id = j.order_id
    join public.branches b on b.id = o.branch_id
    left join public.addresses a on a.id = o.address_id
    where j.rider_id = auth.uid()), '[]'::jsonb)
  );
end;
$$;

-- Append-only COD liability ledger. Positive amounts create rider liability;
-- negative amounts clear it after an operations handover count.
create table public.cod_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  delivery_job_id uuid not null references public.delivery_jobs(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  rider_id uuid not null references auth.users(id) on delete restrict,
  entry_type text not null check (entry_type in ('collection', 'handover', 'adjustment')),
  amount_paisa bigint not null check (amount_paisa <> 0),
  note text not null check (char_length(note) between 4 and 500),
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index cod_ledger_collection_unique
  on public.cod_ledger_entries(delivery_job_id) where entry_type = 'collection';
create unique index cod_ledger_handover_unique
  on public.cod_ledger_entries(delivery_job_id) where entry_type = 'handover';
create index cod_ledger_rider_created_idx
  on public.cod_ledger_entries(rider_id, created_at desc);

alter table public.cod_ledger_entries enable row level security;
create policy cod_ledger_rider_select on public.cod_ledger_entries
for select to authenticated using (rider_id = auth.uid());
create policy cod_ledger_ops_select on public.cod_ledger_entries
for select to authenticated using (public.is_platform_staff(array['operations', 'admin']));
revoke all on public.cod_ledger_entries from anon, authenticated;
grant select on public.cod_ledger_entries to authenticated;

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
      where applicant_id = auth.uid() and status = 'approved' and verification_status = 'verified')
  for update;
  if not found then raise exception 'Approved and verified rider delivery job not found'; end if;
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
    cod_status = case when p_next = 'delivered' then 'collected' else cod_status end,
    updated_at = now() where id = p_job_id returning * into v_job;
  if p_next = 'delivered' then
    insert into public.cod_ledger_entries(
      delivery_job_id, order_id, rider_id, entry_type, amount_paisa, note, recorded_by
    ) values (
      v_job.id, v_order.id, auth.uid(), 'collection', v_job.cash_collected_paisa,
      'COD collected at customer handover', auth.uid()
    );
  end if;
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

create or replace function public.ops_reconcile_cod_job(
  p_job_id uuid, p_received_paisa bigint, p_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_job public.delivery_jobs%rowtype;
begin
  if not public.is_platform_staff(array['operations', 'admin'])
    then raise exception 'Not authorised'; end if;
  if char_length(trim(coalesce(p_note, ''))) < 4 then raise exception 'Handover note required'; end if;
  select * into v_job from public.delivery_jobs where id = p_job_id for update;
  if not found or v_job.status <> 'delivered' or v_job.cod_status <> 'collected'
    then raise exception 'COD job is not awaiting reconciliation'; end if;
  if p_received_paisa is distinct from v_job.cash_collected_paisa
    then raise exception 'Received cash does not match rider collection'; end if;
  insert into public.cod_ledger_entries(
    delivery_job_id, order_id, rider_id, entry_type, amount_paisa, note, recorded_by
  ) values (
    v_job.id, v_job.order_id, v_job.rider_id, 'handover', -p_received_paisa,
    trim(p_note), auth.uid()
  );
  update public.delivery_jobs set cod_status = 'reconciled', reconciled_by = auth.uid(),
    reconciled_at = now(), updated_at = now() where id = v_job.id;
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

-- Trusted notification worker controls for the Phase 3D outbox.
alter table public.notification_outbox add column provider_message_id text;
alter table public.notification_outbox add column updated_at timestamptz not null default now();

create or replace function public.service_claim_notification_batch(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
    then raise exception 'Service role required'; end if;
  with candidates as (
    select n.id from public.notification_outbox n
    join public.profiles p on p.id = n.user_id and p.phone_e164 is not null
    where n.status in ('pending', 'failed') and n.next_attempt_at <= now() and n.attempts < 5
    order by n.created_at for update of n skip locked limit greatest(1, least(p_limit, 100))
  ), claimed as (
    update public.notification_outbox n set status = 'sending', attempts = attempts + 1,
      updated_at = now() from candidates c where n.id = c.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'phone_e164', p.phone_e164, 'event_type', c.event_type,
    'payload', c.payload, 'attempts', c.attempts
  ) order by c.created_at), '[]'::jsonb) into v_result
  from claimed c join public.profiles p on p.id = c.user_id;
  return v_result;
end;
$$;

create or replace function public.service_complete_notification(
  p_id uuid, p_sent boolean, p_provider_message_id text default null, p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
    then raise exception 'Service role required'; end if;
  update public.notification_outbox set
    status = case when p_sent then 'sent' when attempts >= 5 then 'dead_letter' else 'failed' end,
    provider_message_id = case when p_sent then left(p_provider_message_id, 200) else provider_message_id end,
    last_error = case when p_sent then null else left(coalesce(p_error, 'Provider rejected request'), 500) end,
    sent_at = case when p_sent then now() else sent_at end,
    next_attempt_at = case when p_sent then next_attempt_at
      else now() + make_interval(mins => power(2, least(attempts, 6))::integer) end,
    updated_at = now()
  where id = p_id and status = 'sending';
  if not found then raise exception 'Notification claim not found'; end if;
end;
$$;

-- The public OTP edge route stores only salted hashes, never raw phones or IPs.
create table public.otp_send_attempts (
  id bigint generated always as identity primary key,
  subject_kind text not null check (subject_kind in ('phone', 'ip')),
  subject_hash text not null check (char_length(subject_hash) = 64),
  created_at timestamptz not null default now()
);
create index otp_send_attempts_lookup_idx
  on public.otp_send_attempts(subject_kind, subject_hash, created_at desc);
alter table public.otp_send_attempts enable row level security;
revoke all on public.otp_send_attempts from anon, authenticated;

create or replace function public.service_reserve_otp_send(p_phone_hash text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
    then raise exception 'Service role required'; end if;
  if p_phone_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$'
    then raise exception 'Invalid OTP subject hash'; end if;
  perform pg_advisory_xact_lock(hashtext(p_phone_hash));
  if (select count(*) from public.otp_send_attempts
      where subject_kind = 'phone' and subject_hash = p_phone_hash
        and created_at > now() - interval '10 minutes') >= 3
    or (select count(*) from public.otp_send_attempts
      where subject_kind = 'phone' and subject_hash = p_phone_hash
        and created_at > now() - interval '24 hours') >= 10
    or (select count(*) from public.otp_send_attempts
      where subject_kind = 'ip' and subject_hash = p_ip_hash
        and created_at > now() - interval '10 minutes') >= 20
  then return false; end if;
  insert into public.otp_send_attempts(subject_kind, subject_hash)
  values ('phone', p_phone_hash), ('ip', p_ip_hash);
  delete from public.otp_send_attempts where created_at < now() - interval '2 days';
  return true;
end;
$$;

-- Named, evidence-backed launch gates replace an informal checklist.
create table public.launch_control_checks (
  check_key text primary key,
  title text not null,
  category text not null check (category in ('security', 'operations', 'finance', 'legal', 'reliability', 'quality')),
  status text not null default 'blocked' check (status in ('blocked', 'in_progress', 'passed')),
  evidence_note text check (evidence_note is null or char_length(evidence_note) <= 1000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.launch_control_checks(check_key, title, category) values
  ('staging-migrations', 'Staging migrations and rollback tested', 'reliability'),
  ('rls-role-matrix', 'Customer, vendor, rider and platform RLS matrix passed', 'security'),
  ('sms-delivery', 'SMS provider, retries and delivery receipts tested', 'reliability'),
  ('rider-verification', 'Rider identity and licence evidence verified', 'operations'),
  ('cod-reconciliation', 'End-to-end COD handover reconciled to the paisa', 'finance'),
  ('support-rota', 'Named support, dispatch and incident rota active', 'operations'),
  ('backup-restore', 'Backup restore and rollback drill completed', 'reliability'),
  ('pakistan-legal', 'Pakistan terms, privacy and refund wording approved', 'legal'),
  ('domain-contact', 'First-party domain and company contact details approved', 'legal'),
  ('device-accessibility', 'Real-device, low-bandwidth and accessibility QA passed', 'quality');

alter table public.launch_control_checks enable row level security;
create policy launch_control_staff_select on public.launch_control_checks
for select to authenticated using (public.is_platform_staff(array['support', 'operations', 'admin']));
revoke all on public.launch_control_checks from anon, authenticated;
grant select on public.launch_control_checks to authenticated;

create or replace function public.ops_review_rider_document(
  p_document_id uuid, p_status text, p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_application_id uuid;
begin
  if not public.is_platform_staff(array['operations', 'admin'])
    then raise exception 'Not authorised'; end if;
  if p_status not in ('verified', 'rejected') then raise exception 'Invalid document status'; end if;
  if p_status = 'rejected' and char_length(trim(coalesce(p_note, ''))) < 4
    then raise exception 'Rejection reason required'; end if;
  update public.rider_verification_documents set status = p_status,
    review_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_document_id returning rider_application_id into v_application_id;
  if v_application_id is null then raise exception 'Verification document not found'; end if;
  update public.rider_applications r set verification_status = case
    when exists (select 1 from public.rider_verification_documents d
      where d.rider_application_id = r.id and d.status = 'rejected') then 'rejected'
    when (select count(*) from public.rider_verification_documents d
      where d.rider_application_id = r.id and d.status = 'verified'
        and d.document_kind in ('cnic_front', 'cnic_back')) = 2
      and (r.vehicle_type = 'bicycle' or exists (
        select 1 from public.rider_verification_documents d
        where d.rider_application_id = r.id and d.document_kind = 'licence_front' and d.status = 'verified'
      )) then 'verified'
    else 'in_review' end,
    updated_at = now() where r.id = v_application_id;
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
      select 1 from public.rider_applications where id = p_application_id
        and has_valid_licence and verification_status = 'verified'
    ) then raise exception 'Verified identity and required licence evidence are required before approval'; end if;
    update public.rider_applications set status = p_status,
      verification_status = case when p_status = 'screening' and verification_status = 'not_started'
        then 'documents_required' else verification_status end,
      review_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = p_application_id;
  else raise exception 'Invalid application kind'; end if;
  if not found then raise exception 'Application not found'; end if;
end;
$$;

create or replace function public.ops_update_launch_check(
  p_check_key text, p_status text, p_evidence_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_staff(array['operations', 'admin'])
    then raise exception 'Not authorised'; end if;
  if p_status not in ('blocked', 'in_progress', 'passed') then raise exception 'Invalid check status'; end if;
  if p_status = 'passed' and char_length(trim(coalesce(p_evidence_note, ''))) < 8
    then raise exception 'Evidence note required before passing a launch gate'; end if;
  update public.launch_control_checks set status = p_status,
    evidence_note = nullif(trim(p_evidence_note), ''), reviewed_by = auth.uid(),
    reviewed_at = now(), updated_at = now() where check_key = p_check_key;
  if not found then raise exception 'Launch check not found'; end if;
end;
$$;

create or replace function public.ops_phase4b_snapshot()
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
    'verification_documents', case when public.is_platform_staff(array['operations', 'admin'])
      then coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'rider_application_id', d.rider_application_id,
        'applicant_id', d.applicant_id, 'document_kind', d.document_kind,
        'object_path', d.object_path, 'status', d.status, 'review_note', d.review_note,
        'created_at', d.created_at
      ) order by d.created_at) from public.rider_verification_documents d), '[]'::jsonb)
      else '[]'::jsonb end,
    'cod_reconciliation', case when public.is_platform_staff(array['operations', 'admin'])
      then coalesce((select jsonb_agg(jsonb_build_object(
        'id', j.id, 'reference', o.reference, 'rider_id', j.rider_id,
        'rider_name', r.full_name, 'cash_collected_paisa', j.cash_collected_paisa,
        'cod_status', j.cod_status, 'completed_at', j.completed_at
      ) order by j.completed_at) from public.delivery_jobs j
        join public.orders o on o.id = j.order_id
        left join public.rider_applications r on r.applicant_id = j.rider_id
        where j.status = 'delivered' and j.cod_status in ('collected', 'disputed')), '[]'::jsonb)
      else '[]'::jsonb end,
    'notification_health', jsonb_build_object(
      'queued', (select count(*) from public.notification_outbox where status in ('pending', 'failed')),
      'sending', (select count(*) from public.notification_outbox where status = 'sending'),
      'dead_letter', (select count(*) from public.notification_outbox where status = 'dead_letter')
    ),
    'launch_checks', coalesce((select jsonb_agg(to_jsonb(c) order by c.category, c.title)
      from public.launch_control_checks c), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.rider_register_verification_document(text, text, text, bigint) from public;
revoke all on function public.ops_reconcile_cod_job(uuid, bigint, text) from public;
revoke all on function public.ops_assign_delivery(uuid, uuid) from public;
revoke all on function public.service_claim_notification_batch(integer) from public;
revoke all on function public.service_complete_notification(uuid, boolean, text, text) from public;
revoke all on function public.service_reserve_otp_send(text, text) from public;
revoke all on function public.ops_review_rider_document(uuid, text, text) from public;
revoke all on function public.ops_update_launch_check(text, text, text) from public;
revoke all on function public.ops_phase4b_snapshot() from public;

grant execute on function public.rider_register_verification_document(text, text, text, bigint) to authenticated;
grant execute on function public.ops_reconcile_cod_job(uuid, bigint, text) to authenticated;
grant execute on function public.ops_assign_delivery(uuid, uuid) to authenticated;
grant execute on function public.service_claim_notification_batch(integer) to service_role;
grant execute on function public.service_complete_notification(uuid, boolean, text, text) to service_role;
grant execute on function public.service_reserve_otp_send(text, text) to service_role;
grant execute on function public.ops_review_rider_document(uuid, text, text) to authenticated;
grant execute on function public.ops_update_launch_check(text, text, text) to authenticated;
grant execute on function public.ops_phase4b_snapshot() to authenticated;

commit;
