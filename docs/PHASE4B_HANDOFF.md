# Phase 4B handoff — launch hardening and controlled operations

Updated: 11 August 2026

## Outcome

Phase 4B builds on the local Phase 4A candidate and raises estimated source readiness from 65% to 74%. It closes four material code gaps: secure rider evidence, verification-gated dispatch, auditable COD handover and trusted OTP/notification processing. It remains a staging candidate, not permission to accept unrestricted public orders.

## Features delivered

- Private `rider-verification` storage bucket with JPEG/PNG/PDF allow-list and 5 MB limit
- Rider-only upload and metadata registration during screening
- Operations-only five-minute evidence links and document verification/rejection
- CNIC front/back requirement; motorbike riders also require verified licence evidence
- Rider approval, job progression and dispatch all require verified status
- Append-only COD collection and cash-handover ledger
- Exact cash count and reconciliation from `/ops`; repeat handover is rejected
- OTP requests routed through a public Edge Function with salted phone/IP rate limits
- Sixty-second browser resend cooldown
- Trusted notification outbox worker with atomic claims, exponential retry and dead-letter state
- Operations visibility for notification queue health
- Ten evidence-backed security, legal, financial, reliability and quality launch gates
- Responsive rider evidence, COD and operations release-control UI

## Files that control deployment

- `supabase/migrations/20260811203000_launch_hardening.sql`
- `supabase/functions/request-otp/index.ts`
- `supabase/functions/process-notifications/index.ts`
- `supabase/config.toml`
- `supabase/README.md`

## Verification completed

- ESLint: 0 errors; six unchanged starter Fast Refresh warnings
- TypeScript: passed
- Unit and security-contract tests: 57 passed across ten files
- Production Cloudflare/Nitro build: passed
- Route smoke: all 13 public and protected routes returned HTTP 200
- Production dependency audit: 0 known vulnerabilities
- Archive integrity: checked during final package creation

The migration and Edge Functions have not been executed against a real Supabase staging project in this environment. Their live database, storage, SMS-provider and role-matrix acceptance remains mandatory.

## Mandatory staging sequence

1. Apply all migrations to an isolated Supabase staging project.
2. Deploy both Edge Functions and set only server-side secrets described in `supabase/README.md`.
3. Configure the chosen Pakistan SMS provider adapter and send/verify real OTPs on at least two networks.
4. Test phone and IP throttling, generic failures, resend cooldown, retry and dead-letter handling.
5. Test rider document access with rider, unrelated rider, customer, vendor, support and operations identities.
6. Verify the required documents, approve the rider and prove an unverified rider cannot be approved, dispatched or progress a job.
7. Complete a COD order, hand over the exact physical amount, reconcile it and prove the ledger nets to zero.
8. Run the complete RLS/role matrix and the Phase 4A acceptance list.
9. Complete backup restore, incident response, real-device/accessibility and low-bandwidth exercises.
10. Obtain Pakistan legal approval and name the operational owners before changing any launch gate to passed.

## Remaining real-launch blockers

- A contracted Pakistan SMS gateway and observed delivery-receipt behaviour
- Staff rotas and named owners for dispatch, support, cash and incidents
- Backup/restore, monitoring, alerting, rollback and load evidence
- Retention/deletion policy for CNIC and licence evidence
- Pakistan company/contact/domain and counsel-approved terms/privacy/refunds
- Real-device, accessibility, Urdu-content and low-bandwidth acceptance
- Refund tooling, four-eyes privileged approvals and finance/audit export

Online payments, automated dispatch, grocery, pharmacy, courier, vouchers, loyalty and multi-city ordering remain intentionally outside the controlled Lahore COD pilot.
