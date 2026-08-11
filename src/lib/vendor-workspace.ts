import type { VendorOrder, VendorOrderLine, VendorOrderStatus } from "./vendor-operations";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function integer(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function stationFor(name: string): VendorOrderLine["station"] {
  if (/drink|cola|lemonade|lassi|water|juice/i.test(name)) return "Drinks";
  if (/naan|roti|paratha|burger|boti|tikka|kebab|grill/i.test(name)) return "Grill";
  return "Kitchen";
}

function mapStatus(value: unknown): VendorOrderStatus {
  if (["placed", "accepted", "preparing", "ready", "rejected"].includes(String(value))) {
    return String(value) as VendorOrderStatus;
  }
  if (["picked_up", "collected", "delivered"].includes(String(value))) return "completed";
  throw new Error("Unsupported vendor order status.");
}

export function mapVendorBackendOrder(row: unknown, promisedMinutes: number): VendorOrder {
  const source = record(row);
  const rawLines = Array.isArray(source.order_lines) ? source.order_lines : [];
  const lines = rawLines.map((value, index): VendorOrderLine => {
    const line = record(value);
    const name = text(line.name, "Menu item");
    const options = Array.isArray(line.options)
      ? line.options.map((option) => text(option)).filter(Boolean)
      : [];
    return {
      id: text(line.id, `line-${index}`),
      name,
      quantity: Math.max(1, integer(line.quantity, 1)),
      station: stationFor(name),
      note: options.length ? options.join(" · ") : undefined,
    };
  });

  const address = [text(source.address_text), text(source.landmark)].filter(Boolean).join(" · ");
  const note = [text(source.customer_note), text(source.delivery_note)].filter(Boolean).join(" · ");

  return {
    id: text(source.id),
    reference: text(source.reference, "Order"),
    customer: "Customer",
    status: mapStatus(source.status),
    fulfilment: source.fulfilment === "collection" ? "collection" : "delivery",
    payment: source.payment_method === "cod" ? "cod" : "paid",
    totalPaisa: Math.max(0, integer(source.total_paisa)),
    placedAt: text(source.placed_at, new Date(0).toISOString()),
    promisedMinutes: Math.min(90, Math.max(10, promisedMinutes)),
    address: address || undefined,
    note: note || undefined,
    lines,
  };
}

export type VendorMenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
  optionGroups: Array<{
    id: string;
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    options: Array<{
      id: string;
      name: string;
      priceDelta: number;
      available: boolean;
    }>;
  }>;
};

export function mapVendorBackendMenuItem(row: unknown): VendorMenuItem {
  const source = record(row);
  const rawGroups = Array.isArray(source.menu_option_groups) ? source.menu_option_groups : [];
  return {
    id: text(source.id),
    name: text(source.name, "Menu item"),
    category: "Menu",
    price: Math.round(integer(source.price_paisa) / 100),
    available: source.available === true,
    optionGroups: rawGroups.map((value) => {
      const group = record(value);
      const rawOptions = Array.isArray(group.menu_options) ? group.menu_options : [];
      return {
        id: text(group.id),
        name: text(group.name, "Options"),
        required: group.required === true,
        minSelections: integer(group.min_selections),
        maxSelections: Math.max(1, integer(group.max_selections, 1)),
        options: rawOptions.map((optionValue) => {
          const option = record(optionValue);
          return {
            id: text(option.id),
            name: text(option.name, "Option"),
            priceDelta: Math.round(integer(option.price_delta_paisa) / 100),
            available: option.available === true,
          };
        }),
      };
    }),
  };
}
