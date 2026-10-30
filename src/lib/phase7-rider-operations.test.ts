import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261030090000_rider_live_operations.sql", import.meta.url),
  "utf8",
);

describe("Phase 7 rider live operations migration", () => {
  it("keeps precise presence private and role-scoped", () => {
    expect(migration).toContain("alter table public.rider_presence enable row level security");
    expect(migration).toContain("rider_presence_own_select");
    expect(migration).toContain("rider_presence_ops_select");
    expect(migration).toContain("revoke all on public.rider_presence from anon, authenticated");
  });

  it("requires verified online riders before dispatch", () => {
    expect(migration).toContain("Approved and verified rider required");
    expect(migration).toContain("Rider is not online and available");
    expect(migration).toContain("availability_status = 'online'");
  });

  it("rejects poor and implausible location updates", () => {
    expect(migration).toContain("Location accuracy is not sufficient");
    expect(migration).toContain("Implausible rider location change");
  });

  it("returns auditable COD liability rather than invented earnings", () => {
    expect(migration).toContain("'cash_balance_paisa'");
    expect(migration).toContain("from public.cod_ledger_entries");
  });
});
