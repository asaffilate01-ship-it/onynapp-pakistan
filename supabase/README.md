# Supabase pilot backend

The migrations create the minimum food-ordering pilot model, server-priced COD order RPC, protected restaurant operations, audit/event records and row-level security.

Apply them in filename order to a new staging project:

```sh
supabase link --project-ref YOUR_STAGING_PROJECT_REF
supabase db push
```

Configure the SMS provider and add only the public project URL and publishable/anon key to the deployment environment. Never expose the service-role key in a `VITE_*` variable.

Before production, add automated database tests using separate customer and vendor JWTs. They must prove cross-customer and cross-restaurant denial, client price protection, idempotency, invalid transition rejection and immediate suspension enforcement.

The Phase 3A migration adds protected branch capacity settings, menu availability, ready-order hand-off and audit events. Test at least three identities in staging:

1. An owner can update branch operations and menu availability.
2. A kitchen member can progress assigned-branch orders but cannot update another branch.
3. A customer and an unrelated restaurant member are denied every vendor mutation.

No production seed accounts or fixed passwords are included.
