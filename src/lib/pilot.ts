export type Fulfilment = "delivery" | "collection";

export type TrustedCatalogItem = {
  id: string;
  pricePaisa: number;
  available: boolean;
};

export type RequestedItem = {
  menuItemId: string;
  quantity: number;
};

export type OrderTotals = {
  subtotalPaisa: number;
  deliveryFeePaisa: number;
  serviceFeePaisa: number;
  totalPaisa: number;
};

export function normalizePakistanPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("0092")
    ? digits.slice(4)
    : digits.startsWith("92")
      ? digits.slice(2)
      : digits.startsWith("0")
        ? digits.slice(1)
        : digits;

  return /^3\d{9}$/.test(local) ? `+92${local}` : null;
}

export function calculateTrustedTotals({
  requested,
  catalog,
  fulfilment,
  deliveryFeePaisa,
  serviceFeePaisa,
}: {
  requested: RequestedItem[];
  catalog: TrustedCatalogItem[];
  fulfilment: Fulfilment;
  deliveryFeePaisa: number;
  serviceFeePaisa: number;
}): OrderTotals {
  if (!requested.length || requested.length > 20) {
    throw new Error("An order must contain between 1 and 20 distinct items.");
  }

  const trusted = new Map(catalog.map((item) => [item.id, item]));
  const seen = new Set<string>();
  let subtotalPaisa = 0;

  for (const line of requested) {
    if (seen.has(line.menuItemId)) throw new Error("Duplicate menu item.");
    seen.add(line.menuItemId);
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      throw new Error("Quantity must be a whole number between 1 and 20.");
    }

    const item = trusted.get(line.menuItemId);
    if (!item?.available) throw new Error("A requested item is unavailable.");
    if (!Number.isSafeInteger(item.pricePaisa) || item.pricePaisa < 0) {
      throw new Error("Catalog price is invalid.");
    }
    subtotalPaisa += item.pricePaisa * line.quantity;
  }

  const finalDeliveryFee = fulfilment === "delivery" ? deliveryFeePaisa : 0;
  const totalPaisa = subtotalPaisa + finalDeliveryFee + serviceFeePaisa;
  if (![subtotalPaisa, finalDeliveryFee, serviceFeePaisa, totalPaisa].every(Number.isSafeInteger)) {
    throw new Error("Order total is outside the supported range.");
  }

  return {
    subtotalPaisa,
    deliveryFeePaisa: finalDeliveryFee,
    serviceFeePaisa,
    totalPaisa,
  };
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
