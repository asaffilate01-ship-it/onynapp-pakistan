import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260811170000_hours_modifiers_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Phase 3D database contract", () => {
  it("blocks checkout outside the server-owned Pakistan schedule", () => {
    expect(migration).toContain("time zone 'Asia/Karachi'");
    expect(migration).toContain("select count(*) = 7 from public.branch_hours");
    expect(migration).toContain("if not public.branch_is_open(p_branch_id)");
    expect(migration).toContain("branch is currently closed");
  });

  it("prices and snapshots selected options on the server", () => {
    expect(migration).toContain("option selection is invalid for %");
    expect(migration).toContain("v_menu.price_paisa + v_option_total");
    expect(migration).toContain("insert into public.order_line_options");
  });

  it("keeps outbound delivery server-only and customer notifications tenant-scoped", () => {
    expect(migration).toContain("notification_outbox");
    expect(migration).toContain("revoke all on public.branch_hours");
    expect(migration).toContain("customer_notifications_own_select");
    expect(migration).toContain("user_id = auth.uid()");
  });

  it("limits schedule and modifier mutations to authorised branch roles", () => {
    expect(migration).toContain("vendor_set_weekly_hours");
    expect(migration).toContain("array['owner', 'manager']::public.app_role[]");
    expect(migration).toContain("vendor_set_menu_option_availability");
  });
});
