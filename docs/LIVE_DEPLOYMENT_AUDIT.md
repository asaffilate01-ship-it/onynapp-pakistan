# Onyn Pakistan live deployment audit

Reviewed: 10 August 2026  
Deployment: [food-fair-pakistan.lovable.app](https://food-fair-pakistan.lovable.app/)

## Verified live

- Purple Onyn Pakistan identity and responsive marketplace homepage.
- Food/Grocery/Pharmacy/Courier switcher with later services gated.
- Delivery and collection choice, restaurant discovery, menus, basket totals and checkout.
- Collection checkout removes the delivery fee and changes address, time and payment wording.
- Restaurant, rider, agent and supplier entry points.

Verified path: `Home → Collection → Lahori Karahi House → Chicken Karahi → Basket → Checkout`.

## Deployment mismatch

The live deployment serves Phase 1. This Phase 2 candidate adds real Supabase OTP send/verification wiring, RLS, server-priced idempotent COD orders, constrained vendor transitions, append-only order events, tests and clear demo-mode messaging.

## Live gaps

| Gap                                                    | Required action                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| OTP is not connected                                   | Configure Supabase staging and a Pakistan-capable SMS provider with abuse limits. |
| Orders are browser state                               | Apply the pilot migration and use RLS-protected catalog, address and order data.  |
| Terms, Privacy, Refunds and Help are placeholders      | Add real versioned legal/support pages.                                           |
| Partner entries share a modal                          | Build separate least-privilege onboarding journeys.                               |
| Schedule, Change and voucher controls are placeholders | Wire or remove them for the pilot.                                                |
| Collection screens showed delivery wording             | Fixed in this candidate.                                                          |
| Lovable edit badge is visible                          | Remove it on the production domain.                                               |

## Current readiness

| Target                  | Overall readiness |
| ----------------------- | ----------------: |
| Live Lovable deployment |           **25%** |
| Phase 2 candidate       |           **32%** |

The candidate still requires a staging deployment, SMS provider, real vendor/catalog data and cross-tenant database tests before public trading.
