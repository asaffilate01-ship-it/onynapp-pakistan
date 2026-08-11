# Supabase pilot backend

The migrations create the minimum food-ordering pilot model, server-priced COD order RPC, branch-specific serviceability, protected customer tracking/cancellation, restaurant operations, audit/event records and row-level security.

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
