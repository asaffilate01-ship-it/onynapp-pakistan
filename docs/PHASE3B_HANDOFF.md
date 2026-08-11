# Phase 3B handoff — live restaurant access and Lahore pilot controls

Updated: 11 August 2026

## Delivered

- Lahore-only serviceability for Gulberg III and DHA Phase 5; Islamabad and Karachi are coming soon
- Required house/street/building and landmark fields before delivery checkout
- Honest pre-launch states for rider, sales, supplier, operations, legal and support entries
- Consistent operational clock for order ages and SLA metrics
- SMS OTP restaurant sign-in when Supabase is configured
- Active owner/manager/kitchen membership guard before any vendor data loads
- Protected live branch, active-order, address/landmark/note and menu loading
- Realtime order refresh plus persistent order, availability and branch-operation mutations
- Owner/manager-only new-order approval and branch controls
- Kitchen access limited to accepted-order preparation, hand-off and menu availability
- No customer identity is exposed by the operational order payload

## Database migration

Apply migrations in filename order. `20260811133000_vendor_workspace.sql` adds the vendor workspace context and active-order RPCs, a staff menu read policy, a safe realtime publication update and stricter role checks for order transitions.

The frontend receives only the public Supabase URL and publishable key. Never expose a service-role key in the browser.

## Verification completed

- ESLint: 0 errors; six pre-existing starter Fast Refresh warnings
- TypeScript: passed
- Unit tests: 35 passed across four files
- Production build: passed
- Development route smoke test: `/` and `/vendor` returned rendered output
- Production dependency audit: 0 vulnerabilities

## Phase 3C acceptance work

1. Deploy a separate staging Supabase project and configure a Pakistan-capable SMS provider with abuse controls.
2. Seed invited owner, manager and kitchen accounts plus real pilot menus without customer production data.
3. Prove cross-tenant denial, kitchen/manager role boundaries, concurrent transitions and idempotent ordering in database tests.
4. Connect the customer catalog, saved address and COD confirmation flow to live branch/menu IDs.
5. Add modifiers, opening hours, holiday mode, customer notifications and a support/cancellation timeline.
6. Publish approved Terms, Privacy, Refund and Help content and remove the Lovable edit badge on the production domain.

## Go-live boundary

This is a staging/pilot candidate, not approval for public trading. The current live site remains behind this package until it is deployed and tested with real staging identities and records.
