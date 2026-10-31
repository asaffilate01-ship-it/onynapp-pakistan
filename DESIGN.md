# Dishbee+ Pakistan · UI design authority

## This product
Pakistan-first food ordering/delivery marketplace and restaurant vendor/rider operations SaaS.

## Brand
Use the Dishbee black-and-yellow brand direction for public and product UI, while preserving semantic status colours for preparation, delivery and payment states. Current source has an Inter-based UI; check existing components before changing theme tokens.

## Critical UX direction
Low-bandwidth mobile ordering, readable menus, meal and basket combinations, clear fees, live order status, vendor availability, rider pickup/dropoff and accurate address/payment retries. Build separate customer/vendor/rider/admin surfaces, never fake real-time order status or hide commissions and delivery costs.

## Delivery quality
- Distinctive, calm public marketing with genuine product-specific information; no generic gradient/card overload, fabricated reviews or misleading feature badges.
- Operational dashboards must favour readable status, task urgency, role-specific navigation, efficient tables and fast recoverable forms. Preserve real route and server permissions.
- Responsive checks: 360, 390, 768, 1440px. Include keyboard and screen-reader access, focus rings, 200% zoom, contrast, RTL/local language where relevant, reduced motion and touch targets.
- Provide clear empty, loading, offline, partial failure, permission and payment states with retries; keep accessibility and data safety higher priority than visual novelty.
- Existing source code and tokens govern the implementation, not an external brand imitation.

## Three complementary open-source practices
- [Taste Skill](https://github.com/Leonxlnx/taste-skill): audience-led art direction, typography, spacing and real responsive inspection.
- [Impeccable](https://github.com/pbakaus/impeccable): iterate through targeted critique, audit, harden and polish; advisory static scan `npx --yes impeccable@4.8.0 detect src/`.
- [Awesome DESIGN.md](https://github.com/VoltAgent/awesome-design-md): reference layouts for documenting an owned design system; never copy someone else's logo, palette or trademarks without a brand decision.

## Verification
Run existing lint/build/tests, real manual flow and mobile/desktop review; a non-blocking audit is a baseline only. Never treat a created PR as a live deployed feature.
