# Phase 4A handoff — controlled launch surfaces

Updated: 11 August 2026

## Status checked

- Built from GitHub `main` commit `2d578e7` (`Executed Phase 3D pilot`).
- Phase 4A is local in this package; it has not been pushed or deployed.
- Current source readiness is estimated at 65%. This is an invite-only staging candidate, not unrestricted public-launch approval.

## Routes delivered

- `/about` — Pakistan product and controlled-pilot position
- `/help` — functional help-centre navigation and FAQs
- `/safety` — customer, restaurant and rider safety guidance
- `/terms`, `/privacy`, `/refunds` — launch-candidate legal/policy content with explicit counsel gates
- `/account` — protected profile, addresses, orders and notifications
- `/support` — protected general/order cases, history and urgent safety categorisation
- `/partners` — restaurant, home-chef, sales-agent and supplier applications/status
- `/rider` — Lahore application, status, assigned jobs, pickup, delivery proof and COD
- `/ops` — private, separately authorised onboarding/support/manual-dispatch console
- `/vendor` — owner/manager audited CSV menu import added to the existing operations workspace

## Database migration

Apply `supabase/migrations/20260811190000_launch_control.sql` after Phase 3D. It adds:

- `platform_staff`, isolated from restaurant organisation memberships
- `partner_applications` and `rider_applications`
- `delivery_jobs` with controlled rider transitions and exact COD completion
- general support cases with urgent safety priority
- customer account, support, application, rider and operations RPCs
- operations review/dispatch RPCs with explicit role checks
- transactional, audited restaurant menu import

No platform staff are seeded. A reviewed service-role process must add the first operations identity. Do not put a service-role key in the frontend.

## Verification completed

- ESLint: 0 errors; six pre-existing starter Fast Refresh warnings
- TypeScript: passed
- Unit/security-contract tests: 51 passed across nine files
- Production Cloudflare/Nitro build: passed
- Route smoke: all 13 customer, partner, rider, vendor and operations routes returned HTTP 200
- Production dependency audit: 0 known vulnerabilities

## Mandatory staging acceptance

1. Apply all migrations to an isolated project; configure SMS OTP abuse controls.
2. Seed one platform operations user through a protected admin process.
3. Test customer, restaurant, kitchen, rider, support, operations and unrelated identities.
4. Prove cross-customer, cross-branch, cross-rider and vendor-to-platform denial.
5. Prove support staff cannot review partner/rider PII or assign deliveries.
6. Prove suspended/unapproved riders cannot load or advance jobs.
7. Run an order from checkout through restaurant ready, operations assignment, rider pickup, proof, exact COD and delivered status.
8. Reconcile that order to the paisa and preserve restaurant, rider and customer evidence.
9. Test urgent safety case ordering and staffed escalation.
10. Obtain Pakistan counsel approval for company identity, terms, privacy, retention and cancellation/refund text.

## Still blocked before real pilot orders

- Secure rider CNIC/licence/vehicle evidence and human verification
- SMS notification worker, retries, delivery receipts and alerting
- Staff rotas and named owners for support, dispatch, cash and incident response
- COD rider wallet/cash ledger, restaurant settlement and daily reconciliation
- Monitoring, error tracking, backups, restore drill and rollback exercise
- First-party production domain and approved company/contact information
- Accessibility, Urdu-content and low-bandwidth acceptance testing

Online payments, grocery, pharmacy, courier, vouchers, loyalty, automatic dispatch and multi-city ordering remain deliberately gated.
