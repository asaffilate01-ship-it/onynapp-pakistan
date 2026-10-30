# Dishbee+ Pakistan

Dishbee+ is a Pakistan-first food delivery and restaurant-operations marketplace for customers, restaurants, home chefs, riders and local sales partners. This Phase 8 source uses the broader Onyn repository as a product and workflow reference, Dishbee One as the EPOS/KDS authority, and Pakistan-specific launch controls.

The commercial model is designed around a predictable monthly vendor subscription rather than a Dishbee+ sales commission on every order. Payment processing, delivery, hardware and subscription charges must still be disclosed clearly in the final partner agreement.

## Current build

This repository now contains a responsive, production-buildable Phase 8 controlled-launch candidate:

- A Dishbee+ cinematic Pakistan landing page informed by the Onyn product system, with honest Lahore launch scope
- A dedicated `/order` journey so marketing, ordering and partner acquisition no longer compete on one screen
- A conversion-focused `/for-business` journey with a clearly caveated PKR commission-leakage calculator
- A consistent Dishbee+ navy-and-amber wordmark, responsive launch navigation and retained high-contrast marketplace UI
- Private, authenticated restaurant favourites that persist across devices
- Verified-order star ratings with moderation for optional written reviews
- Safe repeat ordering that always revalidates current menu items, options, prices, hours and serviceability

- Pakistan-localised restaurant and home-chef discovery
- Dishbee+-branded Food, Grocery, Pharmacy and Courier service switcher with non-launch services clearly gated
- Functional delivery/collection choice with matching fee, checkout and tracking language
- Controlled Gulberg III and DHA Phase 5 Lahore delivery areas; Islamabad and Karachi clearly marked coming soon
- Search, cuisine filters, favourites and restaurant menus
- Functional basket quantities and clear fee breakdown; vouchers remain explicitly deferred
- Required and optional menu modifier selection with option-aware basket lines
- Live catalog loading that never falls back to demo restaurants after a backend failure
- Authenticated cash-on-delivery checkout using protected server prices and live menu IDs
- Server-enforced, branch-specific Lahore service zones and reusable verified addresses
- Protected customer order history, realtime status refresh and server totals
- In-app order notifications with protected read state and an SMS delivery outbox foundation
- Immediate pre-acceptance cancellation plus auditable support review after acceptance
- Mobile navigation and responsive desktop/tablet/mobile layouts
- Customer mobile OTP routed through a server-side Pakistan number/IP rate limiter with a resend cooldown
- Restaurant, rider, supplier, sales-agent and operations entry points
- Global CSP, frame protection, MIME sniffing protection, permissions and referrer headers
- CI tests, build, lint, type checks and production dependency audit workflow
- Secure Supabase pilot schema with RLS, server-priced idempotent COD ordering and vendor transitions
- SMS OTP send/verify adapter that stays visibly disabled until Supabase is configured
- Automated Pakistan phone and trusted-price calculation tests
- Separate responsive restaurant workspace at `/vendor`
- Functional incoming-order board and kitchen display with controlled status transitions
- Required rejection reasons, urgency indicators, COD exposure and customer landmark/notes
- Busy mode, accepting-orders, preparation-time and menu sold-out controls
- Pakistan-time weekly opening hours, overnight service, temporary closures and holiday controls
- Restaurant modifier availability controls and server-snapshotted order options
- Protected branch/menu/order operations, audit events and vendor realtime/list adapters
- Authenticated restaurant SMS sign-in, active membership guard and real branch/menu/order loading
- Manager-only new-order approval and branch settings with least-privilege kitchen controls
- Protected restaurant access to delivery address, landmark and customer notes
- Automated vendor state-machine, urgency and operational-metric tests
- Server-side checkout rejection when a branch is closed, paused or an option becomes unavailable
- Dedicated About, Help, Safety, Terms, Privacy and Cancellation/Refund routes
- Protected customer account route with profile, verified addresses, orders and notifications
- Protected support requests, customer case history and urgent safety triage
- Restaurant, home-chef, sales-agent and supplier application workflow with review status
- Lahore rider application, assigned-job, pickup, proof-of-delivery and exact-COD workflow
- Separately authorised platform operations console for onboarding, support and manual dispatch
- Owner/manager CSV menu import with validation, server transaction and audit record
- Private rider CNIC/licence evidence upload with file limits, short-lived staff access and human review
- Rider approval and dispatch blocked until required identity/licence evidence is verified
- Append-only COD collection/handover ledger and exact operations reconciliation
- Trusted SMS outbox worker with atomic claiming, exponential retry and dead-letter visibility
- Evidence-backed operations launch checklist covering security, finance, legal and reliability gates
- Signed, idempotent server-to-server order bridge into Dishbee One EPOS/KDS
- Branch/menu mapping gates, leased retries, dead-letter handling and explicit acknowledgements
- Private Dishbee One handoff health and operator recovery controls

Without a configured Supabase staging project the marketplace and restaurant workspace remain visibly labelled demo data and transactional routes stay disabled. With staging configured, Phase 8 can operate an invite-only Lahore COD workflow from customer order through restaurant preparation, verified-rider dispatch, delivery, cash handover and verified-order feedback. Dishbee One dispatch must remain disabled until its receiver verifies signatures and proves duplicate-safe retries. Every branch must save its seven-day schedule before it can receive orders. A Pakistan SMS provider, operational owners and staging acceptance evidence are still required before real orders. Online payments remain outside the pilot.

## Development

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Quality checks:

```sh
npm run check
```

## Product and launch status

See [docs/PHASE8_DISHBEE_ONE_HANDOFF.md](docs/PHASE8_DISHBEE_ONE_HANDOFF.md) for the signed EPOS/KDS bridge, [docs/PHASE7_ONYN_DISHBEE_OPERATIONS_HANDOFF.md](docs/PHASE7_ONYN_DISHBEE_OPERATIONS_HANDOFF.md) for rider and operations integration, and [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) for the remaining go-live plan.

## Pilot backend

Copy `.env.example`, create a separate Supabase staging project, and follow [supabase/README.md](supabase/README.md). Never place a service-role key in a `VITE_*` variable.

## Lovable

The repository remains linked to the original [Lovable project](https://lovable.dev/projects/81dff424-60ec-45ad-a9dd-422ddb59c383). Keep GitHub as the source of truth and review Lovable-generated commits before merging.
