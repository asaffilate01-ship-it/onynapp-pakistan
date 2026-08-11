# Phase 3A handoff — restaurant operations

Updated: 11 August 2026

## Delivered

- `/vendor` responsive restaurant workspace
- Orders, Kitchen, Menu, Reports and More navigation
- New → Accepted → Preparing → Ready → hand-off state flow
- Required rejection reason
- Order urgency, customer note, landmark, collection/delivery and COD visibility
- Kitchen item bumping and station labels
- Accepting-orders, busy-mode, preparation-time and order-capacity model
- Menu sold-out control
- Protected Supabase functions, order events and audit events
- Live order list and realtime subscription adapters
- UK parent-to-Pakistan feature matrix

## Verification

- TypeScript: passed
- Unit tests: 23 passed
- Production build: passed
- Production dependency audit: 0 vulnerabilities
- ESLint: 0 errors; six existing starter-component Fast Refresh warnings

## Connection checklist

1. Create a separate staging Supabase project.
2. Apply both migrations in filename order.
3. Configure only the public Supabase URL and publishable key in the frontend.
4. Seed an organisation, branch, menu and test memberships without real customer data.
5. Replace demo fixtures with `listVendorBranchOrders` and subscribe with `subscribeToVendorBranchOrders`.
6. Call only the protected RPC adapters for order status, menu availability and branch operations.
7. Run cross-tenant denial, concurrent-transition and reconnect tests before inviting a restaurant.

## Known boundary

The restaurant UI is a controlled prototype until signed-in branch data is connected in staging. It must not receive public production orders or real COD liabilities yet.
