# Existing Onyn → Onyn Pakistan reference audit

Updated: 10 August 2026

Reviewed sources:

- [Existing Onyn repository](https://github.com/asaffilate01-ship-it/onyn)
- [Existing Onyn development site](https://onydev.313test.co.uk/)
- Onyn Pakistan repository and Phase 1 prototype

This is a product and source review, not a penetration test or legal certification.

## Decision

Use the existing Onyn product as a **workflow reference and brand system**, not as a production-ready backend to copy into Pakistan.

The parent product contains an unusually broad set of customer, vendor, POS, KDS, rider, supplier, agent, franchise and admin experiences. That breadth is useful for defining the long-term platform. Its current security, dependency, test and release evidence is not strong enough to inherit without remediation.

## Existing Onyn assessment

| Area                         | Readiness estimate | Evidence                                                                                                                                                             |
| ---------------------------- | -----------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature breadth              |                85% | Customer, vendor, KDS, POS, rider, supplier, agent, franchise and admin routes exist.                                                                                |
| UI/UX coherence              |                55% | Strong purple identity and many flows, but the public site is very long, naming varies, the location gate is abrupt and role selection is crowded.                   |
| Functional confidence        |                45% | A large Supabase implementation exists, but repository installation is not reproducible and important flows need end-to-end evidence.                                |
| Security confidence          |                20% | Some good RLS/webhook patterns exist, but public development/seed functions, fixed credentials, POS session design and missing browser policies are launch blockers. |
| Test/release quality         |                15% | One trivial test for a very large application; lint fails extensively and the lockfile does not support `npm ci`.                                                    |
| Overall production readiness |            **35%** | A valuable advanced prototype, not yet a safe production baseline.                                                                                                   |

Percentages are planning estimates. They do not certify security or correctness.

## What the audit found

- 662 source files and about 84,700 lines of TSX.
- 61 Supabase edge functions and 197 database migrations.
- Broad route coverage for customer ordering, group orders, subscriptions, wallet, loyalty, QR dine-in and courier, plus vendor KDS/POS, rider, supplier, agent, franchise and operations portals.
- `npm ci` fails because `package.json` and `package-lock.json` are out of sync.
- The production build can complete after a non-frozen install, but the primary client bundle is about 4.8 MB minified and the PWA precache is about 42.8 MB.
- Lint reports 1,717 problems; only one trivial automated test was found.
- The installed production dependency graph reported 121 vulnerabilities, including two critical and 26 high findings at review time.
- The live site sends HSTS, referrer and MIME-sniffing headers, but no Content Security Policy, framing policy or Permissions Policy was observed.

## Critical security exclusions

Do not copy or deploy these patterns into Pakistan:

1. Public `seed-production-data` and `dev-driver-login` functions configured without JWT verification. They contain fixed development credentials and can use privileged service access.
2. A public `generate-vapid-keys` endpoint. Key generation and private material must be restricted to an offline/admin process.
3. POS staff identity held as unsigned `sessionStorage` data after a four-digit PIN check.
4. PIN verification that iterates staff records, lacks a demonstrated lockout/rate limit and is not backed by a short-lived signed POS session.
5. Client-side route hiding as a security boundary. Every organisation, role and record decision must be enforced on the server and in tested RLS policies.

Before any code reuse, remove development endpoints from production, rotate all affected credentials, restore a frozen dependency install, review every `verify_jwt = false` function and add cross-tenant denial tests.

## What Pakistan should reuse, localise or defer

| Parent capability                             | Pakistan decision                   | Required adaptation                                                                                        |
| --------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Purple Onyn identity                          | Reuse                               | One consistent name: **Onyn Pakistan** for launch; avoid OnynGo/OnynGoGo variants.                         |
| Customer discovery → menu → basket → tracking | Reuse                               | Mobile-first, landmark-based addresses, low bandwidth, COD-first and honest fee disclosure.                |
| Delivery and collection                       | Reuse for launch                    | Show availability by branch and validate fulfilment server-side.                                           |
| Vendor orders, menu, KDS and POS              | Rebuild from workflow               | Pakistan tax/receipt rules, cash shifts, Urdu support, local printers and signed staff sessions.           |
| Rider app and dispatch                        | Rebuild from workflow               | CNIC, Pakistani licence/vehicle evidence, cash reconciliation, local safety and payout rules.              |
| Supplier portal                               | Defer to controlled pilot           | Start with verified restaurant procurement and invoice/credit controls, not a public marketplace.          |
| Agent CRM and commissions                     | Defer until vendor onboarding works | Duplicate-lead rules, activation evidence, clawbacks, least-privilege access and an auditable ledger.      |
| Onyn+, wallet, loyalty and referrals          | Phase 5                             | Only after order economics, refund handling and liability accounting are proven.                           |
| QR dine-in, group order and Routine           | Phase 5                             | Useful retention features, but lower priority than reliable ordering and restaurant operations.            |
| Grocery                                       | Phase 5                             | Live stock, weighted goods and substitution/refund flows are prerequisites.                                |
| Pharmacy                                      | Separate regulated release          | Verified pharmacies, prescription rules, pharmacist escalation, prohibited-item controls and legal review. |
| Courier/drop                                  | Separate operational pilot          | Package rules, declared value, distance pricing, proof of delivery and prohibited goods.                   |
| Franchise programme                           | Defer                               | Do not sell territories before city unit economics and operational controls are proven.                    |

## Recommended Pakistan navigation

The parent platform exposes many products at once. Pakistan should use progressive disclosure.

### Public customer navigation

- Mobile: Home, Search, Orders, Account; basket is contextual.
- Desktop: Location, Search/Discovery, Orders, Partner with us, Account, Basket.
- Home service switcher: Food is active at launch; Grocery, Pharmacy and Courier are labelled as later phases until operationally ready.

### Authenticated workspaces

- Restaurant: Overview, Orders, KDS, Menu, POS, Inventory, Reports, Team, Settings.
- Rider: Go online, Offers, Active delivery, Earnings, Support, Account.
- Supplier: Catalog, Restaurant orders, Fulfilment, Invoices, Returns, Team, Settings.
- Agent: Pipeline, Add lead, Onboarding, Portfolio, Commission, Resources, Account.
- Operations: Live ops, Orders, Vendors, Riders, Dispatch, Finance, Risk, Support, Audit, Settings.

Do not put Customer, Vendor, Driver, Supplier, Agent, Franchise and Admin into one public login chooser. Use separate partner entry pages and non-indexed staff/admin sign-in.

## Go-live priority

1. One city, food only, bounded delivery zones, delivery and collection.
2. Customer OTP, real addresses, server-priced COD orders, vendor acceptance/KDS and support.
3. Manual dispatch, rider workflow, cash reconciliation, audit trail and vendor statements.
4. Approved mobile-wallet/card integration with signed webhooks and refunds.
5. Only then add retention products and adjacent verticals based on measured demand.

This approach preserves the strongest Onyn ideas—fair vendor economics, connected restaurant tooling and a multi-sided operating platform—without carrying the parent application's current release risk into the Pakistan launch.
