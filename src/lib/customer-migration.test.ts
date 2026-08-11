import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260811150000_customer_pilot.sql", import.meta.url),
  "utf8",
);

describe("Phase 3C customer migration security contract", () => {
  it("enforces a customer-owned branch service zone on every delivery order", () => {
    expect(migration).toContain("create trigger enforce_order_serviceability");
    expect(migration).toContain("a.user_id = new.customer_id");
    expect(migration).toContain("z.branch_id = b.id");
    expect(migration).toContain("b.accepting_orders = true");
  });

  it("keeps customer order and cancellation functions authenticated", () => {
    expect(migration).toContain("where o.customer_id = auth.uid()");
    expect(migration).toContain("where id = p_order_id and customer_id = v_user_id");
    expect(migration).toContain("grant execute on function public.customer_list_orders()");
    expect(migration).toContain("to authenticated;");
  });

  it("escalates accepted cancellations instead of silently changing status", () => {
    expect(migration).toContain("v_order.status in ('accepted', 'preparing', 'ready')");
    expect(migration).toContain("'cancellation_request'");
    expect(migration).toContain("'review_requested'::text");
  });
});
