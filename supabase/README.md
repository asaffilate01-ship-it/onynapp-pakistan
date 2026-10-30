# Supabase pilot backend

The migrations create the minimum food-ordering pilot model, server-priced COD order RPC, branch-specific serviceability and hours, protected customer tracking/cancellation/notifications, restaurant operations, menu modifiers, audit/event records and row-level security.

Apply them in filename order to a new staging project:

```sh
supabase link --project-ref YOUR_STAGING_PROJECT_REF
supabase db push
```

Configure the SMS provider and add only the public project URL and publishable/anon key to the deployment environment. Never expose the service-role key in a `VITE_*` variable.

Before production, add automated database tests using separate customer and vendor JWTs. They must prove cross-customer and cross-restaurant denial, client price protection, out-of-zone rejection, idempotency, invalid transition rejection, support-case isolation and immediate suspension enforcement.

The Phase 3 migrations add protected branch capacity settings, menu availability, ready-order hand-off, authenticated workspace context, active-order/address loading, realtime publication and audit events. Test at least three identities in staging:

1. An owner can update branch operations and menu availability.
2. A kitchen member can progress accepted assigned-branch orders but cannot accept/reject a new order, change branch operations or update another branch.
3. A customer and an unrelated restaurant member are denied every vendor mutation.

No production seed accounts or fixed passwords are included.

Phase 3C also requires each delivery branch to have an active `service_zones` row. Use the area-only names `Gulberg III` and/or `DHA Phase 5`; the customer label's `, Lahore` suffix is normalised by the database. A configured backend with no active branch/menu data shows an honest empty state and never substitutes demo restaurants.

Phase 3D adds `branch_hours`, `branch_closures`, menu option groups/options, immutable order option snapshots, customer notifications and a server-only delivery outbox. After applying `20260811170000_hours_modifiers_notifications.sql`:

1. An owner or manager must save all seven Pakistan-time schedule rows in `/vendor` before opening the branch.
2. Checkout will reject closed, paused and temporarily closed branches even if the customer loaded the menu earlier.
3. Add option groups/options using a reviewed migration or an onboarding/admin tool; restaurant staff can then mark individual options available or sold out.
4. In-app notifications work from database order events. `notification_outbox` is deliberately inaccessible to browser roles and still needs a trusted worker, SMS provider, retries, delivery receipts and alerting before SMS is live.
5. Test overnight hours, closure boundaries and daylight-independent `Asia/Karachi` behaviour in staging.

Phase 4A adds separately authorised platform operations, partner/rider applications, general support, manual delivery jobs, rider state transitions and audited vendor menu import. After applying `20260811190000_launch_control.sql`:

1. Add platform staff only through a service-role/admin process. Never grant platform access by adding a restaurant membership. Example reviewed seed: `insert into public.platform_staff(user_id, role) values ('AUTH_USER_UUID', 'operations');`.
2. Use separate test identities for customer, restaurant owner, kitchen, rider, support, operations and an unrelated user.
3. Prove support staff cannot see partner/rider application PII and cannot approve or dispatch.
4. Prove only approved riders can see and advance their assigned delivery jobs.
5. Prove exact COD and a proof note are required before a delivery can complete.
6. Keep CNIC/licence images out of public forms; connect an approved encrypted verification provider or restricted document workflow before rider activation.
7. Menu CSV imports accept 1–200 simple rows and are atomic. Review item names, categories and prices before import.

Phase 4B adds private rider evidence, verified-rider dispatch enforcement, an append-only COD ledger, exact cash handover, OTP abuse controls, a trusted notification worker and evidence-backed launch gates. After applying `20260811203000_launch_hardening.sql`:

1. Deploy both Edge Functions: `supabase functions deploy request-otp` and `supabase functions deploy process-notifications`.
2. Set `PUBLIC_APP_ORIGINS` to the comma-separated production/staging origins and set a random 32-byte `OTP_RATE_LIMIT_SECRET`. The browser now requests SMS OTP only through `request-otp`.
3. Configure `CRON_SECRET`, `SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN` and `SMS_SENDER_ID`. Schedule an authenticated POST to `process-notifications` every minute with `x-cron-secret`. Adapt the worker's provider request/response fields to the contracted Pakistan SMS gateway before enabling the schedule.
4. Keep `SUPABASE_SERVICE_ROLE_KEY`, gateway tokens, rate-limit salt and cron secret in Edge Function secrets only. None may use a `VITE_*` name.
5. Move a rider to `screening`; the rider must upload CNIC front/back and, for a motorbike, the driving licence. Operations must inspect and verify every required document before approval or dispatch can succeed.
6. Confirm the `rider-verification` bucket is private. Prove a customer, another rider, support staff and vendor staff cannot read its objects or metadata. Confirm operations receives only five-minute signed evidence URLs.
7. Complete one delivery with exact COD, then count the physical handover in `/ops`. Prove the collection and negative handover entries net to zero and cannot be repeated.
8. Force SMS gateway failures and prove retry scheduling, the five-attempt dead-letter transition and operations visibility. Confirm browser roles cannot claim or complete outbox rows.
9. Pass a launch check only with a traceable test result, ticket or approval in its evidence note. The seeded checks are blocked by default.

Phase 4B deliberately does not seed staff, approve riders, mark release gates passed or select an SMS provider. Those are controlled deployment and operational decisions.

Phase 5 adds private favourites, verified-order feedback and safe current-price repeat ordering. After applying `20260812103000_customer_retention.sql`:

1. Prove customer A cannot list or change customer B's favourites or reviews.
2. Prove an uncompleted order and another customer's order cannot be reviewed.
3. Confirm rating-only feedback publishes immediately, while optional written copy remains pending until an authorised moderation workflow is added.
4. Repeat a terminal order after changing an item price and prove the new server price is used; then close the branch or remove an option and prove the repeat is rejected.
5. Confirm public rating summaries never expose customer identity or written review copy.

The migration does not create fake reviews or bypass existing checkout controls. Deploy it after Phase 4B and before enabling the Phase 5 account UI.
