# Dishbee+ Pakistan Phase 7 — Onyn + Dishbee operations handoff

Date: 2026-10-30

Pinned donor revisions:

- Onyn main: `382b6dee123c78a2f84e62e73d24710e01e9be35`
- Dishbee Helper main: `4a267048b485aa7e8eef91e7341e86ae8e74ab7f`

## Source responsibilities

- `asaffilate01-ship-it/onyn` main is the donor for marketplace journeys, rider workspace navigation, online/offline presence, realtime delivery updates and location-aware dispatch UX.
- `asaffilate01-ship-it/dishbee-helper` main is authoritative for EPOS, paid-order release, KDS lifecycle, till reconciliation, provider-verified payments/refunds and multi-brand kitchen operations.
- Dishbee+ Pakistan connects the two without copying UK currency assumptions, browser-only availability state, direct client payment authority or public precise-location access.

## Implemented

- Server-backed rider online/offline/on-delivery presence.
- Verified-rider-only location updates, accuracy limits and implausible movement rejection.
- Realtime assigned-job refresh.
- Rider summary ribbon for dispatch state, COD liability, completed deliveries and location state.
- Four-part mobile rider workspace: Jobs, Active, Cash and Profile.
- Privacy-safe pickup/drop-off directions without embedding a paid map SDK or exposing credentials.
- Operations dashboard online-rider count, availability labels and active delivery manifest.
- Dispatch now permits only approved, evidence-verified and currently online riders.
- Dishbee One Counter entry in the restaurant workspace.
- Credential-free links to the authoritative Dishbee EPOS and production KDS when `VITE_DISHBEE_ONE_URL` is configured.
- Explicit separation between marketplace demand and Dishbee One restaurant/payment authority.

## Deliberately not copied from Onyn

- Browser-local online state.
- UK pound values and assumed earnings calculations.
- Automatic scored dispatch, gamification, surge zones and demerits before Pakistan pilot evidence exists.
- Five-second continuous location broadcasting outside an active pilot need.
- Client-controlled payment or settlement transitions.

## Activation requirements

1. Apply and rehearse `20261030090000_rider_live_operations.sql` in isolated staging.
2. Confirm location retention, rider consent and operations access policy with Pakistan counsel.
3. Configure the Dishbee One staging URL and complete separate tenant authentication.
4. Implement the signed server-to-server order handoff and idempotent acknowledgement before sending live marketplace orders into Dishbee One.
5. Run real-device tests for background location, battery impact, weak mobile data and denied permissions.
6. Do not enable automatic dispatch or rider earnings until fees, insurance, worker status and payout rules are approved.

This phase remains a source candidate. It does not certify staging, production deployment or provider acceptance.
