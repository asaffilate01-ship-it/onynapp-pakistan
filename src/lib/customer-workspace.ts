export type MarketplaceBranchRow = {
  id: string;
  name: string;
  city: string;
  address_text: string;
  delivery_fee_paisa: number;
  service_fee_paisa: number;
  minimum_order_paisa: number;
  accepts_delivery: boolean;
  accepts_collection: boolean;
  accepting_orders: boolean;
  default_prep_minutes?: number | null;
  busy_mode?: boolean | null;
  schedule_configured?: boolean | null;
  is_open?: boolean | null;
};

export type MarketplaceCategoryRow = {
  id: string;
  branch_id: string;
  name: string;
};

export type MarketplaceMenuRow = {
  id: string;
  branch_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_paisa: number;
  available: boolean;
};

export type MarketplaceOptionGroupRow = {
  id: string;
  menu_item_id: string;
  name: string;
  required: boolean;
  min_selections: number;
  max_selections: number;
};

export type MarketplaceOptionRow = {
  id: string;
  group_id: string;
  name: string;
  price_delta_paisa: number;
  available: boolean;
};

export type CustomerMenuOption = {
  id: string;
  name: string;
  priceDelta: number;
  available: boolean;
};

export type CustomerOptionGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: CustomerMenuOption[];
};

export type CustomerRestaurant = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: string;
  eta: string;
  delivery: number;
  serviceFee: number;
  min: number;
  emoji: string;
  gradient: string;
  tags: string[];
  acceptingOrders: boolean;
  acceptsDelivery: boolean;
  acceptsCollection: boolean;
  openNow: boolean;
  scheduleConfigured: boolean;
  isLive: true;
};

export type CustomerMenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  detail: string;
  price: number;
  emoji: string;
  available: boolean;
  category: string;
  optionGroups: CustomerOptionGroup[];
  isLive: true;
};

export type CustomerOrderLine = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  options: Array<{ groupName: string; optionName: string; priceDelta: number }>;
};

export type CustomerOrderEvent = {
  status: string;
  note: string | null;
  createdAt: string;
};

export type CustomerOrder = {
  id: string;
  reference: string;
  branchId: string;
  branchName: string;
  status: string;
  fulfilment: "delivery" | "collection";
  paymentMethod: string;
  total: number;
  placedAt: string;
  note: string | null;
  lines: CustomerOrderLine[];
  events: CustomerOrderEvent[];
  openSupportCaseId: string | null;
};

const themes = [
  ["🍛", "sunset"],
  ["🍔", "berry"],
  ["🍗", "candy"],
  ["🥘", "leaf"],
  ["🍕", "night"],
] as const;

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

function paisaToRupees(value: number | null | undefined) {
  return Math.round(Number(value ?? 0) / 100);
}

export function mapMarketplaceCatalog(
  branches: MarketplaceBranchRow[],
  categories: MarketplaceCategoryRow[],
  items: MarketplaceMenuRow[],
  optionGroups: MarketplaceOptionGroupRow[] = [],
  options: MarketplaceOptionRow[] = [],
): { restaurants: CustomerRestaurant[]; menu: CustomerMenuItem[] } {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categoriesByBranch = new Map<string, string[]>();
  const optionsByGroup = new Map<string, CustomerMenuOption[]>();
  const groupsByItem = new Map<string, CustomerOptionGroup[]>();

  for (const option of options) {
    const current = optionsByGroup.get(option.group_id) ?? [];
    current.push({
      id: option.id,
      name: option.name,
      priceDelta: paisaToRupees(option.price_delta_paisa),
      available: option.available,
    });
    optionsByGroup.set(option.group_id, current);
  }

  for (const group of optionGroups) {
    const current = groupsByItem.get(group.menu_item_id) ?? [];
    current.push({
      id: group.id,
      name: group.name,
      required: group.required,
      minSelections: group.min_selections,
      maxSelections: group.max_selections,
      options: optionsByGroup.get(group.id) ?? [],
    });
    groupsByItem.set(group.menu_item_id, current);
  }

  for (const category of categories) {
    const current = categoriesByBranch.get(category.branch_id) ?? [];
    current.push(category.name);
    categoriesByBranch.set(category.branch_id, current);
  }

  const restaurants = branches.map((branch) => {
    const theme = themes[stableIndex(branch.id || branch.name, themes.length)];
    const categoryNames = categoriesByBranch.get(branch.id) ?? [];
    const prep = Math.max(10, Number(branch.default_prep_minutes ?? 25));
    return {
      id: branch.id,
      name: branch.name,
      cuisine: categoryNames.slice(0, 2).join(" · ") || "Local favourites",
      rating: 0,
      reviews: "New",
      eta: `${prep}–${prep + (branch.busy_mode ? 20 : 10)} min`,
      delivery: paisaToRupees(branch.delivery_fee_paisa),
      serviceFee: paisaToRupees(branch.service_fee_paisa),
      min: paisaToRupees(branch.minimum_order_paisa),
      emoji: theme[0],
      gradient: theme[1],
      tags: ["Verified pilot partner", ...categoryNames.slice(0, 2)],
      acceptingOrders: branch.accepting_orders && branch.is_open !== false,
      acceptsDelivery: branch.accepts_delivery,
      acceptsCollection: branch.accepts_collection,
      openNow: branch.is_open !== false,
      scheduleConfigured: branch.schedule_configured !== false,
      isLive: true as const,
    };
  });

  const menu = items.map((item) => {
    const category = item.category_id ? categoryById.get(item.category_id)?.name : undefined;
    const theme = themes[stableIndex(item.id || item.name, themes.length)];
    return {
      id: item.id,
      restaurantId: item.branch_id,
      name: item.name,
      detail: item.description?.trim() || category || "Prepared fresh by the restaurant.",
      price: paisaToRupees(item.price_paisa),
      emoji: theme[0],
      available: item.available,
      category: category || "Menu",
      optionGroups: groupsByItem.get(item.id) ?? [],
      isLive: true as const,
    };
  });

  return { restaurants, menu };
}

type CustomerOrderRow = {
  id: string;
  reference: string;
  branch_id: string;
  branch_name: string;
  status: string;
  fulfilment: "delivery" | "collection";
  payment_method: string;
  total_paisa: number;
  customer_note: string | null;
  placed_at: string;
  order_lines?: Array<{
    id: string;
    name: string;
    unit_price_paisa: number;
    quantity: number;
    line_total_paisa: number;
    options?: Array<{
      group_name: string;
      option_name: string;
      price_delta_paisa: number;
    }> | null;
  }> | null;
  order_events?: Array<{ status: string; note: string | null; created_at: string }> | null;
  open_support_case_id?: string | null;
};

export function mapCustomerOrders(rows: CustomerOrderRow[]): CustomerOrder[] {
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    branchId: row.branch_id,
    branchName: row.branch_name,
    status: row.status,
    fulfilment: row.fulfilment,
    paymentMethod: row.payment_method,
    total: paisaToRupees(row.total_paisa),
    placedAt: row.placed_at,
    note: row.customer_note,
    lines: (row.order_lines ?? []).map((line) => ({
      id: line.id,
      name: line.name,
      unitPrice: paisaToRupees(line.unit_price_paisa),
      quantity: line.quantity,
      lineTotal: paisaToRupees(line.line_total_paisa),
      options: (line.options ?? []).map((option) => ({
        groupName: option.group_name,
        optionName: option.option_name,
        priceDelta: paisaToRupees(option.price_delta_paisa),
      })),
    })),
    events: (row.order_events ?? []).map((event) => ({
      status: event.status,
      note: event.note,
      createdAt: event.created_at,
    })),
    openSupportCaseId: row.open_support_case_id ?? null,
  }));
}

export function optionSelectionError(item: CustomerMenuItem, selectedOptionIds: string[]) {
  const selected = new Set(selectedOptionIds);
  for (const group of item.optionGroups) {
    const count = group.options.filter((option) => selected.has(option.id)).length;
    if (count < group.minSelections)
      return `Choose at least ${group.minSelections} from ${group.name}.`;
    if (count > group.maxSelections)
      return `Choose no more than ${group.maxSelections} from ${group.name}.`;
  }
  return null;
}

export function configuredItemPrice(item: CustomerMenuItem, selectedOptionIds: string[]) {
  const selected = new Set(selectedOptionIds);
  return (
    item.price +
    item.optionGroups
      .flatMap((group) => group.options)
      .filter((option) => selected.has(option.id))
      .reduce((total, option) => total + option.priceDelta, 0)
  );
}

export function optionSelectionSignature(menuItemId: string, selectedOptionIds: string[]) {
  return `${menuItemId}:${[...new Set(selectedOptionIds)].sort().join(",")}`;
}

export function customerOrderProgress(status: string): number {
  const progress: Record<string, number> = {
    placed: 15,
    accepted: 35,
    preparing: 58,
    ready: 78,
    picked_up: 88,
    delivered: 100,
    collected: 100,
  };
  return progress[status] ?? 0;
}

export function canRequestCancellation(status: string) {
  return ["placed", "accepted", "preparing", "ready"].includes(status);
}
