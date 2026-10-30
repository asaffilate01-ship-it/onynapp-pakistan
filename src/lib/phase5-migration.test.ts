import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260812103000_customer_retention.sql", import.meta.url),
  "utf8",
);

describe("Phase 5 customer retention contract", () => {
  it("keeps favourites private and server-owned", () => {
    expect(migration).toContain("customer_favourites_own_select");
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain("customer_set_favourite");
  });

  it("allows reviews only for the customer's completed order", () => {
    expect(migration).toContain("customer_id = auth.uid()");
    expect(migration).toContain("status in ('delivered', 'collected')");
    expect(migration).toContain("Only completed orders can be reviewed");
  });

  it("repeats orders through current server pricing and idempotency", () => {
    expect(migration).toContain("customer_repeat_cod_order");
    expect(migration).toContain("public.create_cod_order");
    expect(migration).toContain("p_idempotency_key");
  });
});
