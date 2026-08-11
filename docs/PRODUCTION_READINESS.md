# Onyn Pakistan — production readiness and go-live plan

Updated: 10 August 2026

## Executive assessment

The repository began as a blank TanStack/Lovable starter. Phase 1 now provides a coherent customer marketplace and working front-end ordering prototype, but it is not yet safe to accept real orders or money.

| Area                            | Current readiness | Evidence and remaining condition                                                                                                                                   |
| ------------------------------- | ----------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer UI/UX                  |               76% | Responsive discovery, service/fulfilment choice, menu, basket, checkout and order-state journeys exist. Add real data, Urdu, accessibility and usability evidence. |
| Customer ordering functionality |               38% | Front-end state works; durable order creation, inventory, pricing, tax, refunds and notifications are not connected.                                               |
| Restaurant/ePOS/KDS             |               12% | Partner entry point exists. Portal, menu import, order acceptance, KDS, printer/device adapters and settlement reports remain.                                     |
| Rider and dispatch              |                8% | Rider entry point exists. Verification, availability, dispatch, navigation, proof of delivery, safety and earnings remain.                                         |
| Sales-agent portal              |                8% | Agent proposition exists. Lead ownership, duplicate protection, onboarding evidence and commission ledger remain.                                                  |
| Admin and operations            |               10% | Operations entry point exists. RBAC screens, support, fraud, refunds, vendor/rider review and audit exports remain.                                                |
| Security and privacy            |               38% | Headers, OTP adapter, pilot RLS schema, server-priced order RPC, tests and CI exist locally. Staging denial tests and independent testing remain.                  |
| Reliability and operations      |               12% | Production build passes. Monitoring, backups, restore drill, SLOs, incident playbooks and live integrations remain.                                                |
| Overall launch readiness        |           **32%** | The Phase 2 candidate has a secure pilot foundation; the current live deployment remains about 25% and is not ready for public trading.                            |

Readiness percentages are delivery estimates, not certifications. “100%” requires passed acceptance evidence, not only source code.

The detailed comparison with the parent repository and live product is in [ONYN_REFERENCE_AUDIT.md](./ONYN_REFERENCE_AUDIT.md). Its conclusion is to reuse the parent brand and validated workflow ideas, but not inherit its backend or deployment posture without remediation.

The Lovable deployment is reviewed in [LIVE_DEPLOYMENT_AUDIT.md](./LIVE_DEPLOYMENT_AUDIT.md).

## What competitors establish as the baseline

Foodpanda Pakistan currently markets restaurant and grocery delivery, online and cash payments, vouchers and a pandapro delivery subscription. Its restaurant partner proposition emphasises reach, revenue and operational efficiency.

FoodPapa markets restaurants, cafés, groceries, home chefs, live delivery tracking, deals, vouchers and a Papa Wallet. Its public partner structure includes restaurant, home-chef and rider registration.

Onyn therefore cannot differentiate only by listing local restaurants or home chefs. Its defensible position should be:

1. A genuinely transparent fixed monthly vendor plan with no Onyn percentage sales commission.
2. Restaurant-owned customer relationships and first-party ordering/ePOS tools.
3. Clear delivery, payment and service fees before confirmation.
4. Fast local support and fair rider earnings with transparent deductions.
5. Strong service for independent restaurants and home chefs outside the most competitive city centres.

Sources: [foodpanda Pakistan](https://www.foodpanda.pk/), [foodpanda restaurant partners](https://partner.foodpanda.pk/), [pandapro](https://www.foodpanda.pk/contents/pandapro), [FoodPapa](https://foodpapa.com/), [FoodPapa customer app](https://play.google.com/store/apps/details?id=com.foodpapauser.app).

## Required product journeys

### Customer

- Mobile OTP with abuse controls, optional email recovery and device/session management
- Map pin plus typed address, landmark, delivery instructions and serviceability result
- Restaurant availability, real menus, modifiers, sold-out status, allergens and preparation estimates
- Basket validation on the server immediately before checkout
- Cash on delivery, JazzCash, Easypaisa, Raast/provider option and cards after commercial approval
- Signed order status events, live rider tracking, masked calling/chat and support escalation
- Cancellation rules, refund state, invoices/receipts, ratings, favourites and reorder
- English and Urdu copy; do not implement RTL until translated content and layouts are tested

### Restaurant, home chef and ePOS

- KYB/KYC, bank/mobile-wallet settlement details, food authority evidence and expiry reminders
- Subscription plan, device financing/cost price and digitally accepted agreement
- Branches, service areas, hours, prep time, capacity throttles, holiday mode and delivery modes
- Menu categories, products, modifier groups, price schedules, availability and bulk import
- Order accept/reject with reason and countdown; KDS states; printer retry/fallback
- ePOS cash/card/mobile-wallet tender, till shifts, discounts, refunds and cash reconciliation
- Inventory recipes, low-stock alerts, waste, stock movements and branch transfers
- Settlement, subscription, delivery and payment-processing statements with downloadable evidence

### Rider and dispatch

- CNIC/licence/vehicle verification, selfie/liveness where proportionate and consented
- Availability, zones, offer timeout, acceptance and safe reassignment
- Pickup verification, route navigation, masked communication and proof of delivery
- Cash collection limits and reconciliation; wallet/earnings ledger; dispute workflow
- Emergency/safety process, account suspension review and performance fairness controls
- Manual dispatcher console plus configurable automatic dispatch and surge/capacity controls

### Sales agent

- Verified agent account, territory and referral identity
- Lead/restaurant duplication rules and auditable attribution
- Onboarding checklist, document review and activation gate
- Commission rules, cooling-off/clawback, ledger, invoice and payout status
- No access to customer orders, rider documents or unrelated restaurant financial data

### Operations and admin

- Separate roles for support, finance, vendor ops, rider ops, dispatcher, risk and super-admin
- Four-eyes approval for payouts, refunds above threshold, bank-detail changes and role elevation
- Full immutable audit trail: actor, organisation, action, target, before/after, time, IP/device context
- Order intervention, partial/full refund, coupon controls and compensation limits
- Vendor/rider queues, service-area controls, pricing, subscriptions and feature flags
- Fraud signals for OTP abuse, voucher abuse, fake orders, collusion, account takeover and payout change
- Reconciliation across orders, cash, gateway events, rider wallet and vendor settlement

## Navigation and information architecture

| Experience       | Primary navigation                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Customer mobile  | Home, Search, Orders, Account; basket as a contextual action                                    |
| Customer desktop | Location, Food service/fulfilment, Search/Discovery, Orders, Partner entry, Account, Basket     |
| Restaurant       | Overview, Orders, KDS, ePOS, Menu, Inventory, Customers, Reports, Team, Settings                |
| Rider            | Home/Go online, Offers, Active delivery, Earnings, Schedule, Support, Account                   |
| Sales agent      | Pipeline, Add lead, Onboarding, Portfolio, Commission, Resources, Account                       |
| Admin            | Live ops, Orders, Vendors, Riders, Dispatch, Customers, Finance, Risk, Support, Audit, Settings |

Every role must receive a distinct server-authorised route tree. Hiding a menu item is not permission enforcement.

## Security launch gates

- Use a backend-for-frontend/API with short-lived sessions in `Secure`, `HttpOnly`, `SameSite` cookies; never store privileged tokens in local storage.
- Validate every request with schemas and recalculate price, availability, delivery and discount values on the server.
- Enforce organisation and role checks server-side on every resource; if using Supabase, enable RLS on every exposed table and test cross-tenant denial.
- OTP: per-number, per-IP and per-device rate limits, generic responses, short expiry, limited attempts and step-up checks for suspicious activity.
- Idempotency keys for order creation, payment capture, refund, rider payout and settlement operations.
- Verify payment and provider webhooks with raw-body signatures, timestamps, replay protection and a durable event inbox.
- Encrypt sensitive fields, isolate CNIC and bank data, minimise retention and log access to high-risk records.
- Move CSP to nonce/hash-based scripts when the deployment target is fixed; current `unsafe-inline` is a compatibility baseline, not the final target.
- CI secret scanning, dependency review, CodeQL, protected branches, reviewed database migrations and separated staging/production credentials.
- Independent penetration test and remediation, with specific coverage of broken access control, business-logic fraud and API abuse.

## Data model and state machines

Minimum protected entities: users, identities, organisations, memberships, branches, service areas, vendors, rider profiles, agent profiles, menus, modifier groups, inventory items, orders, order lines, payments, refunds, delivery jobs, status events, cash ledgers, vendor settlements, rider earnings, subscriptions, commissions, support cases and audit events.

Order states must be explicit and append-only in history:

`draft → payment_pending → placed → accepted → preparing → ready → picked_up → delivered`

Terminal/exception paths: `rejected`, `cancelled`, `delivery_failed`, `refund_pending`, `partially_refunded`, `refunded` and `chargeback`.

Transitions must be atomic, role-constrained and idempotent. Do not let clients write status fields directly.

## Phased build to launch

### Phase 2 — transactional customer MVP

- Select one launch city and a bounded set of postcodes/zones
- Real authentication, addresses, vendor/menu database and RLS/RBAC
- Server-validated cart, COD orders, vendor acceptance and status notifications
- Customer support and cancellation flow
- Seeded staging data, event/audit records, API tests and end-to-end tests

Exit: 20 pilot vendors can complete real COD orders end-to-end in staging with no manual database edits.

### Phase 3 — restaurant operations and controlled pilot

- Restaurant portal, KDS, menu/modifier management, hours, prep time and sold-out controls
- ePOS core, cash shifts, receipt/thermal printer path and reconciliation
- Manual dispatch console and rider web/PWA workflow
- Subscription billing, vendor statements and agent onboarding/commission ledger
- Monitoring, support playbooks and daily reconciliation

Exit: four-week invite-only pilot, ≥98% technically successful orders, financial reconciliation explained to the paisa, backup restore proven.

### Phase 4 — payments, dispatch automation and public city launch

- Commercially approved JazzCash/Easypaisa/Raast/card provider integration
- Signed webhooks, refunds and dispute evidence
- Automatic dispatch with manual override, live tracking and cash controls
- Urdu localisation, accessibility/usability rounds and low-bandwidth optimisation
- Penetration test, load test, incident drill, app-store/privacy/legal pack

Exit: critical/high security findings closed, operational owners sign off, rollback and customer communication plans tested.

### Phase 5 — scale without losing control

- Multi-city configuration, grocery workflows, delivery subscription and loyalty/referrals
- Inventory recipes, procurement and multi-branch controls
- Capacity forecasting, courier batching only after service-quality evidence
- Data warehouse, cohort/unit economics, fraud models and experiment governance

## Metrics that must exist before public launch

- Search-to-menu, menu-to-basket, basket-to-order conversion and payment failure by method
- Vendor acceptance, rejection reason, prep accuracy and order-ready latency
- Dispatch latency, rider acceptance, pickup wait, delivery ETA accuracy and failed delivery
- Cancellation/refund rate by cause and support first-response/resolution time
- Gross order value, delivery revenue/cost, payment cost, subscription MRR and contribution margin
- Reconciliation exceptions, cash outstanding, payout ageing and agent commission liability
- Crash-free sessions, API p95/p99, error rate, queue depth, webhook lag and notification delivery
- Security: suspicious OTP attempts, account takeovers, blocked cross-tenant access and privileged actions

## Items requiring commercial/legal decisions

- The exact fixed monthly plans, fair-use/order-volume boundaries and hardware repayment terms
- Who contracts with and pays riders; insurance and tax treatment
- Pakistan company, consumer, data/privacy, e-commerce and provincial food-authority obligations
- Payment-provider, KYC/KYB and settlement design
- Refund/cancellation allocation and COD loss allocation
- Launch city, delivery zones, operating hours and minimum vendor density

These require qualified Pakistan legal, tax, payments and employment advice. Product copy must not promise “no fees” when subscription, delivery or payment costs apply.
