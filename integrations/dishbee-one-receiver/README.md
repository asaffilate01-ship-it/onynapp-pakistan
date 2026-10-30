# Dishbee One receiver overlay

Baseline: `asaffilate01-ship-it/dishbee-helper` main commit `4a267048b485aa7e8eef91e7341e86ae8e74ab7f`.

This directory contains the receiver-side Phase 8 files to apply to Dishbee One after rebasing against the current main branch:

- Replace `src/routes/api.connectors.marketplace.ts` with the supplied route.
- Add `src/server/dishbee-plus-handoff-auth.ts`.
- Add and apply `supabase/migrations/20261030123000_dishbee_plus_signed_pakistan_handoff.sql` after the existing `20261003195000_dishbee_plus_channel.sql` migration.

Set `DISHBEE_PLUS_HANDOFF_SECRET` to the same minimum-32-byte secret used by the Dishbee+ sender. Keep the existing `DISHBEE_PLUS_CONNECTOR_TOKEN` as a separate bearer credential.

The overlay deliberately changes the current receiver behavior:

- HMAC, body digest, five-minute replay window and stable idempotency key are mandatory.
- PKR/paisa is explicit.
- `cash_due` becomes `authorised_tab` for KDS release with `paid_at = null`; it is not falsely captured as paid.
- `provider_verified` requires a payment reference.
- Dishbee re-prices base items and mapped modifier options and rejects any subtotal/total mismatch.
- The receipt ledger and transaction-scoped advisory lock make retries return the same Dishbee order.

Do not enable the production endpoint until the migration, route tests, two-worker concurrency test and lost-response retry test have passed in Dishbee staging.
