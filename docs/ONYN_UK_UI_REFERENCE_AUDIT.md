# Onyn UK reference → Pakistan UI/UX decisions

Reviewed: 12 August 2026

## Sources reviewed

- UK repository: `asaffilate01-ship-it/onyn`, default branch `main`
- UK live site: `https://onydev.313test.co.uk/`, including `/order` and `/for-business`
- Pakistan repository and the previously delivered Phase 4B launch-hardening package

The UK product is strongest when it explains the Onyn ecosystem: a cinematic food-led hero, memorable purple identity, direct Order/Partner calls to action, separate role journeys and a clear zero-commission story. Its ordering route also avoids forcing the marketing homepage to carry the transaction UI.

The Pakistan build is stronger in its explicit launch boundaries and source-level controls: server-owned pricing, branch schedules and zones, authenticated COD, verified-rider dispatch, immutable cash evidence, support escalation and release gates.

## Adopt, improve or gate

| UK reference pattern                               | Pakistan decision             | Phase 5 result                                                                                    |
| -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Cinematic food hero and purple Onyn identity       | Adopt and localise            | Pakistan hero, Onyn assets, Lahore launch status and mobile-safe CTAs                             |
| Separate `/order` customer journey                 | Adopt                         | Existing marketplace moved intact to `/order`; `/` is now acquisition and trust                   |
| Dedicated business conversion page                 | Adopt and improve             | `/for-business` explains controls, onboarding and costs; calculator is explicitly not a quotation |
| 0% commission proposition                          | Improve disclosure            | Always says Onyn sales commission; subscription, delivery, payments and hardware remain separate  |
| Ecosystem cards for Order, Partner, Driver and POS | Adopt with status labels      | Launch, onboarding, controlled pilot and next-release states prevent false availability           |
| Broad mature-platform promises                     | Gate                          | No claim that payments, automatic dispatch, Urdu, POS hardware or multi-city are live             |
| Customer favourites and repeat ordering            | Adopt with ownership controls | Private persistent favourites; repeat goes through current server prices and availability         |
| Ratings and reviews                                | Improve trust                 | Only delivered/collected orders can rate; optional text is moderated                              |
| Dense role navigation                              | Simplify for launch           | Marketing: Order, Business, Partners, Riders, Help, Account; each workspace remains distinct      |

## Journey now implemented

```text
Marketing home
├── Order food → discovery → restaurant → basket → OTP/account → protected COD → tracking
├── For business → value → savings estimate → controlled onboarding application
├── Rider → Lahore application → evidence screening → assigned delivery workflow
└── Account → addresses → orders → repeat safely → verified rating
```

## Remaining UX evidence before public launch

1. Observe at least five customers, three restaurant staff and three riders completing staging tasks on low/mid-range Android devices.
2. Run keyboard, screen-reader, contrast and 200% zoom checks; close all serious WCAG 2.2 AA findings.
3. Test on constrained 3G and optimise the large marketing image and customer bundle from measured results.
4. Validate English copy with Pakistan operations and legal owners; translate and test Urdu before exposing a language switch.
5. Track funnel events for location selection, restaurant open, add-to-basket, OTP, checkout, partner application and failure reason—without recording sensitive fields.

The Phase 5 UI should be treated as a polished staging candidate, not proof that the operational launch gates have passed.
