import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  mapCustomerOrders,
  mapMarketplaceCatalog,
  type CustomerOrder,
  type MarketplaceBranchRow,
  type MarketplaceCategoryRow,
  type MarketplaceMenuRow,
} from "./customer-workspace";
import { newIdempotencyKey, normalizePakistanPhone, type Fulfilment } from "./pilot";

let client: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    client = null;
    return client;
  }

  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });
  return client;
}

export function isPilotBackendConfigured(): boolean {
  return getSupabaseClient() !== null;
}

export async function requestPakistanOtp(
  rawPhone: string,
  options: { shouldCreateUser?: boolean } = {},
): Promise<
  | { ok: true; phone: string }
  | { ok: false; reason: "invalid" | "not_configured" | "provider_error"; message: string }
> {
  const phone = normalizePakistanPhone(rawPhone);
  if (!phone) {
    return { ok: false, reason: "invalid", message: "Enter a valid Pakistan mobile number." };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Secure mobile sign-in will activate when the pilot backend is configured.",
    };
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: options.shouldCreateUser ?? true },
  });
  if (error) {
    return {
      ok: false,
      reason: "provider_error",
      message: "We could not send a code. Wait a moment and try again.",
    };
  }

  return { ok: true, phone };
}

export async function verifyPakistanOtp(
  rawPhone: string,
  token: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const phone = normalizePakistanPhone(rawPhone);
  if (!phone || !/^\d{6}$/.test(token)) {
    return { ok: false, message: "Enter the complete six-digit code." };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, message: "Secure mobile sign-in is not configured." };

  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return { ok: false, message: "That code is invalid or has expired." };
  return { ok: true };
}

export type CodOrderInput = {
  branchId: string;
  addressId: string | null;
  fulfilment: Fulfilment;
  items: Array<{ menuItemId: string; quantity: number }>;
  note?: string;
  idempotencyKey?: string;
};

export type CreatedCodOrder = {
  order_id: string;
  reference: string;
  total_paisa: number;
  status: string;
};

export async function createCodOrder(input: CodOrderInput): Promise<CreatedCodOrder> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");

  const { data, error } = await supabase.rpc("create_cod_order", {
    p_branch_id: input.branchId,
    p_address_id: input.addressId,
    p_fulfilment: input.fulfilment,
    p_items: input.items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
    })),
    p_note: input.note?.trim() || null,
    p_idempotency_key: input.idempotencyKey ?? newIdempotencyKey(),
  });
  if (error) throw new Error("The order could not be created safely. Please review your basket.");
  const order = Array.isArray(data) ? data[0] : data;
  if (!order) throw new Error("The order was not returned by the server.");
  return order as CreatedCodOrder;
}

export async function getCurrentCustomer() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function listMarketplaceCatalog(city = "Lahore") {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");

  const { data: branches, error: branchError } = await supabase
    .from("branches")
    .select(
      "id, name, city, address_text, delivery_fee_paisa, service_fee_paisa, minimum_order_paisa, accepts_delivery, accepts_collection, accepting_orders, default_prep_minutes, busy_mode",
    )
    .eq("active", true)
    .eq("city", city)
    .order("name")
    .limit(100);
  if (branchError) throw new Error("The live restaurant list could not be loaded.");

  const branchIds = (branches ?? []).map((branch) => branch.id as string);
  if (branchIds.length === 0) return { restaurants: [], menu: [] };

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, branch_id, name")
      .in("branch_id", branchIds)
      .eq("active", true)
      .order("sort_order")
      .limit(500),
    supabase
      .from("menu_items")
      .select("id, branch_id, category_id, name, description, price_paisa, available")
      .in("branch_id", branchIds)
      .eq("active", true)
      .order("name")
      .limit(2000),
  ]);

  if (categoriesResult.error || itemsResult.error) {
    throw new Error("The live menus could not be loaded.");
  }

  return mapMarketplaceCatalog(
    (branches ?? []) as MarketplaceBranchRow[],
    (categoriesResult.data ?? []) as MarketplaceCategoryRow[],
    (itemsResult.data ?? []) as MarketplaceMenuRow[],
  );
}

export async function saveCustomerPilotAddress(input: {
  label: string;
  city: string;
  addressLine: string;
  landmark: string;
  deliveryNote?: string;
}): Promise<{ id: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("customer_save_pilot_address", {
    p_label: input.label,
    p_city: input.city,
    p_address_line: input.addressLine,
    p_landmark: input.landmark,
    p_delivery_note: input.deliveryNote?.trim() || null,
  });
  if (error) throw new Error("This address could not be verified for the selected delivery area.");
  const address = Array.isArray(data) ? data[0] : data;
  if (!address?.id) throw new Error("The verified address was not returned by the server.");
  return { id: address.id as string };
}

export async function listCustomerOrders(): Promise<CustomerOrder[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("customer_list_orders");
  if (error) throw new Error("Your live orders could not be loaded.");
  return mapCustomerOrders((data ?? []) as Parameters<typeof mapCustomerOrders>[0]);
}

export async function requestCustomerCancellation(orderId: string, reason: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("customer_request_cancellation", {
    p_order_id: orderId,
    p_reason: reason.trim(),
  });
  if (error) throw new Error("The cancellation request could not be submitted.");
  const result = Array.isArray(data) ? data[0] : data;
  return result as {
    outcome: "cancelled" | "review_requested" | "not_allowed";
    order_status: string;
    support_case_id: string | null;
  };
}

export async function signOutCustomer() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Sign out could not be completed.");
}

export function subscribeToCustomerOrders(customerId: string, onChange: () => void) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel(`customer-orders-${customerId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${customerId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function transitionVendorOrder({
  orderId,
  expected,
  next,
  note,
}: {
  orderId: string;
  expected: "placed" | "accepted" | "preparing" | "ready";
  next: "accepted" | "rejected" | "preparing" | "ready" | "picked_up" | "collected";
  note?: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");

  const { data, error } = await supabase.rpc("vendor_transition_order", {
    p_order_id: orderId,
    p_expected: expected,
    p_next: next,
    p_note: note?.trim() || null,
  });
  if (error) throw new Error("The order status changed or you are not authorised.");
  return data;
}

export async function setVendorBranchOperations({
  branchId,
  acceptingOrders,
  busyMode,
  defaultPrepMinutes,
  activeOrderLimit,
}: {
  branchId: string;
  acceptingOrders: boolean;
  busyMode: boolean;
  defaultPrepMinutes: number;
  activeOrderLimit: number;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");

  const { data, error } = await supabase.rpc("vendor_set_branch_operations", {
    p_branch_id: branchId,
    p_accepting_orders: acceptingOrders,
    p_busy_mode: busyMode,
    p_default_prep_minutes: defaultPrepMinutes,
    p_active_order_limit: activeOrderLimit,
  });
  if (error) throw new Error("Branch settings could not be saved or you are not authorised.");
  return data;
}

export async function setVendorMenuAvailability(menuItemId: string, available: boolean) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");

  const { data, error } = await supabase.rpc("vendor_set_menu_availability", {
    p_menu_item_id: menuItemId,
    p_available: available,
  });
  if (error) throw new Error("Menu availability could not be changed or you are not authorised.");
  return data;
}

export async function listVendorBranchOrders(branchId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");

  const { data, error } = await supabase.rpc("vendor_list_active_orders", {
    p_branch_id: branchId,
  });
  if (error) throw new Error("Live branch orders could not be loaded.");
  return data ?? [];
}

export type VendorWorkspaceContext = {
  organisation_id: string;
  organisation_name: string;
  branch_id: string;
  branch_name: string;
  branch_city: string;
  branch_address: string;
  role: "owner" | "manager" | "kitchen";
  accepting_orders: boolean;
  busy_mode: boolean;
  default_prep_minutes: number;
  active_order_limit: number;
};

export async function getVendorWorkspaceContext(): Promise<
  | { status: "signed_out" }
  | { status: "unauthorised" }
  | { status: "ready"; context: VendorWorkspaceContext }
> {
  const supabase = getSupabaseClient();
  if (!supabase) return { status: "unauthorised" };

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { status: "signed_out" };

  const { data, error } = await supabase.rpc("vendor_workspace_context");
  if (error) throw new Error("Restaurant access could not be verified.");
  const context = Array.isArray(data) ? data[0] : data;
  if (!context) return { status: "unauthorised" };
  return { status: "ready", context: context as VendorWorkspaceContext };
}

export async function listVendorMenuItems(branchId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, price_paisa, available, category_id")
    .eq("branch_id", branchId)
    .order("name")
    .limit(500);
  if (error) throw new Error("The branch menu could not be loaded.");
  return data ?? [];
}

export async function signOutVendorWorkspace() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Sign out could not be completed.");
}

export function subscribeToVendorBranchOrders(branchId: string, onChange: () => void) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`vendor-orders-${branchId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `branch_id=eq.${branchId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
