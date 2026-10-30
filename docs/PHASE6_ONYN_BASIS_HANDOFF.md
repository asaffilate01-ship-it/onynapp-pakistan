# Dishbee+ Pakistan Phase 6 — Onyn basis handoff

Date: 2026-10-30

## What this phase does

Phase 6 turns the retained Pakistan launch candidate into **Dishbee+ Pakistan**, using `asaffilate01-ship-it/onyn` as the product, navigation and multi-surface workflow donor. It does not copy the parent repository wholesale. Pakistan-specific authentication, COD reconciliation, serviceability, launch gating and role separation remain authoritative.

## Implemented in this package

- Reusable Dishbee+ navy-and-amber wordmark and app mark across public, customer and restaurant surfaces.
- Dishbee+ metadata, manifest, legal/help/support labels and partner-facing copy.
- Real Pakistan food photography in the customer ordering hero instead of emoji-only artwork.
- Persistent active-order ribbon with live status, progress and one-tap tracking when an authenticated customer has an open order.
- Product-family naming that makes the platform understandable:
  - **Dishbee+ Food** — customer discovery, checkout, tracking and support.
  - **Dishbee+ One** — restaurant orders, KDS, menu and opening-hours operations.
  - **Dishbee+ Rider** — rider onboarding and controlled delivery workflow.
  - **Dishbee+ Counter** — next-release counter/POS capability, still gated.
- Existing mobile four-tab customer navigation retained because it is clearer for launch than copying the parent product's larger tab set.

## Deliberately retained from the Pakistan architecture

- Pakistan mobile OTP and server-enforced role membership.
- Live catalog only from approved/open branches; preview data cannot place a real order.
- Server-priced COD orders, idempotency and auditable order status transitions.
- Safe cancellation review after restaurant acceptance.
- Rider assignment, handover and COD settlement controls.
- No live claims for payments, loyalty, AI recommendations, grocery, pharmacy or courier until their launch gates pass.

## Still required before public launch

1. Final trademark/domain clearance for Dishbee+ in Pakistan and target expansion markets.
2. Replace inherited Onyn-named image filenames and legacy reference documentation where operationally useful; they are not public-facing brand copy.
3. Connect and acceptance-test SMS OTP, monitoring, backups, support rosters and incident response in isolated staging.
4. Complete real-device testing across lower-cost Android devices, intermittent networks and Urdu content expansion.
5. Build the next Onyn-derived operational increments: rider live job surface, dispatch console, push notifications/PWA offline shell and restaurant analytics.
6. Keep AI/MCP capabilities assistive and permissioned: menu cleanup, support summarisation, anomaly flags and operator recommendations should require human approval for consequential actions.

## Validation

The package passes lint with only six pre-existing Fast Refresh warnings, TypeScript typechecking, all 60 tests, and the production build.

This is a source candidate, not a production-readiness certification. The code has not been pushed or deployed by this phase.
