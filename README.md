# Onyn Pakistan

Onyn is a Pakistan-only food delivery and ePOS marketplace for customers, restaurants, home chefs, riders and local sales partners.

The commercial model is designed around a predictable monthly vendor subscription rather than an Onyn sales commission on every order. Payment processing, delivery, hardware and subscription charges must still be disclosed clearly in the final partner agreement.

## Current build

This repository now contains a responsive, production-buildable Phase 1 customer experience:

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

See [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) for the verified baseline, competitor comparison, target architecture, security requirements, role model and phased go-live plan. The parent repository and live-site review is documented separately in [docs/ONYN_REFERENCE_AUDIT.md](docs/ONYN_REFERENCE_AUDIT.md).

## Lovable

The repository remains linked to the original [Lovable project](https://lovable.dev/projects/81dff424-60ec-45ad-a9dd-422ddb59c383). Keep GitHub as the source of truth and review Lovable-generated commits before merging.
