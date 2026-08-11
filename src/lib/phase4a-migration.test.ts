import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260811190000_launch_control.sql", import.meta.url),
  "utf8",
);

describe("Phase 4A controlled-launch database contract", () => {
  it("separates platform staff from vendor memberships", () => {
    expect(migration).toContain("create table public.platform_staff");
    expect(migration).toContain("public.is_platform_staff");
    expect(migration).toContain("Not authorised");
  });

  it("protects support, applications and dispatch behind RPC ownership checks", () => {
    expect(migration).toContain("applicant_id = auth.uid()");
    expect(migration).toContain("customer_id = auth.uid()");
    expect(migration).toContain("rider_id = auth.uid()");
    expect(migration).toContain("Approved rider required");
  });

  it("keeps rider and order state changes atomic", () => {
    expect(migration).toContain("Invalid delivery transition");
    expect(migration).toContain("COD collection must match the order total");
    expect(migration).toContain("insert into public.order_events");
  });

  it("limits menu imports and authorises the branch role", () => {
    expect(migration).toContain("Import must contain 1 to 200 items");
    expect(migration).toContain("array['owner', 'manager']::public.app_role[]");
    expect(migration).toContain("menu.imported");
  });
});
