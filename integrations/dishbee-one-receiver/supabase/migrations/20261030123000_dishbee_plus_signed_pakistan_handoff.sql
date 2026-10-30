begin;

-- Receiver-side boundary for signed Dishbee+ Pakistan orders. This keeps
-- Dishbee authoritative for menu prices, modifiers, KDS and till state.
create table public.dishbee_plus_handoff_receipts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  link_id uuid not null references public.dishbee_plus_links(id) on delete restrict,
  external_order_id text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  order_id uuid references public.orders(id) on delete restrict,
  payment_state text not null check (payment_state in ('cash_due', 'provider_verified')),
  status text not null default 'processing' check (status in ('processing', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (link_id, external_order_id),
  check ((status = 'completed') = (order_id is not null and completed_at is not null))
);

alter table public.dishbee_plus_handoff_receipts enable row level security;
create policy "dishbee plus receipt tenant read" on public.dishbee_plus_handoff_receipts
for select to authenticated using (
  public.is_platform_admin() or exists (
    select 1 from public.dishbee_plus_links link
    where link.id = public.dishbee_plus_handoff_receipts.link_id
      and public.can_manage_tenant(link.tenant_id)
  )
);
revoke all on public.dishbee_plus_handoff_receipts from public, anon, authenticated;
grant select on public.dishbee_plus_handoff_receipts to authenticated;
grant select, insert, update on public.dishbee_plus_handoff_receipts to service_role;

create or replace function public.server_ingest_dishbee_plus_order_v2(
  p_link uuid,
  p_idempotency_key uuid,
  p_payload_hash text,
  p_external_order_id text,
  p_customer_name text,
  p_customer_phone text,
  p_fulfilment public.fulfilment_type,
  p_lines jsonb,
  p_subtotal_pence integer,
  p_delivery_pence integer,
  p_total_pence integer,
  p_currency text,
  p_monetary_unit text,
  p_payment_state text,
  p_payment_reference text default null,
  p_delivery_address jsonb default null,
  p_vehicle jsonb default null,
  p_raw jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp set lock_timeout = '5s'
as $$
declare
  v_link public.dishbee_plus_links%rowtype;
  v_receipt public.dishbee_plus_handoff_receipts%rowtype;
  v_order uuid;
  v_legacy_order uuid;
  v_legacy_paid_at timestamptz;
  v_line jsonb;
  v_modifier jsonb;
  v_item public.menu_items%rowtype;
  v_option public.modifier_options%rowtype;
  v_qty integer;
  v_unit integer;
  v_modifier_total integer;
  v_calc_subtotal integer := 0;
  v_service_fee integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_idempotency_key is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_dishbee_plus_idempotency';
  end if;
  if upper(coalesce(p_currency, '')) <> 'PKR' or lower(coalesce(p_monetary_unit, '')) <> 'paisa' then
    raise exception 'dishbee_plus_currency_not_supported';
  end if;
  if p_payment_state not in ('cash_due', 'provider_verified') then
    raise exception 'invalid_dishbee_plus_payment_state';
  end if;
  if p_payment_state = 'provider_verified' and nullif(trim(p_payment_reference), '') is null then
    raise exception 'provider_payment_reference_required';
  end if;
  if nullif(trim(p_external_order_id), '') is null then raise exception 'external_order_id_required'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) < 1
    or jsonb_array_length(p_lines) > 250 then raise exception 'invalid_dishbee_plus_lines'; end if;

  select * into v_link from public.dishbee_plus_links
  where id = p_link and status = 'live' and order_sync_enabled;
  if not found then raise exception 'dishbee_plus_link_not_live'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'dishbee-plus:' || p_link::text || ':' || trim(p_external_order_id), 0
  ));

  select * into v_receipt from public.dishbee_plus_handoff_receipts
  where idempotency_key = p_idempotency_key
     or (link_id = p_link and external_order_id = trim(p_external_order_id))
  order by case when idempotency_key = p_idempotency_key then 0 else 1 end
  limit 1 for update;
  if found then
    if v_receipt.idempotency_key <> p_idempotency_key
      or v_receipt.link_id <> p_link
      or v_receipt.external_order_id <> trim(p_external_order_id)
      or v_receipt.payload_hash <> lower(p_payload_hash)
      or v_receipt.payment_state <> p_payment_state then
      raise exception 'dishbee_plus_idempotency_conflict';
    end if;
    if v_receipt.status = 'completed' then
      return jsonb_build_object(
        'orderId', v_receipt.order_id, 'providerOrderId', v_receipt.order_id,
        'duplicate', true, 'existing', true, 'paymentState', v_receipt.payment_state
      );
    end if;
    raise exception 'dishbee_plus_handoff_in_progress';
  end if;

  -- Adopt an order created by the legacy bearer-only path without duplicating it.
  select reference.order_id, existing_order.paid_at into v_legacy_order, v_legacy_paid_at
  from public.external_order_refs reference
  join public.orders existing_order on existing_order.id = reference.order_id
  where reference.tenant_id = v_link.tenant_id and reference.provider = 'dishbee_plus'
    and reference.external_order_id = trim(p_external_order_id);
  if v_legacy_order is not null then
    if p_payment_state = 'cash_due' and v_legacy_paid_at is not null then
      raise exception 'legacy_dishbee_plus_order_requires_reconciliation';
    end if;
    insert into public.dishbee_plus_handoff_receipts(
      idempotency_key, link_id, external_order_id, payload_hash, order_id,
      payment_state, status, completed_at
    ) values (
      p_idempotency_key, p_link, trim(p_external_order_id), lower(p_payload_hash),
      v_legacy_order, p_payment_state, 'completed', now()
    );
    return jsonb_build_object(
      'orderId', v_legacy_order, 'providerOrderId', v_legacy_order,
      'duplicate', true, 'existing', true, 'paymentState', p_payment_state
    );
  end if;

  insert into public.dishbee_plus_handoff_receipts(
    idempotency_key, link_id, external_order_id, payload_hash, payment_state
  ) values (
    p_idempotency_key, p_link, trim(p_external_order_id), lower(p_payload_hash), p_payment_state
  ) returning * into v_receipt;

  v_service_fee := coalesce(nullif(p_raw ->> 'serviceFeePaisa', '')::integer, 0);
  if coalesce(p_delivery_pence, 0) < 0 or v_service_fee < 0 then
    raise exception 'invalid_dishbee_plus_fees';
  end if;

  insert into public.orders(
    tenant_id, location_id, status, fulfilment, source, payment_method,
    customer_name, customer_phone, delivery_address, vehicle, delivery_pence,
    payment_reference, paid_at
  ) values (
    v_link.tenant_id, v_link.location_id,
    case when p_payment_state = 'cash_due' then 'authorised_tab'::public.order_status
      else 'paid'::public.order_status end,
    p_fulfilment, 'dishbee-plus', 'dishbee_plus',
    nullif(trim(p_customer_name), ''), nullif(trim(p_customer_phone), ''),
    p_delivery_address, p_vehicle, greatest(coalesce(p_delivery_pence, 0), 0),
    nullif(trim(p_payment_reference), ''),
    case when p_payment_state = 'provider_verified' then now() else null end
  ) returning id into v_order;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    select * into v_item from public.menu_items
    where id = nullif(v_line ->> 'dishbeeItemId', '')::uuid
      and tenant_id = v_link.tenant_id and active;
    if not found then raise exception 'dishbee_plus_item_not_found'; end if;
    if v_link.brand_id is not null and v_item.brand_id is distinct from v_link.brand_id then
      raise exception 'dishbee_plus_item_brand_mismatch';
    end if;
    if v_item.brand_id is not null and not exists (
      select 1 from public.location_brands location_brand
      where location_brand.location_id = v_link.location_id
        and location_brand.brand_id = v_item.brand_id and location_brand.active
    ) then raise exception 'dishbee_plus_item_not_available_at_location'; end if;

    v_qty := coalesce(nullif(v_line ->> 'quantity', '')::integer, 0);
    if v_qty < 1 or v_qty > 100 then raise exception 'invalid_dishbee_plus_quantity'; end if;
    v_unit := public.channel_price(v_item.id, 'dishbee-plus');
    v_modifier_total := 0;
    if jsonb_typeof(coalesce(v_line -> 'modifiers', '[]'::jsonb)) is distinct from 'array' then
      raise exception 'invalid_dishbee_plus_modifiers';
    end if;
    for v_modifier in select value from jsonb_array_elements(coalesce(v_line -> 'modifiers', '[]'::jsonb))
    loop
      select option.* into v_option
      from public.modifier_options option
      join public.menu_item_modifier_groups item_group on item_group.group_id = option.group_id
      where option.id = nullif(v_modifier ->> 'dishbeeOptionId', '')::uuid
        and option.tenant_id = v_link.tenant_id and option.active
        and item_group.item_id = v_item.id and item_group.tenant_id = v_link.tenant_id;
      if not found then raise exception 'dishbee_plus_modifier_not_found'; end if;
      if nullif(v_modifier ->> 'priceDeltaPence', '')::integer is distinct from v_option.price_delta_pence then
        raise exception 'dishbee_plus_modifier_price_parity_failed';
      end if;
      v_modifier_total := v_modifier_total + v_option.price_delta_pence;
    end loop;
    v_unit := v_unit + v_modifier_total;
    if v_unit < 0 or nullif(v_line ->> 'unitPricePence', '')::integer is distinct from v_unit then
      raise exception 'dishbee_plus_price_parity_failed';
    end if;
    v_calc_subtotal := v_calc_subtotal + (v_unit * v_qty);

    insert into public.order_items(
      tenant_id, order_id, brand_id, menu_item_id, item_name, quantity,
      unit_price_pence, modifiers, notes
    ) values (
      v_link.tenant_id, v_order, v_item.brand_id, v_item.id, v_item.name, v_qty,
      v_unit, coalesce(v_line -> 'modifiers', '[]'::jsonb), v_line ->> 'notes'
    );
  end loop;

  if p_subtotal_pence is distinct from v_calc_subtotal then
    raise exception 'dishbee_plus_subtotal_parity_failed';
  end if;
  if p_total_pence is distinct from v_calc_subtotal + coalesce(p_delivery_pence, 0) + v_service_fee then
    raise exception 'dishbee_plus_total_parity_failed';
  end if;

  update public.orders set subtotal_pence = v_calc_subtotal, total_pence = p_total_pence where id = v_order;
  insert into public.external_order_refs(
    tenant_id, provider, external_order_id, order_id, payload_hash
  ) values (
    v_link.tenant_id, 'dishbee_plus', trim(p_external_order_id), v_order, lower(p_payload_hash)
  );
  perform public.release_order_to_kds(v_order);

  update public.dishbee_plus_handoff_receipts set
    order_id = v_order, status = 'completed', completed_at = now()
  where id = v_receipt.id;
  update public.dishbee_plus_links set last_sync_at = now(), last_error = null, updated_at = now()
  where id = p_link;

  return jsonb_build_object(
    'orderId', v_order, 'providerOrderId', v_order,
    'duplicate', false, 'existing', false, 'paymentState', p_payment_state
  );
end;
$$;

revoke all on function public.server_ingest_dishbee_plus_order_v2(
  uuid, uuid, text, text, text, text, public.fulfilment_type, jsonb,
  integer, integer, integer, text, text, text, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.server_ingest_dishbee_plus_order_v2(
  uuid, uuid, text, text, text, text, public.fulfilment_type, jsonb,
  integer, integer, integer, text, text, text, text, jsonb, jsonb, jsonb
) to service_role;

commit;
