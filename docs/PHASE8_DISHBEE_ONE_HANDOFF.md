# Dishbee+ Pakistan Phase 8 — signed Dishbee One order handoff

Date: 30 October 2026

## Outcome

Phase 8 replaces the one-shot marketplace-to-EPOS POST with a durable, signed and idempotent order bridge. Dishbee+ remains the Pakistan marketplace order source. Dishbee One remains the restaurant EPOS/KDS, till and payment/refund authority.

Reference baselines checked before implementation:

- `asaffilate01-ship-it/onyn` main at `382b6dee123c78a2f84e62e73d24710e01e9be35`, especially `supabase/functions/dishbee-order-handoff/index.ts`.
- `asaffilate01-ship-it/dishbee-helper` main at `4a267048b485aa7e8eef91e7341e86ae8e74ab7f`, including its canonical Omniqora handoff reconciliation and duplicate-create boundary.

## What is implemented

### Dishbee+ brand refresh

- Replaced the remaining Onyn purple interface palette with Dishbee near-black/navy, golden yellow, white and warm neutral states across customer, vendor, rider, operations and marketing surfaces.
- Replaced the placeholder Onyn/letter marks with the approved Dishbee bee-and-cloche symbol and the Dishbee+ wordmark.
- Updated the favicon, installable PWA icon, browser theme colour, manifest background and public readiness identity.
- Renamed public platform artwork references from Onyn to Dishbee and moved the former Onyn marks outside the served application.
- Added an automated regression check that rejects purple brand colours and a public Onyn icon.

### Dishbee One handoff

- One immutable outbox identity per Dishbee+ order and Dishbee One integration.
- Stable UUID idempotency key reused across every automated and manual retry.
- Branch, menu-item and modifier-option mapping gates; missing mappings block the handoff without blocking the customer order.
- Payload snapshot using the current Onyn connector field names, with explicit `PKR` and `paisa` metadata.
- Server-only bearer token plus HMAC-SHA256 signature over `timestamp + "." + exact request body`.
- SHA-256 body digest, schema header and product/source header.
- Lease-based worker claims using `FOR UPDATE SKIP LOCKED`.
- Exponential retry from 30 seconds to one hour, then dead-letter after eight attempts.
- Conservative conflict handling: HTTP 409 is accepted only when Dishbee One confirms an existing/duplicate order or returns the provider order ID.
- Explicit acknowledgement timestamp and provider order ID.
- Cancellation guard before first dispatch.
- Private operations health board with blocked, queued, acknowledged and dead-letter states.
- Manual rebuild/retry after mapping repair, preserving the original idempotency key.
- A Dishbee One receiver overlay based on main, with raw-body HMAC verification, replay protection, atomic receipts and Pakistan COD semantics.

The bridge does not place connector credentials in `VITE_` variables, URLs, browser storage or client requests. The operations snapshot excludes the handoff payload and customer PII.

## Database deployment

Apply migrations in filename order, ending with:

```text
supabase/migrations/20261030120000_dishbee_one_order_handoff.sql
```

The migration backfills prior placed orders. Orders without an enabled branch link or a complete menu mapping appear as `blocked`; they are not dispatched.

Create branch and menu mappings through a controlled service-role import or migration, never a public browser mutation:

```sql
insert into public.dishbee_one_branch_links(branch_id, link_id)
values ('<dishbee-plus-branch-uuid>', '<dishbee-one-link-uuid>');

insert into public.dishbee_one_menu_item_links(menu_item_id, branch_id, dishbee_item_id)
values ('<dishbee-plus-item-uuid>', '<dishbee-plus-branch-uuid>', '<dishbee-one-item-uuid>');

insert into public.dishbee_one_menu_option_links(menu_option_id, branch_id, dishbee_option_id)
values ('<dishbee-plus-option-uuid>', '<dishbee-plus-branch-uuid>', '<dishbee-one-option-uuid>');
```

Use the operations board to rebuild blocked rows after the complete mapping set is loaded.

## Worker configuration

Deploy `dispatch-dishbee-one-orders` and set these server-side secrets:

```text
CRON_SECRET
DISHBEE_ONE_HANDOFF_URL
DISHBEE_ONE_CONNECTOR_TOKEN
DISHBEE_ONE_HANDOFF_SECRET
```

Use separate random values for the cron secret, bearer token and HMAC secret. The HMAC secret should contain at least 32 random bytes. Invoke the worker from the approved scheduler with `POST` and `x-cron-secret`; a one-minute cadence is suitable for staging.

## Dishbee One receiver

The ready-to-apply receiver overlay is in `integrations/dishbee-one-receiver`. It is based on the existing native Dishbee+ channel in Dishbee main rather than introducing a parallel order importer. Rebase and validate that overlay in the Dishbee repository before merge.

The receiver contract requires:

Before enabling live dispatch, the Dishbee One endpoint must:

1. Read the raw request body without reserialising it.
2. Reject timestamps outside an agreed replay window (recommended: five minutes).
3. Recompute SHA-256 and compare it with `x-dishbee-plus-payload-sha256` using constant-time comparison.
4. Recompute HMAC-SHA256 over `<timestamp>.<raw-body>` and compare `v1=<hex>` using constant-time comparison.
5. Enforce a unique idempotency record for the `idempotency-key` and `externalOrderId` before creating the EPOS order.
6. Return the same provider order ID for a replay. A duplicate response may be 2xx, or 409 with `duplicate: true`, `existing: true` or a provider order ID.
7. Store the source amount as PKR minor units. Legacy connector fields ending in `Pence` carry paisa in this Pakistan schema; the explicit `currency` and `monetaryUnit` fields are authoritative.
8. Treat `paymentState: cash_due` as COD liability for the Dishbee One till. The receiver overlay releases it through Dishbee's authorised-tab KDS gate with `paid_at = null`; Dishbee+ does not assert that COD is paid.
9. Re-price every base item and mapped modifier from Dishbee's catalogue, rejecting item, modifier, subtotal or total parity failures.

## Release proof required

- Same order sent twice produces one Dishbee One order and the same provider order ID.
- Timeout after Dishbee One commit can be retried without a second order.
- Invalid signature, altered body, stale timestamp and wrong bearer token are rejected.
- An unmapped item stays blocked and becomes dispatchable only after a correct mapping and manual rebuild.
- Two workers cannot claim the same handoff concurrently.
- A pre-dispatch cancelled/rejected order becomes `cancelled` and is never released.
- Eight failed attempts enter dead-letter; an operator can repair the cause and retry with the original idempotency key.
- Operations/support roles can see health without seeing the customer payload; only operations/admin can retry.
- COD remains unreconciled until Dishbee One/rider/till evidence completes the existing cash flow.

## Intentionally not included

- Reverse status sync from Dishbee One KDS to Dishbee+ customer tracking.
- Menu/catalog synchronisation and automatic mapping.
- Online payment capture, refund or settlement.
- Production scheduler, secrets, deployment or live endpoint enablement.

Those need staging evidence and the Dishbee One receiver implementation before public orders are enabled.
