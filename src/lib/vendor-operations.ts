export type VendorOrderStatus =
  "placed" | "accepted" | "preparing" | "ready" | "completed" | "rejected";

export type VendorOrderLine = {
  id: string;
  name: string;
  quantity: number;
  station: "Kitchen" | "Grill" | "Drinks";
  note?: string;
};

export type VendorOrder = {
  id: string;
  reference: string;
  customer: string;
  status: VendorOrderStatus;
  fulfilment: "delivery" | "collection";
  payment: "cod" | "paid";
  totalPaisa: number;
  placedAt: string;
  promisedMinutes: number;
  address?: string;
  note?: string;
  rejectionReason?: string;
  lines: VendorOrderLine[];
};

const transitions: Record<VendorOrderStatus, VendorOrderStatus[]> = {
  placed: ["accepted", "rejected"],
  accepted: ["preparing"],
  preparing: ["ready"],
  ready: ["completed"],
  completed: [],
  rejected: [],
};

export function canVendorTransition(from: VendorOrderStatus, to: VendorOrderStatus): boolean {
  return transitions[from].includes(to);
}

export function applyVendorTransition(
  order: VendorOrder,
  next: VendorOrderStatus,
  note?: string,
): VendorOrder {
  if (!canVendorTransition(order.status, next)) {
    throw new Error(`Invalid order transition: ${order.status} to ${next}.`);
  }
  if (next === "rejected" && (note?.trim().length ?? 0) < 3) {
    throw new Error("A clear rejection reason is required.");
  }

  return {
    ...order,
    status: next,
    rejectionReason: next === "rejected" ? note?.trim() : order.rejectionReason,
  };
}

export type Urgency = "on-time" | "watch" | "late";

export function orderAgeMinutes(order: Pick<VendorOrder, "placedAt">, now = Date.now()): number {
  const placed = Date.parse(order.placedAt);
  if (!Number.isFinite(placed)) return 0;
  return Math.max(0, Math.floor((now - placed) / 60_000));
}

export function getOrderUrgency(
  order: Pick<VendorOrder, "placedAt" | "promisedMinutes" | "status">,
  now = Date.now(),
): Urgency {
  if (["ready", "completed", "rejected"].includes(order.status)) return "on-time";
  const remaining = order.promisedMinutes - orderAgeMinutes(order, now);
  if (remaining <= 0) return "late";
  if (remaining <= 5) return "watch";
  return "on-time";
}

export function vendorMetrics(orders: VendorOrder[]) {
  const active = orders.filter((order) => !["completed", "rejected"].includes(order.status));
  const accepted = orders.filter((order) =>
    ["accepted", "preparing", "ready", "completed"].includes(order.status),
  ).length;
  const decided = orders.filter((order) => order.status !== "placed").length;
  const codOutstanding = active
    .filter((order) => order.payment === "cod")
    .reduce((sum, order) => sum + order.totalPaisa, 0);

  return {
    newOrders: active.filter((order) => order.status === "placed").length,
    cooking: active.filter((order) => ["accepted", "preparing"].includes(order.status)).length,
    ready: active.filter((order) => order.status === "ready").length,
    late: active.filter((order) => getOrderUrgency(order) === "late").length,
    acceptanceRate: decided === 0 ? 0 : Math.round((accepted / decided) * 100),
    codOutstanding,
  };
}

export function formatPkr(paisa: number): string {
  return `Rs. ${Math.round(paisa / 100).toLocaleString("en-PK")}`;
}
