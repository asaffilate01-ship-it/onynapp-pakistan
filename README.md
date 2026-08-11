# Onyn Pakistan

Onyn is a Pakistan-only food delivery and ePOS marketplace for customers, restaurants, home chefs, riders and local sales partners.

The commercial model is designed around a predictable monthly vendor subscription rather than an Onyn sales commission on every order. Payment processing, delivery, hardware and subscription charges must still be disclosed clearly in the final partner agreement.

## Current build

This repository now contains a responsive, production-buildable Phase 3A pilot candidate:

- Pakistan-localised restaurant and home-chef discovery
- Onyn-branded Food, Grocery, Pharmacy and Courier service switcher with non-launch services clearly gated
- Functional delivery/collection choice with matching fee, checkout and tracking language
- Lahore, Islamabad and Karachi delivery-area selection examples
- Search, cuisine filters, favourites and restaurant menus
- Functional basket quantities, voucher input and clear fee breakdown
- Checkout, cash-on-delivery selection and order confirmation flow
- Mobile navigation and responsive desktop/tablet/mobile layouts
- Customer mobile OTP entry screen ready for a real authentication service
- Restaurant, rider, supplier, sales-agent and operations entry points
- Global CSP, frame protection, MIME sniffing protection, permissions and referrer headers
- CI build, lint, type checks and dependency audit workflow
- Secure Supabase pilot schema with RLS, server-priced idempotent COD ordering and vendor transitions
- SMS OTP send/verify adapter that stays visibly disabled until Supabase is configured
- Automated Pakistan phone and trusted-price calculation tests
- Separate responsive restaurant workspace at `/vendor`
- Functional incoming-order board and kitchen display with controlled status transitions
- Required rejection reasons, urgency indicators, COD exposure and customer landmark/notes
- Busy mode, accepting-orders, preparation-time and menu sold-out controls
- Protected branch/menu/order operations, audit events and vendor realtime/list adapters
- Automated vendor state-machine, urgency and operational-metric tests

All restaurant, menu, order and pricing records in Phase 1 are labelled demo data. The application does not yet process a real order or payment.

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
