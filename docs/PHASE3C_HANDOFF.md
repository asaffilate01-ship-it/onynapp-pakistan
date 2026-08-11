# Phase 3C handoff — customer transaction and tracking pilot

Updated: 11 August 2026

## Delivered

- Live Lahore branch, category and menu loading from protected public catalog rows
- No silent demo fallback when a configured backend is empty or unavailable
- Honest “New / Verified pilot partner” labels instead of invented live ratings and review counts
- Sold-out and branch-pause controls reflected in the customer menu
- One-restaurant basket enforcement, fulfilment compatibility and minimum-order checks
- Customer SMS OTP session recovery and sign-out
- Saved delivery addresses that are verified against an active Lahore pilot zone
- Branch-specific serviceability enforced again inside the database on every order insert
- Server-priced, idempotent cash-on-delivery order creation with real branch and item IDs
- Protected customer order snapshots with lines, totals, events and realtime refresh
- Immediate cancellation while an order is still placed
- Auditable support-case escalation once a restaurant has accepted or started the order
- CI now runs the regression suite instead of only lint, type, build and audit gates
- Install manifest/icon, robots policy, sitemap and an honest static readiness document

## Database migration

Apply `20260811150000_customer_pilot.sql` after the Phase 3B migrations. It adds:

- `support_cases` with customer and authorised staff row-level policies
- a serviceability trigger protecting all current and future order insertion paths
- `customer_save_pilot_address`
- `customer_list_orders`
- `customer_request_cancellation`

Only authenticated callers can execute the customer RPCs. The frontend still receives only the public Supabase URL and publishable key.

For a pilot branch to accept delivery orders, seed an active `service_zones.zone_name` of `Gulberg III` or `DHA Phase 5`. The customer-facing label may include `, Lahore`; the database normalises that city suffix.

## Verification completed

- ESLint: 0 errors; six pre-existing starter Fast Refresh warnings
- TypeScript: passed
- Unit tests: 40 passed across six files
- Production build: passed
- Production dependency audit: 0 vulnerabilities

## Required staging acceptance

1. Configure a Pakistan-capable SMS provider, CAPTCHA/rate limits and OTP delivery monitoring.
2. Apply all migrations to an isolated staging project and seed only verified Lahore partners.
3. Run database integration tests with two customers and two organisations to prove cross-tenant denial.
4. Prove service-zone rejection, price tampering rejection, sold-out races and idempotent retries.
5. Exercise cancellation before and after acceptance with an operations support owner.
6. Configure alerting, backups, point-in-time recovery, support hours and incident ownership.
7. Publish approved Terms, Privacy, Refund/Cancellation and Help content on first-party routes.
8. Replace the Lovable URL in `robots.txt` and `sitemap.xml` when the first-party production domain is approved.

## Next implementation phase

Phase 3D should add branch opening/holiday hours, option groups/modifiers, customer notification delivery, staffed support tooling and vendor onboarding/import. Rider dispatch, online payments, grocery, loyalty and promotions remain gated until the COD pilot is stable and measured.

## Go-live boundary

This package is ready for an isolated staging pilot, not unrestricted public trading. Public launch still requires the acceptance evidence above plus legal, support and deployment-domain sign-off.
