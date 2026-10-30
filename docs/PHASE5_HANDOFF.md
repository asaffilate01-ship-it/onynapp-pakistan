# Phase 5 handoff — brand, navigation and retention

Date: 12 August 2026

## Outcome

Phase 5 combines the UK Onyn site's strongest brand and journey patterns with the Pakistan build's controlled-launch architecture. Estimated source readiness moves from 74% to 78%. This is not a live-readiness certification: real ordering stays blocked until staging, SMS, operational, legal, monitoring and launch-gate evidence is accepted.

## Delivered

- New responsive Onyn Pakistan marketing homepage using owned Onyn visual assets
- Dedicated `/order` route for the existing end-to-end customer marketplace
- Dedicated `/for-business` conversion and controlled-onboarding journey
- Honest feature/status labels for Order, Partner, Rider and POS
- Persistent authenticated restaurant favourites
- Verified-order ratings and moderated optional review text
- Public aggregate rating summaries with no customer or review-text exposure
- Safe repeat COD ordering through current menu, options, hours, serviceability and server prices
- Updated global navigation, mobile navigation, footer and sitemap
- Phase 5 database migration and contract tests

## Database deployment order

Apply all migrations in filename order, ending with:

`supabase/migrations/20260812103000_customer_retention.sql`

Run the denial and repeat-order scenarios in `supabase/README.md` with separate real JWTs before inviting customers.

## Validation at handoff

- ESLint: zero errors (six existing fast-refresh warnings in shared UI primitives)
- TypeScript: pass
- Vitest: 11 files, 60 tests pass
- Production build: pass
- Route smoke: 15/15 routes return HTTP 200, including `/order` and `/for-business`
- Production dependency audit: 0 vulnerabilities

## Deployment boundary

No GitHub push or live deployment is included in this package. Keep GitHub as source of truth, deploy to isolated staging first, apply the migration, seed reviewed pilot data and run end-to-end acceptance before changing the public site.

## Next launch-critical phase

1. Provision isolated Supabase staging and run cross-role database denial tests.
2. Contract and accept a Pakistan SMS provider; validate retry/dead-letter monitoring.
3. Staff support, dispatch and cash-reconciliation ownership for pilot hours.
4. Complete accessibility, low-bandwidth, backup/restore, incident and penetration-test evidence.
5. Run a four-week invite-only Lahore COD pilot before online payments or city expansion.
