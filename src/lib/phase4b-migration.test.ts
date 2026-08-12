import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260811203000_launch_hardening.sql", import.meta.url),
  "utf8",
);

describe("Phase 4B launch-hardening database contract", () => {
  it("keeps rider evidence private and approval verification-gated", () => {
    expect(migration).toContain("public.rider_verification_documents");
    expect(migration).toContain("bucket_id = 'rider-verification'");
    expect(migration).toContain("verification_status = 'verified'");
    expect(migration).toContain("A verified document cannot be replaced");
  });

  it("records collection and cash handover in an append-only COD ledger", () => {
    expect(migration).toContain("create table public.cod_ledger_entries");
    expect(migration).toContain("'collection'");
    expect(migration).toContain("'handover', -p_received_paisa");
    expect(migration).toContain("Received cash does not match rider collection");
  });

  it("protects OTP and notification worker RPCs with the service role", () => {
    expect(migration).toContain("service_reserve_otp_send");
    expect(migration).toContain("service_claim_notification_batch");
    expect(migration).toContain(
      "current_setting('request.jwt.claim.role', true) <> 'service_role'",
    );
    expect(migration).toContain("to service_role");
  });

  it("requires evidence before a launch gate can pass", () => {
    expect(migration).toContain("create table public.launch_control_checks");
    expect(migration).toContain("Evidence note required before passing a launch gate");
  });
});
