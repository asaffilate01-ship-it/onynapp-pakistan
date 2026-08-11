# Supabase pilot backend

The migration creates the minimum food-ordering pilot model, server-priced COD order RPC, vendor state transitions, audit/event records and row-level security.

Apply it first to a new staging project:

```sh
supabase link --project-ref YOUR_STAGING_PROJECT_REF
supabase db push
```

Configure the SMS provider and add only the public project URL and publishable/anon key to the deployment environment. Never expose the service-role key in a `VITE_*` variable.

Before production, add automated database tests using separate customer and vendor JWTs. They must prove cross-customer and cross-restaurant denial, client price protection, idempotency, invalid transition rejection and immediate suspension enforcement.

No production seed accounts or fixed passwords are included.
