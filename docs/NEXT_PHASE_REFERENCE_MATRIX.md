# Onyn UK → Onyn Pakistan next-phase reference matrix

Updated: 11 August 2026

## Reference checked

- Parent repository: `asaffilate01-ship-it/onyn`, main commit `74cd810726128786f599b99c6de32a97d1ccf85b`
- Live reference: `https://onydev.313test.co.uk/`
- Pakistan candidate: this repository, including the `/vendor` restaurant workspace

The live UK site currently returns a country-availability screen to a browser outside the United Kingdom and United Arab Emirates. Public branding and the geo gate were verified live; authenticated vendor implementation details were therefore checked against the current parent repository. The live restriction must not be copied to Pakistan: country/serviceability rules belong in server-side Pakistan configuration with a useful launch-city waitlist.

## What the parent establishes

The parent is a broad multi-role product. Its route tree includes customer ordering and tracking, vendor orders, PDA, KDS, POS, menu, staff, inventory, reports, earnings, subscriptions, marketing, drivers, suppliers, agents, franchises and administration. This is a useful product map, not a safe instruction to launch every module together.

The next Pakistan build deliberately selects the operational core required to make the existing customer prototype fulfilable.

| Parent pattern                                     | Pakistan adaptation                                                              | Built in this phase                      | Remaining acceptance evidence                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| Vendor sidebar with grouped operations             | Compact Orders, Kitchen, Menu, Reports and More; mobile bottom navigation        | Yes                                      | Authenticated role usability test with owner, manager and kitchen users |
| Live incoming order count and notifications        | Visible new-order count, live summary and safe demo/backend state                | UI and adapter                           | SMS/push provider delivery evidence and audible alert device test       |
| Order statuses: placed, accepted, preparing, ready | Same server-controlled state path plus completion hand-off                       | UI, pure state machine and protected RPC | Staging end-to-end test using real branch/member records                |
| Accept/reject and ETA handling                     | Rejection requires an audit reason; busy mode changes the displayed prep default | Yes                                      | Customer ETA-consent and cancellation policy workflow                   |
| KDS kanban, urgency and item bumping               | New/Cooking/Ready board, station labels, item bumping and large touch targets    | Yes                                      | Tablet, printer and kitchen-network rehearsal                           |
| Menu availability                                  | Immediate sold-out/available control backed by a protected RPC                   | Yes                                      | Real menu load, modifiers, bulk import and cross-device update test     |
| Vendor revenue summaries                           | Order value and COD exposure are separated; gross value is not labelled earnings | Yes                                      | Settled payment/refund/delivery-cost reconciliation                     |
| Auto-pause and prep-time settings                  | Accepting-orders, busy mode, prep time and order-capacity schema                 | UI and protected RPC                     | Automatic threshold worker and customer-facing availability test        |
| POS, tables, inventory, staff and shifts           | Kept out of the primary pilot navigation until core orders are proven            | Planned                                  | Phase 4 scope and hardware/vendor selection                             |
| Aggregator consolidation                           | Not copied into the launch pilot                                                 | Later                                    | Commercial API agreements and duplicate/order ownership rules           |

## Security decisions that differ from the parent

The Pakistan implementation does not let a browser write `orders.status`, branch operations or menu availability directly. Each sensitive mutation is a `security definer` database function with:

- authenticated branch-membership checks;
- explicit allowed state transitions;
- a locked row for order transitions;
- a mandatory reason for rejection;
- server timestamps;
- audit or order-event records;
- no service-role key in client code.

The repository still requires staging RLS denial tests, rate-limited OTP delivery, protected deployment credentials and an independent penetration test before public launch.

## Phase sequence from here

### Phase 3A — completed in this candidate

- Separate Pakistan restaurant workspace at `/vendor`
- Responsive order board and KDS
- Accept, reject, prepare, ready and hand-off interactions
- COD exposure, customer landmark/note and delivery/collection signals
- Busy/accepting controls and default preparation time
- Menu sold-out control
- Protected Supabase operations and realtime/list adapters
- Tested vendor state machine and urgency/metrics logic

### Phase 3B — next build

- Authenticated owner/manager/kitchen route guards and branch selector
- Real branch, menu and order loading instead of demo fixtures
- Customer status subscription and vendor/customer notifications
- Modifier groups, opening hours, holiday mode and menu import
- Pilot support/cancellation console and order timeline
- Staging RLS denial and concurrency/idempotency tests

### Phase 4 — controlled fulfilment and money

- Rider onboarding and manual dispatch console
- Pickup verification, proof of delivery and COD handover ledger
- ePOS cash shift, receipt/printer adapter and cash reconciliation
- Vendor subscription, statement and sales-agent attribution ledger
- Approved JazzCash/Easypaisa/Raast/card integration only after contracts and webhook design

### Phase 5 — public city launch

- Urdu content and tested localisation
- Automatic dispatch with manual override
- Refunds and disputes
- Monitoring, backups/restore drill, load testing and incident rehearsal
- Accessibility/usability evidence, penetration test and legal/privacy launch pack

## Pilot exit condition

Do not promote the prototype because screens look complete. Phase 3 exits only after 20 invited restaurants can receive and complete real COD orders in staging, cross-tenant attempts are denied, status events remain consistent during retries, and a four-week controlled pilot reaches at least 98% technically successful orders with COD reconciliation explained to the paisa.
