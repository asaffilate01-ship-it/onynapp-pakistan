begin;

-- Dishbee+ remains the marketplace order source. Dishbee One is the restaurant
-- EPOS/KDS and till authority. Browser code never receives either connector secret.
create table public.dishbee_one_branch_links (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  link_id uuid not null unique,
  status text not null default 'enabled' check (status in ('enabled', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dishbee_one_menu_item_links (
  menu_item_id uuid primary key references public.menu_items(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  dishbee_item_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, dishbee_item_id)
);

create table public.dishbee_one_menu_option_links (
  menu_option_id uuid primary key references public.menu_options(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  dishbee_option_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, dishbee_option_id)
);

create table public.dishbee_one_order_handoffs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  integration text not null default 'dishbee_one' check (integration = 'dishbee_one'),
  idempotency_key uuid not null default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('blocked', 'pending', 'sending', 'retrying', 'acknowledged', 'dead_letter', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  last_http_status integer,
  last_error text,
  response_excerpt jsonb not null default '{}'::jsonb,
  provider_order_id text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, integration),
  unique (idempotency_key),
  check ((status = 'acknowledged') = (acknowledged_at is not null))
);

create index dishbee_one_handoffs_dispatch_idx
  on public.dishbee_one_order_handoffs(status, next_attempt_at)
  where status in ('pending', 'retrying');
create index dishbee_one_handoffs_branch_created_idx
  on public.dishbee_one_order_handoffs(branch_id, created_at desc);

alter table public.dishbee_one_branch_links enable row level security;
alter table public.dishbee_one_menu_item_links enable row level security;
alter table public.dishbee_one_menu_option_links enable row level security;
alter table public.dishbee_one_order_handoffs enable row level security;

create policy dishbee_one_links_ops_read on public.dishbee_one_branch_links
for select to authenticated using (public.is_platform_staff(array['operations', 'admin']));
create policy dishbee_one_item_links_ops_read on public.dishbee_one_menu_item_links
for select to authenticated using (public.is_platform_staff(array['operations', 'admin']));
create policy dishbee_one_option_links_ops_read on public.dishbee_one_menu_option_links
for select to authenticated using (public.is_platform_staff(array['operations', 'admin']));
create policy dishbee_one_handoffs_ops_read on public.dishbee_one_order_handoffs
for select to authenticated using (public.is_platform_staff(array['operations', 'admin']));

revoke all on public.dishbee_one_branch_links, public.dishbee_one_menu_item_links,
  public.dishbee_one_menu_option_links,
  public.dishbee_one_order_handoffs from anon, authenticated;
grant select on public.dishbee_one_branch_links, public.dishbee_one_menu_item_links,
  public.dishbee_one_menu_option_links,
  public.dishbee_one_order_handoffs to authenticated;
grant select, insert, update on public.dishbee_one_branch_links,
  public.dishbee_one_menu_item_links, public.dishbee_one_menu_option_links,
  public.dishbee_one_order_handoffs to service_role;

create or replace function public.dishbee_one_order_block_reason(p_order_id uuid)
returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return 'Order not found'; end if;
  if not exists (
    select 1 from public.dishbee_one_branch_links
    where branch_id = v_order.branch_id and status = 'enabled'
  ) then return 'Dishbee One branch link is not enabled'; end if;
  if not exists (select 1 from public.order_lines where order_id = p_order_id)
    then return 'Order has no lines'; end if;
  if exists (
    select 1 from public.order_lines l
    left join public.dishbee_one_menu_item_links m
      on m.menu_item_id = l.menu_item_id and m.branch_id = v_order.branch_id
    where l.order_id = p_order_id and m.menu_item_id is null
  ) then return 'One or more menu items are not mapped to Dishbee One'; end if;
  if exists (
    select 1 from public.order_line_options selected
    join public.order_lines line on line.id = selected.order_line_id
    left join public.dishbee_one_menu_option_links option_link
      on option_link.menu_option_id = selected.option_id
      and option_link.branch_id = v_order.branch_id
    where line.order_id = p_order_id and selected.option_id is not null
      and option_link.menu_option_id is null
  ) then return 'One or more menu options are not mapped to Dishbee One'; end if;
  return null;
end;
$$;

create or replace function public.dishbee_one_order_payload(p_order_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'action', 'dishbee_plus_order',
    'schemaVersion', 1,
    'source', 'dishbee-plus-pakistan',
    'linkId', link.link_id,
    'externalOrderId', o.id::text,
    'externalReference', o.reference,
    'customerName', coalesce(p.display_name, ''),
    'customerPhone', coalesce(p.phone_e164, ''),
    'fulfilment', case when o.fulfilment = 'collection' then 'pickup' else 'delivery' end,
    'currency', o.currency,
    'monetaryUnit', 'paisa',
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dishbeeItemId', item_link.dishbee_item_id,
        'quantity', line.quantity,
        'unitPricePence', line.unit_price_paisa,
        'name', line.item_name,
        'modifiers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'dishbeeOptionId', option_link.dishbee_option_id,
            'groupName', option_line.group_name,
            'optionName', option_line.option_name,
            'priceDeltaPence', option_line.price_delta_paisa
          ) order by option_line.group_name, option_line.option_name)
          from public.order_line_options option_line
          join public.dishbee_one_menu_option_links option_link
            on option_link.menu_option_id = option_line.option_id
            and option_link.branch_id = o.branch_id
          where option_line.order_line_id = line.id
        ), '[]'::jsonb)
      ) order by line.id)
      from public.order_lines line
      join public.dishbee_one_menu_item_links item_link
        on item_link.menu_item_id = line.menu_item_id and item_link.branch_id = o.branch_id
      where line.order_id = o.id
    ), '[]'::jsonb),
    'subtotalPence', o.subtotal_paisa,
    'deliveryPence', o.delivery_fee_paisa,
    'totalPence', o.total_paisa,
    'deliveryAddress', case when o.fulfilment = 'delivery' then jsonb_build_object(
      'addressLine', a.address_line,
      'landmark', a.landmark,
      'city', a.city,
      'deliveryNote', a.delivery_note,
      'latitude', a.latitude,
      'longitude', a.longitude
    ) else null end,
    'raw', jsonb_build_object(
      'dishbeePlusOrderId', o.id,
      'branchId', o.branch_id,
      'branchName', b.name,
      'paymentMethod', o.payment_method,
      'paymentState', case when o.payment_method = 'cod' then 'cash_due' else 'provider_verified' end,
      'serviceFeePaisa', o.service_fee_paisa,
      'customerNote', o.customer_note,
      'placedAt', o.placed_at
    )
  ))
  from public.orders o
  join public.branches b on b.id = o.branch_id
  join public.dishbee_one_branch_links link on link.branch_id = o.branch_id
  left join public.profiles p on p.id = o.customer_id
  left join public.addresses a on a.id = o.address_id
  where o.id = p_order_id;
$$;

create or replace function public.queue_dishbee_one_handoff(p_order_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_reason text;
  v_id uuid;
  v_payload jsonb;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  v_reason := public.dishbee_one_order_block_reason(p_order_id);
  if v_reason is null then
    v_payload := public.dishbee_one_order_payload(p_order_id);
  else
    v_payload := jsonb_build_object(
      'action', 'dishbee_plus_order', 'schemaVersion', 1,
      'source', 'dishbee-plus-pakistan', 'externalOrderId', p_order_id::text,
      'externalReference', v_order.reference
    );
  end if;
  insert into public.dishbee_one_order_handoffs(
    order_id, branch_id, status, payload, last_error
  ) values (
    p_order_id, v_order.branch_id,
    case when v_reason is null then 'pending' else 'blocked' end,
    v_payload, v_reason
  )
  on conflict (order_id, integration) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.dishbee_one_order_handoffs
    where order_id = p_order_id and integration = 'dishbee_one';
  end if;
  return v_id;
end;
$$;

create or replace function public.enqueue_dishbee_one_order_event()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.to_status = 'placed' and new.from_status is null then
    perform public.queue_dishbee_one_handoff(new.order_id);
  end if;
  return new;
end;
$$;

create trigger enqueue_dishbee_one_order_handoff
after insert on public.order_events
for each row execute function public.enqueue_dishbee_one_order_event();

-- Claiming uses a lease so a crashed worker can be recovered. A terminal local
-- cancellation is never released as a new EPOS order.
create or replace function public.service_claim_dishbee_one_handoffs(p_limit integer default 20)
returns table (id uuid, idempotency_key uuid, payload jsonb)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'Invalid batch size'; end if;
  update public.dishbee_one_order_handoffs
    set status = 'retrying', lease_until = null, next_attempt_at = now(),
      last_error = 'Worker lease expired before acknowledgement', updated_at = now()
    where status = 'sending' and lease_until < now();
  update public.dishbee_one_order_handoffs h
    set status = 'cancelled', lease_until = null, updated_at = now(),
      last_error = 'Local order ended before Dishbee One dispatch'
    from public.orders o
    where o.id = h.order_id and h.status in ('pending', 'retrying')
      and o.status in ('rejected', 'cancelled');
  return query
  with candidates as (
    select h.id from public.dishbee_one_order_handoffs h
    where h.status in ('pending', 'retrying') and h.next_attempt_at <= now()
    order by h.created_at
    for update skip locked
    limit p_limit
  )
  update public.dishbee_one_order_handoffs h
    set status = 'sending', attempt_count = h.attempt_count + 1,
      first_attempt_at = coalesce(h.first_attempt_at, now()), last_attempt_at = now(),
      lease_until = now() + interval '3 minutes', updated_at = now()
    from candidates c where h.id = c.id
  returning h.id, h.idempotency_key, h.payload;
end;
$$;

create or replace function public.service_complete_dishbee_one_handoff(
  p_id uuid, p_acknowledged boolean, p_http_status integer,
  p_provider_order_id text, p_response jsonb, p_error text
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_handoff public.dishbee_one_order_handoffs%rowtype;
  v_delay integer;
begin
  select * into v_handoff from public.dishbee_one_order_handoffs where id = p_id for update;
  if not found then raise exception 'Handoff not found'; end if;
  if v_handoff.status = 'acknowledged' then return; end if;
  if v_handoff.status <> 'sending' then raise exception 'Handoff is not leased to a worker'; end if;
  if p_acknowledged then
    update public.dishbee_one_order_handoffs set
      status = 'acknowledged', acknowledged_at = now(), lease_until = null,
      last_http_status = p_http_status, provider_order_id = nullif(left(trim(p_provider_order_id), 200), ''),
      response_excerpt = coalesce(p_response, '{}'::jsonb), last_error = null, updated_at = now()
      where id = p_id;
  else
    v_delay := least(3600, 30 * (2 ^ greatest(v_handoff.attempt_count - 1, 0))::integer);
    update public.dishbee_one_order_handoffs set
      status = case when attempt_count >= 8 then 'dead_letter' else 'retrying' end,
      next_attempt_at = case when attempt_count >= 8 then next_attempt_at else now() + make_interval(secs => v_delay) end,
      lease_until = null, last_http_status = p_http_status,
      response_excerpt = coalesce(p_response, '{}'::jsonb),
      last_error = left(coalesce(nullif(trim(p_error), ''), 'Dishbee One handoff failed'), 500),
      updated_at = now()
      where id = p_id;
  end if;
end;
$$;

create or replace function public.ops_retry_dishbee_one_handoff(p_handoff_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_handoff public.dishbee_one_order_handoffs%rowtype;
  v_reason text;
begin
  if not public.is_platform_staff(array['operations', 'admin'])
    then raise exception 'Not authorised'; end if;
  select * into v_handoff from public.dishbee_one_order_handoffs where id = p_handoff_id for update;
  if not found then raise exception 'Handoff not found'; end if;
  if v_handoff.status = 'acknowledged' then raise exception 'Acknowledged handoffs cannot be retried'; end if;
  if v_handoff.status = 'sending' then raise exception 'Handoff is currently leased'; end if;
  v_reason := public.dishbee_one_order_block_reason(v_handoff.order_id);
  if v_reason is not null then raise exception '%', v_reason; end if;
  update public.dishbee_one_order_handoffs set
    payload = public.dishbee_one_order_payload(v_handoff.order_id), status = 'pending',
    attempt_count = 0, next_attempt_at = now(), lease_until = null,
    last_http_status = null, last_error = null, response_excerpt = '{}'::jsonb,
    updated_at = now()
    where id = p_handoff_id;
end;
$$;

create or replace function public.ops_dishbee_one_handoff_snapshot()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_staff(array['support', 'operations', 'admin'])
    then raise exception 'Not authorised'; end if;
  return jsonb_build_object(
    'counts', jsonb_build_object(
      'blocked', (select count(*) from public.dishbee_one_order_handoffs where status = 'blocked'),
      'queued', (select count(*) from public.dishbee_one_order_handoffs where status in ('pending', 'retrying', 'sending')),
      'acknowledged', (select count(*) from public.dishbee_one_order_handoffs where status = 'acknowledged'),
      'dead_letter', (select count(*) from public.dishbee_one_order_handoffs where status = 'dead_letter')
    ),
    'recent', coalesce((select jsonb_agg(jsonb_build_object(
      'id', h.id, 'order_id', h.order_id, 'reference', o.reference,
      'branch_name', b.name, 'status', h.status, 'attempt_count', h.attempt_count,
      'last_http_status', h.last_http_status, 'last_error', h.last_error,
      'provider_order_id', h.provider_order_id, 'created_at', h.created_at,
      'acknowledged_at', h.acknowledged_at
    ) order by h.created_at desc)
      from (select * from public.dishbee_one_order_handoffs order by created_at desc limit 50) h
      join public.orders o on o.id = h.order_id
      join public.branches b on b.id = h.branch_id), '[]'::jsonb)
  );
end;
$$;

-- Backfill existing orders once. Unmapped orders become visible as blocked and
-- can be rebuilt with the same idempotency key after mappings are supplied.
do $backfill$
declare v_order_id uuid;
begin
  for v_order_id in
    select distinct e.order_id from public.order_events e
    where e.to_status = 'placed' and e.from_status is null
  loop
    perform public.queue_dishbee_one_handoff(v_order_id);
  end loop;
end
$backfill$;

revoke all on function public.dishbee_one_order_block_reason(uuid) from public;
revoke all on function public.dishbee_one_order_payload(uuid) from public;
revoke all on function public.queue_dishbee_one_handoff(uuid) from public;
revoke all on function public.enqueue_dishbee_one_order_event() from public;
revoke all on function public.service_claim_dishbee_one_handoffs(integer) from public;
revoke all on function public.service_complete_dishbee_one_handoff(uuid, boolean, integer, text, jsonb, text) from public;
revoke all on function public.ops_retry_dishbee_one_handoff(uuid) from public;
revoke all on function public.ops_dishbee_one_handoff_snapshot() from public;

grant execute on function public.service_claim_dishbee_one_handoffs(integer) to service_role;
grant execute on function public.service_complete_dishbee_one_handoff(uuid, boolean, integer, text, jsonb, text) to service_role;
grant execute on function public.ops_retry_dishbee_one_handoff(uuid) to authenticated;
grant execute on function public.ops_dishbee_one_handoff_snapshot() to authenticated;

commit;
