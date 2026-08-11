import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
    options: { shouldCreateUser: true },
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

export async function createCodOrder(input: CodOrderInput) {
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
  return data;
}

export async function transitionVendorOrder({
  orderId,
  expected,
  next,
  note,
}: {
  orderId: string;
  expected: "placed" | "accepted" | "preparing";
  next: "accepted" | "rejected" | "preparing" | "ready";
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

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_lines(*)")
    .eq("branch_id", branchId)
    .in("status", ["placed", "accepted", "preparing", "ready"])
    .order("placed_at", { ascending: true })
    .limit(100);
  if (error) throw new Error("Live branch orders could not be loaded.");
  return data ?? [];
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
