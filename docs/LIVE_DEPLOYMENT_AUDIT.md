# Onyn Pakistan live deployment audit

Reviewed: 11 August 2026
Deployment: [food-fair-pakistan.lovable.app](https://food-fair-pakistan.lovable.app/)

## Verified live

- Purple Onyn Pakistan identity and responsive marketplace homepage.
- Food/Grocery/Pharmacy/Courier switcher with later services gated.
- Delivery and collection choice, restaurant discovery, menus, basket totals and checkout.
- Collection checkout removes the delivery fee and changes address, time and payment wording.
- Restaurant, rider, agent and supplier entry points.
- Restaurant workspace at `/vendor` with order board, KDS, menu, reports and operating controls.

Verified path: `Home → Collection → Lahori Karahi House → Chicken Karahi → Basket → Checkout`.

## Deployment mismatch

The live deployment now includes the Phase 3A restaurant UI, but it still exposes demo orders and unsafe launch signals. This local Phase 3B candidate adds authenticated membership checks, live protected data loading, role-aware mutations, accurate SLA timing and Lahore-only serviceability.

## Live gaps

| Gap                                                            | Required action                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| OTP is not connected                                           | Configure Supabase staging and a Pakistan-capable SMS provider with abuse limits. |
| Orders are browser state                                       | Apply the pilot migration and use RLS-protected catalog, address and order data.  |
| Islamabad and Karachi appear as saved delivery areas           | Fixed locally: both are now explicitly coming soon.                               |
| Restaurant data remains demo data                              | Fixed locally when Supabase is configured; signed-out users receive OTP access.   |
| Order-card clock and SLA summary can disagree                  | Fixed locally by using the same clock for urgency and summary metrics.            |
| Terms, Privacy, Refunds and Help are placeholders              | Disabled and labelled pre-launch locally; publish approved versioned pages.       |
| Partner entries share a modal                                  | Non-live applications now disclose pilot status; build separate onboarding flows. |
| Schedule, payment-change and voucher controls are placeholders | Fixed locally: unsupported controls removed or clearly deferred.                  |
| Collection screens showed delivery wording                     | Fixed in this candidate.                                                          |
| Lovable edit badge is visible                                  | Remove it on the production domain.                                               |

## Current readiness

| Target                   | Overall readiness |
| ------------------------ | ----------------: |
| Live Lovable deployment  |           **34%** |
| Local Phase 3B candidate |           **44%** |

The candidate still requires a staging deployment, SMS provider, real vendor/catalog data, approved legal/support content and cross-tenant database tests before public trading.
