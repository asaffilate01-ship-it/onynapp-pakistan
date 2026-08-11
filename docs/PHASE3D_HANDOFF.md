# Phase 3D handoff — operating controls, modifiers and notifications

Updated: 11 August 2026

## Status checked

- GitHub `main` was reconciled at `026090d` (`Applied Phase 3C build`) before this phase was built.
- The Phase 3D work in this package is local and has not been pushed or deployed.
- The public Lovable deployment must not be treated as Phase 3D until this source, its migration and staging acceptance have been released together.

## Delivered

- Pakistan-time seven-day branch schedules, including overnight opening
- Temporary and holiday closures with a named reason and optional reopening time
- Customer “open / closed / paused / hours required” states
- Server-owned checkout rejection for closed or temporarily closed branches
- Required and optional modifier groups with min/max selection rules
- Option price deltas shown before add-to-basket and included in configured basket lines
- Server validation of option ownership, availability and price; client totals are never trusted
- Immutable option names and price deltas copied onto order lines for customer, KDS and restaurant history
- Restaurant option sold-out controls protected by branch membership
- Customer in-app notification centre with realtime refresh and protected read-state RPC
- Server-only outbound notification queue ready for a trusted Pakistan SMS worker
- Regression coverage for hours, options, notifications and vendor roles

## Database migration

Apply `supabase/migrations/20260811170000_hours_modifiers_notifications.sql` only after the Phase 3C migrations. It adds:

- `branch_hours` and `branch_closures`
- `menu_option_groups` and `menu_options`
- `order_line_options` and a cart selection signature
- `customer_notifications` and server-only `notification_outbox`
- `marketplace_catalog`, schedule management, notification read and option availability RPCs
- a revised `create_cod_order` that validates live hours and modifier pricing atomically

Important rollout behaviour: a branch with no schedule is closed. Apply the migration during a maintenance window, have each pilot owner save all seven days, verify the customer state, and only then resume order acceptance.

## Verification completed

- ESLint: 0 errors; six pre-existing starter Fast Refresh warnings
- TypeScript: passed
- Unit/contract tests: 44 passed across seven files
- Production build: passed for the Cloudflare/Nitro target
- Production dependency audit: 0 vulnerabilities
- Development SSR smoke: `/` and `/vendor` returned HTTP 200

The `preview` script now uses Nitro, matching the Cloudflare build output. This restricted workspace cannot launch Wrangler because operating-system network-interface discovery is blocked, so the production preview must also be exercised in CI or the deployment environment.

## Required staging acceptance

1. Apply all migrations to an isolated Supabase staging project and configure two pilot branches with different schedules.
2. Test Pakistan-time boundaries, overnight opening, an active closure and reopening at the exact boundary.
3. Seed at least one required single-choice group and one optional multi-choice group; prove missing, excessive, cross-item and sold-out selections are rejected.
4. Change an option price after a customer opens a menu and prove checkout uses the current server price.
5. Use two customers and two vendor organisations to prove notification, order, schedule and modifier cross-tenant denial.
6. Prove customer, order board and KDS display the same option snapshot after live menu data changes.
7. Connect a trusted SMS worker to `notification_outbox`; add idempotency, retry limits, delivery receipts, dead-letter handling, rate limits and alerting.
8. Exercise loss of realtime connectivity and confirm manual refresh/recovery leaves order state correct.
9. Run keyboard, screen-reader, 320 px mobile, low-bandwidth and Urdu-content usability checks.

## Still required before a controlled Lahore pilot

- Restaurant menu authoring/import and onboarding review workflow
- Staffed customer support console and escalation ownership
- SMS provider integration plus OTP abuse controls and delivery monitoring
- Manual rider/dispatch workflow, proof of delivery and COD reconciliation
- Backups, restore drill, application monitoring, incident playbooks and daily reconciliation
- Pakistan legal/privacy/terms/refund content and first-party production domain sign-off

Online payments, grocery, pharmacy, courier, subscriptions, vouchers, loyalty and automatic dispatch remain gated until the COD food pilot is stable and measured.

## Go-live boundary

Phase 3D is a staging candidate, not approval for unrestricted public launch. The narrowest safe next release is an invite-only, Lahore COD pilot with verified vendors, a staffed manual dispatch/support operation and documented rollback.
