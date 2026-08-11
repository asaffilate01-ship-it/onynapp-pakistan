import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  mapCustomerOrders,
  mapMarketplaceCatalog,
  type CustomerOrder,
  type MarketplaceBranchRow,
  type MarketplaceCategoryRow,
  type MarketplaceMenuRow,
  type MarketplaceOptionGroupRow,
  type MarketplaceOptionRow,
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
  items: Array<{ menuItemId: string; quantity: number; optionIds?: string[] }>;
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
      option_ids: item.optionIds ?? [],
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

  const { data, error } = await supabase.rpc("marketplace_catalog", { p_city: city });
  if (error) throw new Error("The live restaurant and menu catalog could not be loaded.");
  const catalog = (data ?? {}) as Record<string, unknown>;

  return mapMarketplaceCatalog(
    (Array.isArray(catalog.branches) ? catalog.branches : []) as MarketplaceBranchRow[],
    (Array.isArray(catalog.categories) ? catalog.categories : []) as MarketplaceCategoryRow[],
    (Array.isArray(catalog.items) ? catalog.items : []) as MarketplaceMenuRow[],
    (Array.isArray(catalog.option_groups)
      ? catalog.option_groups
      : []) as MarketplaceOptionGroupRow[],
    (Array.isArray(catalog.options) ? catalog.options : []) as MarketplaceOptionRow[],
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

export type CustomerNotification = {
  id: string;
  order_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export async function listCustomerNotifications(): Promise<CustomerNotification[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase
    .from("customer_notifications")
    .select("id, order_id, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Order notifications could not be loaded.");
  return (data ?? []) as CustomerNotification[];
}

export async function markCustomerNotificationRead(notificationId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { error } = await supabase.rpc("customer_mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw new Error("The notification could not be marked as read.");
}

export function subscribeToCustomerNotifications(customerId: string, onChange: () => void) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel(`customer-notifications-${customerId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "customer_notifications",
        filter: `user_id=eq.${customerId}`,
      },
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

export async function setVendorMenuOptionAvailability(optionId: string, available: boolean) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("vendor_set_menu_option_availability", {
    p_option_id: optionId,
    p_available: available,
  });
  if (error) throw new Error("Option availability could not be changed or you are not authorised.");
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

export type VendorDayHours = {
  weekday: number;
  opens_at: string;
  closes_at: string;
  closed: boolean;
};

export type VendorBranchSchedule = {
  is_open: boolean;
  hours: VendorDayHours[];
  active_closure: {
    id: string;
    starts_at: string;
    ends_at: string;
    reason: string;
  } | null;
};

export async function getVendorBranchSchedule(branchId: string): Promise<VendorBranchSchedule> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("vendor_branch_schedule", {
    p_branch_id: branchId,
  });
  if (error) throw new Error("Branch hours could not be loaded.");
  return data as VendorBranchSchedule;
}

export async function setVendorWeeklyHours(branchId: string, hours: VendorDayHours[]) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("vendor_set_weekly_hours", {
    p_branch_id: branchId,
    p_hours: hours,
  });
  if (error) throw new Error("Weekly opening hours could not be saved.");
  return data as VendorBranchSchedule;
}

export async function setVendorTemporaryClosure(input: {
  branchId: string;
  endsAt: string | null;
  reason?: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("vendor_set_temporary_closure", {
    p_branch_id: input.branchId,
    p_ends_at: input.endsAt,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw new Error("The temporary closure could not be saved.");
  return data as VendorBranchSchedule;
}

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
    .select(
      "id, name, price_paisa, available, category_id, menu_option_groups(id, name, required, min_selections, max_selections, menu_options(id, name, price_delta_paisa, available))",
    )
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

export type CustomerProfileSnapshot = {
  profile: { display_name: string | null; phone_e164: string | null } | null;
  addresses: Array<{
    id: string;
    label: string | null;
    city: string;
    address_line: string;
    landmark: string;
    delivery_note: string | null;
  }>;
};

export async function getCustomerProfileSnapshot(): Promise<CustomerProfileSnapshot> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("customer_profile_snapshot");
  if (error) throw new Error("Your account details could not be loaded.");
  return data as CustomerProfileSnapshot;
}

export async function updateCustomerProfile(displayName: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { error } = await supabase.rpc("customer_update_profile", {
    p_display_name: displayName.trim(),
  });
  if (error) throw new Error("Your account name could not be saved.");
}

export type SupportCase = {
  id: string;
  order_id: string | null;
  category: string;
  subject: string;
  description: string;
  status: "new" | "in_review" | "resolved" | "closed";
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

export async function listCustomerSupportCases(): Promise<SupportCase[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("customer_list_support_cases");
  if (error) throw new Error("Your support requests could not be loaded.");
  return (data ?? []) as SupportCase[];
}

export async function createCustomerSupportCase(input: {
  orderId?: string | null;
  category: string;
  subject: string;
  description: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("customer_create_support_case", {
    p_order_id: input.orderId ?? null,
    p_category: input.category,
    p_subject: input.subject.trim(),
    p_description: input.description.trim(),
  });
  if (error) throw new Error("Your support request could not be submitted.");
  return data as SupportCase;
}

export type PartnerApplication = {
  id: string;
  application_type: "restaurant" | "home_chef" | "sales_agent" | "supplier";
  trading_name: string;
  city: string;
  area: string;
  contact_name: string;
  phone_e164: string;
  email: string | null;
  details: string | null;
  status: "submitted" | "in_review" | "approved" | "rejected" | "withdrawn";
  review_note: string | null;
  created_at: string;
};

export async function submitPartnerApplication(input: {
  applicationType: string;
  tradingName: string;
  city: string;
  area: string;
  contactName: string;
  phoneE164: string;
  email?: string;
  details?: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("submit_partner_application", {
    p_application_type: input.applicationType,
    p_trading_name: input.tradingName.trim(),
    p_city: input.city,
    p_area: input.area.trim(),
    p_contact_name: input.contactName.trim(),
    p_phone_e164: input.phoneE164,
    p_email: input.email?.trim() || null,
    p_details: input.details?.trim() || null,
  });
  if (error)
    throw new Error(
      error.message.includes("already exists")
        ? error.message
        : "The application could not be submitted.",
    );
  return data as PartnerApplication;
}

export async function listOwnPartnerApplications(): Promise<PartnerApplication[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("list_own_partner_applications");
  if (error) throw new Error("Your applications could not be loaded.");
  return (data ?? []) as PartnerApplication[];
}

export type RiderJob = {
  id: string;
  order_id: string;
  reference: string;
  status: string;
  cash_to_collect_paisa: number;
  restaurant: string;
  pickup_address: string;
  delivery_address: string | null;
  landmark: string | null;
  delivery_note: string | null;
  created_at: string;
};

export type RiderWorkspaceSnapshot = {
  application: null | {
    id: string;
    full_name: string;
    phone_e164: string;
    area: string;
    vehicle_type: string;
    has_valid_licence: boolean;
    status: string;
    review_note: string | null;
  };
  jobs: RiderJob[];
};

export async function submitRiderApplication(input: {
  fullName: string;
  phoneE164: string;
  area: string;
  vehicleType: string;
  hasValidLicence: boolean;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("submit_rider_application", {
    p_full_name: input.fullName.trim(),
    p_phone_e164: input.phoneE164,
    p_area: input.area.trim(),
    p_vehicle_type: input.vehicleType,
    p_has_valid_licence: input.hasValidLicence,
  });
  if (error) throw new Error("The rider application could not be submitted.");
  return data;
}

export async function getRiderWorkspaceSnapshot(): Promise<RiderWorkspaceSnapshot> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("rider_workspace_snapshot");
  if (error) throw new Error("The rider workspace could not be loaded.");
  return data as RiderWorkspaceSnapshot;
}

export async function transitionRiderJob(input: {
  jobId: string;
  expected: string;
  next: string;
  proofNote?: string;
  cashCollectedPaisa?: number | null;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { error } = await supabase.rpc("rider_transition_delivery_job", {
    p_job_id: input.jobId,
    p_expected: input.expected,
    p_next: input.next,
    p_proof_note: input.proofNote?.trim() || null,
    p_cash_collected_paisa: input.cashCollectedPaisa ?? null,
  });
  if (error) throw new Error("The delivery status could not be changed safely.");
}

export type OpsLaunchSnapshot = {
  staff_role: "support" | "operations" | "admin";
  partner_applications: Array<Record<string, unknown>>;
  rider_applications: Array<Record<string, unknown>>;
  support_cases: Array<Record<string, unknown>>;
  delivery_jobs: Array<Record<string, unknown>>;
  ready_delivery_orders: Array<Record<string, unknown>>;
};

export async function getOpsLaunchSnapshot(): Promise<OpsLaunchSnapshot> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("ops_launch_snapshot");
  if (error) throw new Error("Operations access could not be verified.");
  return data as OpsLaunchSnapshot;
}

export async function reviewOpsApplication(input: {
  kind: "partner" | "rider";
  applicationId: string;
  status: string;
  note?: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { error } = await supabase.rpc("ops_review_application", {
    p_kind: input.kind,
    p_application_id: input.applicationId,
    p_status: input.status,
    p_note: input.note?.trim() || null,
  });
  if (error) throw new Error("The application review could not be saved.");
}

export async function updateOpsSupportCase(input: {
  caseId: string;
  status: string;
  resolutionNote?: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { error } = await supabase.rpc("ops_update_support_case", {
    p_case_id: input.caseId,
    p_status: input.status,
    p_resolution_note: input.resolutionNote?.trim() || null,
  });
  if (error) throw new Error("The support case could not be updated.");
}

export async function assignOpsDelivery(orderId: string, riderId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { error } = await supabase.rpc("ops_assign_delivery", {
    p_order_id: orderId,
    p_rider_id: riderId,
  });
  if (error) throw new Error("The delivery could not be assigned.");
}

export async function importVendorMenu(branchId: string, items: Array<Record<string, unknown>>) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Pilot backend is not configured.");
  const { data, error } = await supabase.rpc("vendor_import_menu", {
    p_branch_id: branchId,
    p_items: items,
  });
  if (error) throw new Error("The menu import could not be completed safely.");
  return Number(data ?? 0);
}
