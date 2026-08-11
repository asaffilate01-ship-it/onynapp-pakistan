import { describe, expect, it } from "vitest";
import {
  applyVendorTransition,
  canVendorTransition,
  formatPkr,
  getOrderUrgency,
  orderAgeMinutes,
  type VendorOrder,
  vendorMetrics,
} from "./vendor-operations";

const base: VendorOrder = {
  id: "order-1",
  reference: "ONY-1047",
  customer: "Ayesha",
  status: "placed",
  fulfilment: "delivery",
  payment: "cod",
  totalPaisa: 237_000,
  placedAt: "2026-08-11T10:00:00.000Z",
  promisedMinutes: 20,
  lines: [{ id: "line-1", name: "Karahi", quantity: 1, station: "Kitchen" }],
};

describe("vendor order state machine", () => {
  it("allows the controlled kitchen path", () => {
    expect(canVendorTransition("placed", "accepted")).toBe(true);
    expect(canVendorTransition("accepted", "preparing")).toBe(true);
    expect(canVendorTransition("preparing", "ready")).toBe(true);
    expect(canVendorTransition("ready", "completed")).toBe(true);
  });

  it("blocks skipping a state", () => {
    expect(canVendorTransition("placed", "ready")).toBe(false);
    expect(() => applyVendorTransition(base, "ready")).toThrow("Invalid order transition");
  });

  it("requires a useful rejection reason", () => {
    expect(() => applyVendorTransition(base, "rejected", "no")).toThrow("A clear rejection reason");
  });

  it("records a trimmed rejection reason", () => {
    expect(applyVendorTransition(base, "rejected", "  Item sold out  ").rejectionReason).toBe(
      "Item sold out",
    );
  });
});

describe("vendor operational calculations", () => {
  it("calculates non-negative order age", () => {
    expect(orderAgeMinutes(base, Date.parse("2026-08-11T10:06:30.000Z"))).toBe(6);
    expect(orderAgeMinutes(base, Date.parse("2026-08-11T09:59:00.000Z"))).toBe(0);
  });

  it("flags an order near its promised time", () => {
    expect(getOrderUrgency(base, Date.parse("2026-08-11T10:16:00.000Z"))).toBe("watch");
  });

  it("flags an overdue active order", () => {
    expect(getOrderUrgency(base, Date.parse("2026-08-11T10:21:00.000Z"))).toBe("late");
  });

  it("does not flag a ready order as late", () => {
    expect(
      getOrderUrgency({ ...base, status: "ready" }, Date.parse("2026-08-11T11:00:00.000Z")),
    ).toBe("on-time");
  });

  it("summarises active orders and COD exposure", () => {
    const metrics = vendorMetrics([
      base,
      { ...base, id: "2", status: "preparing", totalPaisa: 100_000 },
      { ...base, id: "3", status: "ready", payment: "paid", totalPaisa: 50_000 },
      { ...base, id: "4", status: "rejected", totalPaisa: 80_000 },
    ]);
    expect(metrics.newOrders).toBe(1);
    expect(metrics.cooking).toBe(1);
    expect(metrics.ready).toBe(1);
    expect(metrics.codOutstanding).toBe(337_000);
    expect(metrics.acceptanceRate).toBe(67);
  });

  it("formats paisa as Pakistan rupees", () => {
    expect(formatPkr(237_000)).toBe("Rs. 2,370");
  });
});
