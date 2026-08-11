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
