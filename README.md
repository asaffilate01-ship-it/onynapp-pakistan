# Onyn Pakistan

Onyn is a Pakistan-only food delivery and ePOS marketplace for customers, restaurants, home chefs, riders and local sales partners.

The commercial model is designed around a predictable monthly vendor subscription rather than an Onyn sales commission on every order. Payment processing, delivery, hardware and subscription charges must still be disclosed clearly in the final partner agreement.

## Current build

This repository now contains a responsive, production-buildable Phase 3D pilot candidate:

- Pakistan-localised restaurant and home-chef discovery
- Onyn-branded Food, Grocery, Pharmacy and Courier service switcher with non-launch services clearly gated
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
- Customer mobile OTP entry screen ready for a real authentication service
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

Without a configured Supabase staging project the marketplace and restaurant workspace remain visibly labelled demo data. With staging configured, Phase 3D can create and track server-priced COD orders. Every branch must save its seven-day schedule before it can receive orders. Online payments remain outside the pilot.

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

See [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) for the go-live plan, [docs/NEXT_PHASE_REFERENCE_MATRIX.md](docs/NEXT_PHASE_REFERENCE_MATRIX.md) for the current UK-to-Pakistan feature mapping, [docs/ONYN_REFERENCE_AUDIT.md](docs/ONYN_REFERENCE_AUDIT.md) for the parent comparison and [docs/LIVE_DEPLOYMENT_AUDIT.md](docs/LIVE_DEPLOYMENT_AUDIT.md) for the Lovable review.

## Pilot backend

Copy `.env.example`, create a separate Supabase staging project, and follow [supabase/README.md](supabase/README.md). Never place a service-role key in a `VITE_*` variable.

## Lovable

The repository remains linked to the original [Lovable project](https://lovable.dev/projects/81dff424-60ec-45ad-a9dd-422ddb59c383). Keep GitHub as the source of truth and review Lovable-generated commits before merging.
