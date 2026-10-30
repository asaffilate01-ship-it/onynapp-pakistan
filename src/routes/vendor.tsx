import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BellRing,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogOut,
  Menu,
  MonitorSmartphone,
  PackageCheck,
  PauseCircle,
  Search,
  Settings,
  ShoppingBag,
  ShieldCheck,
  Store,
  TimerReset,
  Upload,
  Wifi,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getVendorWorkspaceContext,
  getVendorBranchSchedule,
  importVendorMenu,
  isPilotBackendConfigured,
  listVendorBranchOrders,
  listVendorMenuItems,
  requestPakistanOtp,
  setVendorBranchOperations,
  setVendorTemporaryClosure,
  setVendorWeeklyHours,
  setVendorMenuAvailability,
  setVendorMenuOptionAvailability,
  signOutVendorWorkspace,
  subscribeToVendorBranchOrders,
  transitionVendorOrder,
  verifyPakistanOtp,
  type VendorWorkspaceContext,
  type VendorBranchSchedule,
  type VendorDayHours,
} from "../lib/supabase";
import {
  applyVendorTransition,
  formatPkr,
  getOrderUrgency,
  orderAgeMinutes,
  vendorMetrics,
  type VendorOrder,
  type VendorOrderStatus,
} from "../lib/vendor-operations";
import {
  mapVendorBackendMenuItem,
  mapVendorBackendOrder,
  type VendorMenuItem,
} from "../lib/vendor-workspace";
import { parseMenuCsv } from "../lib/launch";
import {
  dishbeeOneSurfaceUrl,
  getDishbeeOneConnection,
  type DishbeeOneConnection,
} from "../lib/dishbee-one";

export const Route = createFileRoute("/vendor")({
  head: () => ({
    meta: [
      { title: "Dishbee+ One — Restaurant workspace" },
      {
        name: "description",
        content: "Dishbee+ Pakistan restaurant orders, kitchen display and menu operations.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VendorWorkspace,
});

type WorkspaceView = "orders" | "kds" | "menu" | "counter" | "reports" | "settings";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const defaultWeeklyHours: VendorDayHours[] = dayNames.map((_, weekday) => ({
  weekday,
  opens_at: "09:00",
  closes_at: "23:00",
  closed: false,
}));

const demoNow = Date.parse("2026-08-11T10:45:00.000Z");

const demoOrders: VendorOrder[] = [
  {
    id: "demo-1047",
    reference: "ONY-1047",
    customer: "Ayesha Khan",
    status: "placed",
    fulfilment: "delivery",
    payment: "cod",
    totalPaisa: 237_000,
    placedAt: "2026-08-11T10:39:00.000Z",
    promisedMinutes: 25,
    address: "Gulberg III · Gate 2, near Main Market",
    note: "Less spicy. Please call at the gate.",
    lines: [
      { id: "l-1", name: "Chicken Karahi (half)", quantity: 1, station: "Kitchen" },
      { id: "l-2", name: "Garlic naan", quantity: 2, station: "Grill" },
      { id: "l-3", name: "Mint lemonade", quantity: 2, station: "Drinks", note: "No ice" },
    ],
  },
  {
    id: "demo-1046",
    reference: "ONY-1046",
    customer: "Hamza Ali",
    status: "accepted",
    fulfilment: "collection",
    payment: "paid",
    totalPaisa: 129_900,
    placedAt: "2026-08-11T10:34:00.000Z",
    promisedMinutes: 20,
    lines: [
      { id: "l-4", name: "Double Smash Burger", quantity: 1, station: "Grill" },
      { id: "l-5", name: "Masala fries", quantity: 1, station: "Kitchen" },
    ],
  },
  {
    id: "demo-1045",
    reference: "ONY-1045",
    customer: "Sana Tariq",
    status: "preparing",
    fulfilment: "delivery",
    payment: "cod",
    totalPaisa: 184_000,
    placedAt: "2026-08-11T10:18:00.000Z",
    promisedMinutes: 25,
    address: "Model Town · C Block, opposite the mosque",
    note: "Include disposable cutlery.",
    lines: [
      { id: "l-6", name: "Malai boti", quantity: 2, station: "Grill" },
      { id: "l-7", name: "Paratha", quantity: 3, station: "Kitchen" },
    ],
  },
  {
    id: "demo-1044",
    reference: "ONY-1044",
    customer: "Bilal Ahmed",
    status: "ready",
    fulfilment: "collection",
    payment: "cod",
    totalPaisa: 799_00,
    placedAt: "2026-08-11T10:20:00.000Z",
    promisedMinutes: 20,
    lines: [{ id: "l-8", name: "Aloo Keema Thali", quantity: 1, station: "Kitchen" }],
  },
];

const demoMenu: VendorMenuItem[] = [
  {
    id: "m-1",
    name: "Chicken Karahi",
    category: "Desi mains",
    price: 899,
    available: true,
    optionGroups: [],
  },
  { id: "m-2", name: "Malai Boti", category: "BBQ", price: 649, available: true, optionGroups: [] },
  {
    id: "m-3",
    name: "Double Smash Burger",
    category: "Burgers",
    price: 749,
    available: true,
    optionGroups: [],
  },
  {
    id: "m-4",
    name: "Mint Lemonade",
    category: "Drinks",
    price: 249,
    available: false,
    optionGroups: [],
  },
  {
    id: "m-5",
    name: "Aloo Keema Thali",
    category: "Home-style",
    price: 499,
    available: true,
    optionGroups: [],
  },
];

const navItems: Array<{ id: WorkspaceView; label: string; icon: typeof LayoutDashboard }> = [
  { id: "orders", label: "Orders", icon: ListChecks },
  { id: "kds", label: "Kitchen", icon: ChefHat },
  { id: "menu", label: "Menu", icon: Menu },
  { id: "counter", label: "Counter", icon: MonitorSmartphone },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "More", icon: Settings },
];

const statusLabels: Record<VendorOrderStatus, string> = {
  placed: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  rejected: "Rejected",
};

function VendorWorkspace() {
  const backendConnected = isPilotBackendConfigured();
  const [view, setView] = useState<WorkspaceView>("orders");
  const [orders, setOrders] = useState(demoOrders);
  const [menuItems, setMenuItems] = useState(demoMenu);
  const [now, setNow] = useState(backendConnected ? Date.now() : demoNow);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [busyMode, setBusyMode] = useState(false);
  const [prepMinutes, setPrepMinutes] = useState(25);
  const [weeklyHours, setWeeklyHours] = useState<VendorDayHours[]>(defaultWeeklyHours);
  const [branchSchedule, setBranchSchedule] = useState<VendorBranchSchedule | null>(null);
  const [closureEndsAt, setClosureEndsAt] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [menuCsv, setMenuCsv] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [bumpedLines, setBumpedLines] = useState<string[]>([]);
  const [accessState, setAccessState] = useState<
    "demo" | "loading" | "signed_out" | "unauthorised" | "ready" | "error"
  >(backendConnected ? "loading" : "demo");
  const [workspaceContext, setWorkspaceContext] = useState<VendorWorkspaceContext | null>(null);
  const dishbeeOne = getDishbeeOneConnection();
  const canManageBranch = !workspaceContext || workspaceContext.role !== "kitchen";
  const visibleNavItems = canManageBranch
    ? navItems
    : navItems.filter((item) => !["counter", "settings"].includes(item.id));

  const loadLiveData = useCallback(async (context: VendorWorkspaceContext) => {
    const [orderRows, menuRows, schedule] = await Promise.all([
      listVendorBranchOrders(context.branch_id),
      listVendorMenuItems(context.branch_id),
      context.role === "kitchen"
        ? Promise.resolve(null)
        : getVendorBranchSchedule(context.branch_id),
    ]);
    setOrders(
      orderRows.map((row: unknown) => mapVendorBackendOrder(row, context.default_prep_minutes)),
    );
    setMenuItems(menuRows.map((row: unknown) => mapVendorBackendMenuItem(row)));
    if (schedule) {
      setBranchSchedule(schedule);
      setWeeklyHours(schedule.hours.length === 7 ? schedule.hours : defaultWeeklyHours);
    }
  }, []);

  const refreshAccess = useCallback(async () => {
    if (!backendConnected) {
      setAccessState("demo");
      return;
    }
    setAccessState("loading");
    try {
      const access = await getVendorWorkspaceContext();
      if (access.status !== "ready") {
        setWorkspaceContext(null);
        setAccessState(access.status);
        return;
      }
      setWorkspaceContext(access.context);
      setAcceptingOrders(access.context.accepting_orders);
      setBusyMode(access.context.busy_mode);
      setPrepMinutes(access.context.default_prep_minutes);
      await loadLiveData(access.context);
      setNow(Date.now());
      setAccessState("ready");
    } catch (error) {
      setAccessState("error");
      setFeedback(error instanceof Error ? error.message : "Restaurant workspace could not load.");
    }
  }, [backendConnected, loadLiveData]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  useEffect(() => {
    if (!workspaceContext || accessState !== "ready") return;
    return subscribeToVendorBranchOrders(workspaceContext.branch_id, () => {
      void loadLiveData(workspaceContext);
    });
  }, [accessState, loadLiveData, workspaceContext]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow((value) => value + 60_000), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = useMemo(() => vendorMetrics(orders, now), [orders, now]);
  const businessDate = new Intl.DateTimeFormat("en-PK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Karachi",
  }).format(now);

  async function moveOrder(id: string, next: VendorOrderStatus, note?: string) {
    const current = orders.find((order) => order.id === id);
    if (!current) return;
    setBusyOrderId(id);
    setFeedback("");

    try {
      if (!id.startsWith("demo-")) {
        const persistedNext =
          next === "completed"
            ? current.fulfilment === "collection"
              ? "collected"
              : "picked_up"
            : next;
        await transitionVendorOrder({
          orderId: id,
          expected: current.status as "placed" | "accepted" | "preparing" | "ready",
          next: persistedNext as
            "accepted" | "rejected" | "preparing" | "ready" | "picked_up" | "collected",
          note,
        });
      }
      setOrders((items) =>
        items.map((order) => (order.id === id ? applyVendorTransition(order, next, note) : order)),
      );
      setFeedback(`${current.reference} moved to ${statusLabels[next].toLowerCase()}.`);
      setRejectingId(null);
      setRejectReason("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "The order could not be updated.");
    } finally {
      setBusyOrderId(null);
    }
  }

  function toggleLine(id: string) {
    setBumpedLines((items) =>
      items.includes(id) ? items.filter((lineId) => lineId !== id) : [...items, id],
    );
  }

  async function persistOperations({
    nextAccepting = acceptingOrders,
    nextBusy = busyMode,
    nextPrep = prepMinutes,
  }: {
    nextAccepting?: boolean;
    nextBusy?: boolean;
    nextPrep?: number;
  }) {
    if (workspaceContext) {
      await setVendorBranchOperations({
        branchId: workspaceContext.branch_id,
        acceptingOrders: nextAccepting,
        busyMode: nextBusy,
        defaultPrepMinutes: nextPrep,
        activeOrderLimit: workspaceContext.active_order_limit,
      });
    }
    setAcceptingOrders(nextAccepting);
    setBusyMode(nextBusy);
    setPrepMinutes(nextPrep);
  }

  async function toggleBusyMode() {
    const nextBusy = !busyMode;
    const nextPrep = nextBusy && prepMinutes < 35 ? 35 : prepMinutes;
    try {
      await persistOperations({ nextBusy, nextPrep });
      setFeedback(nextBusy ? "Busy mode on: customer ETA increased." : "Busy mode off.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Busy mode could not be changed.");
    }
  }

  async function toggleAcceptingOrders() {
    if (!acceptingOrders && workspaceContext && (branchSchedule?.hours.length ?? 0) !== 7) {
      setFeedback("Save all seven days of Pakistan operating hours before opening orders.");
      return;
    }
    try {
      await persistOperations({ nextAccepting: !acceptingOrders });
      setFeedback(acceptingOrders ? "New orders paused." : "The branch is accepting orders.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Ordering status could not be changed.");
    }
  }

  async function saveOperations() {
    try {
      await persistOperations({});
      setFeedback("Branch operating settings saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Branch settings could not be saved.");
    }
  }

  async function saveWeeklySchedule() {
    if (!workspaceContext) {
      setWeeklyHours((hours) => [...hours]);
      setFeedback("Demo schedule saved locally.");
      return;
    }
    try {
      const schedule = await setVendorWeeklyHours(workspaceContext.branch_id, weeklyHours);
      setBranchSchedule(schedule);
      setFeedback("All seven days of branch hours were saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Opening hours could not be saved.");
    }
  }

  async function updateTemporaryClosure(clear = false) {
    if (!clear && (!closureEndsAt || closureReason.trim().length < 3)) {
      setFeedback("Choose a reopening time and enter a closure reason.");
      return;
    }
    if (!workspaceContext) {
      setFeedback(clear ? "Demo closure cleared." : "Demo temporary closure scheduled.");
      return;
    }
    try {
      const schedule = await setVendorTemporaryClosure({
        branchId: workspaceContext.branch_id,
        endsAt: clear ? null : new Date(closureEndsAt).toISOString(),
        reason: clear ? undefined : closureReason,
      });
      setBranchSchedule(schedule);
      if (clear) {
        setClosureEndsAt("");
        setClosureReason("");
      }
      setFeedback(clear ? "Temporary closure cleared." : "Temporary closure is now active.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Temporary closure could not be saved.");
    }
  }

  async function toggleMenuItem(id: string) {
    const item = menuItems.find((entry) => entry.id === id);
    if (!item) return;
    try {
      if (accessState === "ready") await setVendorMenuAvailability(id, !item.available);
      setMenuItems((menu) =>
        menu.map((entry) => (entry.id === id ? { ...entry, available: !entry.available } : entry)),
      );
      setFeedback(`${item.name} marked ${item.available ? "sold out" : "available"}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Menu availability could not change.");
    }
  }

  async function toggleMenuOption(itemId: string, optionId: string) {
    const item = menuItems.find((entry) => entry.id === itemId);
    const option = item?.optionGroups
      .flatMap((group) => group.options)
      .find((entry) => entry.id === optionId);
    if (!item || !option) return;
    try {
      if (accessState === "ready") {
        await setVendorMenuOptionAvailability(optionId, !option.available);
      }
      setMenuItems((current) =>
        current.map((menuItem) =>
          menuItem.id !== itemId
            ? menuItem
            : {
                ...menuItem,
                optionGroups: menuItem.optionGroups.map((group) => ({
                  ...group,
                  options: group.options.map((entry) =>
                    entry.id === optionId ? { ...entry, available: !entry.available } : entry,
                  ),
                })),
              },
        ),
      );
      setFeedback(`${option.name} marked ${option.available ? "unavailable" : "available"}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Option availability could not change.");
    }
  }

  async function importMenu() {
    const parsed = parseMenuCsv(menuCsv);
    if (parsed.error) {
      setFeedback(parsed.error);
      return;
    }
    if (!workspaceContext || !canManageBranch) {
      setFeedback("A live owner or manager session is required for menu import.");
      return;
    }
    try {
      const count = await importVendorMenu(workspaceContext.branch_id, parsed.rows);
      setMenuCsv("");
      setFeedback(`${count} menu item${count === 1 ? "" : "s"} imported with an audit record.`);
      await loadLiveData(workspaceContext);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Menu import could not be completed.");
    }
  }

  async function handleSignOut() {
    try {
      await signOutVendorWorkspace();
      setWorkspaceContext(null);
      setOrders([]);
      setMenuItems([]);
      setAccessState("signed_out");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Sign out could not be completed.");
    }
  }

  if (accessState === "loading") return <VendorAccessLoading />;
  if (accessState === "signed_out") return <VendorSignIn onVerified={refreshAccess} />;
  if (accessState === "unauthorised") return <VendorAccessDenied onRetry={refreshAccess} />;
  if (accessState === "error") return <VendorAccessDenied onRetry={refreshAccess} error />;

  return (
    <div className="vendor-app">
      <a className="skip-link" href="#vendor-main">
        Skip to restaurant workspace
      </a>

      <aside className="vendor-sidebar" aria-label="Restaurant workspace navigation">
        <a className="vendor-brand" href="/" aria-label="Back to Dishbee Plus Pakistan">
          <img className="brand-mark" src="/dishbee-plus-mark.svg" alt="" />
          <span>
            Dishbee+ <small>ONE</small>
          </span>
        </a>

        <div className="branch-card">
          <span className="branch-avatar">{workspaceContext ? "PK" : "LH"}</span>
          <span>
            <strong>{workspaceContext?.branch_name ?? "Lahori Karahi House"}</strong>
            <small>
              {workspaceContext
                ? `${workspaceContext.branch_address} · ${workspaceContext.branch_city}`
                : "Gulberg III · Lahore"}
            </small>
          </span>
          <ChevronDown size={17} />
        </div>

        <nav>
          <small className="nav-label">OPERATIONS</small>
          {visibleNavItems.map(({ id, label, icon: Icon }) => (
            <button
              className={view === id ? "active" : ""}
              type="button"
              key={id}
              onClick={() => setView(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
              {id === "orders" && metrics.newOrders > 0 && <b>{metrics.newOrders}</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className={accessState === "ready" ? "connected" : "demo"}>
            {accessState === "ready" ? <Wifi size={15} /> : <WifiOff size={15} />}
            {accessState === "ready" ? "Live pilot data connected" : "Safe demo mode"}
          </span>
          <p>No privileged credentials are stored in this browser.</p>
        </div>
        <a className="back-marketplace" href="/order">
          <ArrowLeft size={17} /> Customer marketplace
        </a>
        {workspaceContext && (
          <button type="button" className="vendor-sign-out" onClick={handleSignOut}>
            <LogOut size={16} /> Sign out
          </button>
        )}
      </aside>

      <main id="vendor-main" className="vendor-main">
        <header className="vendor-topbar">
          <div>
            <span className="mobile-wordmark">Dishbee+ One</span>
            <p>{businessDate}</p>
            <h1>{visibleNavItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="ops-controls">
            <button
              type="button"
              className={`accepting-toggle ${acceptingOrders ? "on" : "off"}`}
              onClick={toggleAcceptingOrders}
              aria-pressed={acceptingOrders}
              disabled={!canManageBranch}
              title={
                !canManageBranch ? "Only an owner or manager can change this setting" : undefined
              }
            >
              <span /> {acceptingOrders ? "Accepting orders" : "Orders paused"}
            </button>
            <button
              type="button"
              className={`busy-toggle ${busyMode ? "active" : ""}`}
              onClick={toggleBusyMode}
              aria-pressed={busyMode}
              disabled={!canManageBranch}
              title={
                !canManageBranch ? "Only an owner or manager can change this setting" : undefined
              }
            >
              <PauseCircle size={17} /> Busy mode
            </button>
            <button
              type="button"
              className="notification-button"
              aria-label="Show new orders"
              onClick={() => {
                setView("orders");
                setFeedback(
                  metrics.newOrders > 0
                    ? `${metrics.newOrders} new order${metrics.newOrders === 1 ? "" : "s"} waiting.`
                    : "There are no new orders.",
                );
              }}
            >
              <BellRing size={20} />
              {metrics.newOrders > 0 && <b>{metrics.newOrders}</b>}
            </button>
          </div>
        </header>

        {!backendConnected && (
          <div className="demo-banner" role="status">
            <AlertTriangle size={18} />
            <span>
              <strong>Operational prototype:</strong> actions work with demo orders. Configure the
              separate Supabase pilot to use authenticated, server-authorised live orders.
            </span>
          </div>
        )}

        {feedback && (
          <div className="workspace-feedback" role="status" aria-live="polite">
            <CheckCircle2 size={17} /> {feedback}
            <button type="button" onClick={() => setFeedback("")} aria-label="Dismiss message">
              <X size={16} />
            </button>
          </div>
        )}

        {view === "orders" && (
          <OrdersBoard
            orders={orders}
            now={now}
            busyOrderId={busyOrderId}
            moveOrder={moveOrder}
            rejectOrder={setRejectingId}
            metrics={metrics}
            canAcceptOrders={canManageBranch}
          />
        )}
        {view === "kds" && (
          <KitchenDisplay
            orders={orders}
            now={now}
            bumpedLines={bumpedLines}
            toggleLine={toggleLine}
            busyOrderId={busyOrderId}
            moveOrder={moveOrder}
            canAcceptOrders={canManageBranch}
          />
        )}
        {view === "menu" && (
          <MenuAvailability
            items={menuItems}
            onToggle={toggleMenuItem}
            onToggleOption={toggleMenuOption}
            menuCsv={menuCsv}
            setMenuCsv={setMenuCsv}
            onImport={importMenu}
            canImport={Boolean(workspaceContext && canManageBranch)}
          />
        )}
        {view === "reports" && <VendorReports orders={orders} metrics={metrics} />}
        {view === "counter" && <DishbeeOnePanel connection={dishbeeOne} />}
        {view === "settings" && (
          <OperationsSettings
            acceptingOrders={acceptingOrders}
            setAcceptingOrders={setAcceptingOrders}
            prepMinutes={prepMinutes}
            setPrepMinutes={setPrepMinutes}
            onSave={saveOperations}
            weeklyHours={weeklyHours}
            setWeeklyHours={setWeeklyHours}
            branchSchedule={branchSchedule}
            closureEndsAt={closureEndsAt}
            setClosureEndsAt={setClosureEndsAt}
            closureReason={closureReason}
            setClosureReason={setClosureReason}
            onSaveHours={saveWeeklySchedule}
            onSetClosure={updateTemporaryClosure}
          />
        )}
      </main>

      <nav className="vendor-mobile-nav" aria-label="Restaurant workspace mobile navigation">
        {visibleNavItems.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
            {id === "orders" && metrics.newOrders > 0 && <b>{metrics.newOrders}</b>}
          </button>
        ))}
      </nav>

      {rejectingId && (
        <div className="vendor-dialog-backdrop" role="presentation">
          <section
            className="vendor-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
          >
            <button
              type="button"
              className="dialog-close"
              onClick={() => setRejectingId(null)}
              aria-label="Close"
            >
              <X size={19} />
            </button>
            <span className="dialog-danger-icon">
              <XCircle />
            </span>
            <h2 id="reject-title">Reject this order?</h2>
            <p>
              The customer will be notified. A reason is required for support and audit history.
            </p>
            <label>
              Rejection reason
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="For example: Chicken karahi is sold out"
                maxLength={300}
                autoFocus
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setRejectingId(null)}>
                Keep order
              </button>
              <button
                type="button"
                className="danger"
                disabled={rejectReason.trim().length < 3 || busyOrderId === rejectingId}
                onClick={() => moveOrder(rejectingId, "rejected", rejectReason)}
              >
                Reject order
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DishbeeOnePanel({ connection }: { connection: DishbeeOneConnection }) {
  const eposUrl = dishbeeOneSurfaceUrl(connection, "epos");
  const kdsUrl = dishbeeOneSurfaceUrl(connection, "kds");
  return (
    <section className="dishbee-one-panel">
      <header>
        <span>
          <MonitorSmartphone />
        </span>
        <div>
          <small>DISHBEE ONE · AUTHORITATIVE RESTAURANT OPERATIONS</small>
          <h2>Counter, KDS and payment controls</h2>
          <p>
            Dishbee+ supplies marketplace demand. Dishbee One remains the source of truth for EPOS,
            paid-order release, kitchen lifecycle, till reconciliation and provider-verified
            refunds.
          </p>
        </div>
      </header>
      <div className="dishbee-one-capabilities">
        <article>
          <strong>Counter / EPOS</strong>
          <p>Cash, paired-reader and account orders with an auditable till shift.</p>
          {eposUrl ? (
            <a href={eposUrl} target="_blank" rel="noreferrer">
              Open Dishbee Counter <ExternalLink />
            </a>
          ) : (
            <span>Connection required</span>
          )}
        </article>
        <article>
          <strong>Production KDS</strong>
          <p>One customer order card with brand and station readiness behind it.</p>
          {kdsUrl ? (
            <a href={kdsUrl} target="_blank" rel="noreferrer">
              Open Dishbee KDS <ExternalLink />
            </a>
          ) : (
            <span>Connection required</span>
          )}
        </article>
        <article>
          <strong>Safe boundary</strong>
          <p>No access token, payment credential or customer record is placed in the link.</p>
          <span>Server handoff remains launch-gated</span>
        </article>
      </div>
      <div className={`dishbee-one-connection ${connection.configured ? "ready" : "blocked"}`}>
        {connection.configured ? <CheckCircle2 /> : <AlertTriangle />}
        <span>
          <strong>
            {connection.configured
              ? "Dishbee One URL configured"
              : "Dishbee One connection not configured"}
          </strong>
          <small>
            {connection.configured
              ? "Authentication and tenant membership are enforced again inside Dishbee One."
              : connection.reason}
          </small>
        </span>
      </div>
    </section>
  );
}

function VendorAccessLoading() {
  return (
    <main className="vendor-access-shell">
      <section className="vendor-access-card" aria-live="polite">
        <img className="vendor-access-logo" src="/dishbee-plus-mark.svg" alt="" />
        <LoaderCircle className="access-spinner" />
        <h1>Checking restaurant access</h1>
        <p>Verifying your signed-in account and branch permissions.</p>
      </section>
    </main>
  );
}

function VendorSignIn({ onVerified }: { onVerified: () => Promise<void> }) {
  const [phone, setPhone] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function continueSignIn() {
    setBusy(true);
    setMessage("");
    try {
      if (!pendingPhone) {
        const result = await requestPakistanOtp(phone, { shouldCreateUser: false });
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        setPendingPhone(result.phone);
        setMessage(`A six-digit code was sent to ${result.phone}.`);
        return;
      }
      const result = await verifyPakistanOtp(pendingPhone, code);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      await onVerified();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="vendor-access-shell">
      <section className="vendor-access-card">
        <a className="vendor-access-brand" href="/">
          <img className="vendor-access-logo" src="/dishbee-plus-mark.svg" alt="" />
          <span>Dishbee+ One</span>
        </a>
        <span className="access-kicker">SECURE PARTNER ACCESS</span>
        <h1>Sign in to your restaurant</h1>
        <p>Use the Pakistan mobile number connected to your approved restaurant membership.</p>
        <label>
          <span>Pakistan mobile number</span>
          <div className="vendor-phone-field">
            <b>+92</b>
            <input
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setPendingPhone("");
                setCode("");
              }}
              inputMode="tel"
              autoComplete="tel"
              placeholder="3XX XXXXXXX"
              maxLength={10}
              disabled={Boolean(pendingPhone)}
            />
          </div>
        </label>
        {pendingPhone && (
          <label>
            <span>Six-digit code</span>
            <input
              className="vendor-otp-field"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
          </label>
        )}
        {message && (
          <p className="vendor-access-message" role="status">
            {message}
          </p>
        )}
        <button
          type="button"
          className="vendor-access-action"
          onClick={continueSignIn}
          disabled={busy || (Boolean(pendingPhone) && code.length !== 6)}
        >
          {busy ? <LoaderCircle className="access-spinner" /> : <ShieldCheck />}
          {pendingPhone ? "Verify and open workspace" : "Send secure code"}
        </button>
        <small>Access is enforced again by branch membership and database security policies.</small>
      </section>
    </main>
  );
}

function VendorAccessDenied({
  onRetry,
  error = false,
}: {
  onRetry: () => Promise<void>;
  error?: boolean;
}) {
  async function resetSession() {
    await signOutVendorWorkspace();
    await onRetry();
  }

  return (
    <main className="vendor-access-shell">
      <section className="vendor-access-card">
        <span className="vendor-access-logo danger">!</span>
        <span className="access-kicker">ACCESS CHECK</span>
        <h1>{error ? "Restaurant access could not load" : "No active restaurant membership"}</h1>
        <p>
          {error
            ? "Retry the secure access check. If it continues, the staging database or network needs attention."
            : "This signed-in account is not an active owner, manager or kitchen member for an approved branch."}
        </p>
        <button type="button" className="vendor-access-action" onClick={onRetry}>
          Retry access check
        </button>
        <button type="button" className="vendor-access-secondary" onClick={resetSession}>
          Sign out and use another number
        </button>
        <a href="/order">Return to customer marketplace</a>
      </section>
    </main>
  );
}

function OrdersBoard({
  orders,
  now,
  busyOrderId,
  moveOrder,
  canAcceptOrders,
  rejectOrder,
  metrics,
}: {
  orders: VendorOrder[];
  now: number;
  busyOrderId: string | null;
  moveOrder: (id: string, next: VendorOrderStatus, note?: string) => Promise<void>;
  rejectOrder: (id: string) => void;
  metrics: ReturnType<typeof vendorMetrics>;
  canAcceptOrders: boolean;
}) {
  const columns: Array<{ status: VendorOrderStatus; label: string; icon: typeof Clock3 }> = [
    { status: "placed", label: "New", icon: BellRing },
    { status: "accepted", label: "Accepted", icon: CheckCircle2 },
    { status: "preparing", label: "Preparing", icon: ChefHat },
    { status: "ready", label: "Ready", icon: PackageCheck },
  ];

  return (
    <>
      <section className="metric-grid" aria-label="Live order summary">
        <Metric icon={BellRing} label="New orders" value={String(metrics.newOrders)} tone="brand" />
        <Metric icon={ChefHat} label="In kitchen" value={String(metrics.cooking)} tone="amber" />
        <Metric icon={PackageCheck} label="Ready" value={String(metrics.ready)} tone="green" />
        <Metric
          icon={CircleDollarSign}
          label="COD to reconcile"
          value={formatPkr(metrics.codOutstanding)}
          tone="blue"
        />
      </section>

      <section className="orders-heading">
        <div>
          <span className="section-kicker">LIVE OPERATIONS</span>
          <h2>Order board</h2>
          <p>Accept quickly, keep the kitchen moving and record every exception.</p>
        </div>
        <div className="sla-chip">
          <Gauge size={17} />{" "}
          {metrics.late > 0 ? `${metrics.late} order needs attention` : "All orders on time"}
        </div>
      </section>

      <div className="order-board">
        {columns.map(({ status, label, icon: Icon }) => {
          const items = orders.filter((order) => order.status === status);
          return (
            <section className={`order-column ${status}`} key={status}>
              <header>
                <span>
                  <Icon size={18} /> {label}
                </span>
                <b>{items.length}</b>
              </header>
              <div className="order-column-body">
                {items.length === 0 && (
                  <p className="column-empty">No {label.toLowerCase()} orders.</p>
                )}
                {items.map((order) => (
                  <OrderCard
                    order={order}
                    now={now}
                    key={order.id}
                    disabled={busyOrderId === order.id}
                    moveOrder={moveOrder}
                    rejectOrder={rejectOrder}
                    canAcceptOrders={canAcceptOrders}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function OrderCard({
  order,
  now,
  disabled,
  moveOrder,
  rejectOrder,
  canAcceptOrders,
}: {
  order: VendorOrder;
  now: number;
  disabled: boolean;
  moveOrder: (id: string, next: VendorOrderStatus) => Promise<void>;
  rejectOrder: (id: string) => void;
  canAcceptOrders: boolean;
}) {
  const age = orderAgeMinutes(order, now);
  const urgency = getOrderUrgency(order, now);
  const nextAction =
    order.status === "accepted"
      ? { status: "preparing" as const, label: "Start preparing" }
      : order.status === "preparing"
        ? { status: "ready" as const, label: "Mark ready" }
        : order.status === "ready"
          ? {
              status: "completed" as const,
              label: order.fulfilment === "collection" ? "Collected" : "Handed to rider",
            }
          : null;

  return (
    <article className={`vendor-order-card urgency-${urgency}`}>
      <div className="order-card-top">
        <span>
          <strong>{order.reference}</strong>
          <small>{order.customer}</small>
        </span>
        <span className={`order-age ${urgency}`}>
          <Clock3 size={14} /> {age}m
        </span>
      </div>
      <div className="order-badges">
        <span>{order.fulfilment}</span>
        <span className={order.payment === "cod" ? "cod" : "paid"}>
          {order.payment === "cod" ? "Cash on delivery" : "Paid"}
        </span>
      </div>
      <ul>
        {order.lines.map((line) => (
          <li key={line.id}>
            <span>
              <b>{line.quantity}×</b> {line.name}
            </span>
            {line.note && <small>{line.note}</small>}
          </li>
        ))}
      </ul>
      {order.note && <p className="customer-note">“{order.note}”</p>}
      {order.address && <p className="order-address">{order.address}</p>}
      <div className="order-total">
        <span>Total</span>
        <strong>{formatPkr(order.totalPaisa)}</strong>
      </div>

      {order.status === "placed" && !canAcceptOrders ? (
        <p className="manager-approval-note">
          <ShieldCheck size={15} /> Waiting for owner or manager approval
        </p>
      ) : order.status === "placed" ? (
        <div className="card-actions split">
          <button
            type="button"
            className="primary"
            disabled={disabled}
            onClick={() => moveOrder(order.id, "accepted")}
          >
            <Check size={17} /> Accept
          </button>
          <button
            type="button"
            className="reject"
            disabled={disabled}
            onClick={() => rejectOrder(order.id)}
          >
            <X size={17} /> Reject
          </button>
        </div>
      ) : (
        nextAction && (
          <div className="card-actions">
            <button
              type="button"
              className="primary"
              disabled={disabled}
              onClick={() => moveOrder(order.id, nextAction.status)}
            >
              {order.status === "ready" ? <CheckCircle2 size={17} /> : <ChefHat size={17} />}
              {nextAction.label}
            </button>
          </div>
        )
      )}
    </article>
  );
}

function KitchenDisplay({
  orders,
  now,
  bumpedLines,
  toggleLine,
  busyOrderId,
  moveOrder,
  canAcceptOrders,
}: {
  orders: VendorOrder[];
  now: number;
  bumpedLines: string[];
  toggleLine: (id: string) => void;
  busyOrderId: string | null;
  moveOrder: (id: string, next: VendorOrderStatus) => Promise<void>;
  canAcceptOrders: boolean;
}) {
  const active = orders.filter((order) =>
    ["placed", "accepted", "preparing", "ready"].includes(order.status),
  );
  const columns = [
    {
      id: "new",
      label: "New",
      orders: active.filter((order) => ["placed", "accepted"].includes(order.status)),
    },
    {
      id: "cooking",
      label: "Cooking",
      orders: active.filter((order) => order.status === "preparing"),
    },
    { id: "ready", label: "Ready", orders: active.filter((order) => order.status === "ready") },
  ];

  return (
    <section className="kds-shell">
      <header className="kds-header">
        <div>
          <span className="section-kicker">KITCHEN DISPLAY</span>
          <h2>One screen. Clear next action.</h2>
          <p>
            Large touch targets and station labels are designed for tablets and low-cost kitchen
            displays.
          </p>
        </div>
        <div className="kds-legend">
          <span>
            <i className="green" /> On time
          </span>
          <span>
            <i className="amber" /> 5 min left
          </span>
          <span>
            <i className="red" /> Late
          </span>
        </div>
      </header>

      <div className="kds-board">
        {columns.map((column) => (
          <section className={`kds-column ${column.id}`} key={column.id}>
            <header>
              <span>{column.label}</span>
              <b>{column.orders.length}</b>
            </header>
            <div>
              {column.orders.map((order) => {
                const allBumped = order.lines.every((line) => bumpedLines.includes(line.id));
                const urgency = getOrderUrgency(order, now);
                return (
                  <article className={`kds-ticket urgency-${urgency}`} key={order.id}>
                    <div className="ticket-heading">
                      <span>
                        <strong>{order.reference}</strong>
                        <small>{order.fulfilment}</small>
                      </span>
                      <b>{orderAgeMinutes(order, now)}m</b>
                    </div>
                    {order.note && <p className="ticket-note">{order.note}</p>}
                    <div className="ticket-lines">
                      {order.lines.map((line) => {
                        const done = bumpedLines.includes(line.id);
                        return (
                          <button
                            type="button"
                            key={line.id}
                            className={done ? "done" : ""}
                            onClick={() => order.status === "preparing" && toggleLine(line.id)}
                            disabled={order.status !== "preparing"}
                          >
                            <span>
                              <span>
                                <b>{line.quantity}×</b> {line.name}
                              </span>
                              {line.note && <small>{line.note}</small>}
                              <small>{line.station}</small>
                            </span>
                            {done && <Check size={18} />}
                          </button>
                        );
                      })}
                    </div>
                    {order.status === "placed" && canAcceptOrders && (
                      <button
                        className="ticket-action"
                        type="button"
                        disabled={busyOrderId === order.id}
                        onClick={() => moveOrder(order.id, "accepted")}
                      >
                        Accept order
                      </button>
                    )}
                    {order.status === "placed" && !canAcceptOrders && (
                      <p className="ticket-approval-note">Waiting for manager approval</p>
                    )}
                    {order.status === "accepted" && (
                      <button
                        className="ticket-action"
                        type="button"
                        disabled={busyOrderId === order.id}
                        onClick={() => moveOrder(order.id, "preparing")}
                      >
                        Start cooking
                      </button>
                    )}
                    {order.status === "preparing" && (
                      <button
                        className={`ticket-action ready ${allBumped ? "pulse" : ""}`}
                        type="button"
                        disabled={busyOrderId === order.id}
                        onClick={() => moveOrder(order.id, "ready")}
                      >
                        {allBumped ? "All items done — mark ready" : "Mark order ready"}
                      </button>
                    )}
                    {order.status === "ready" && (
                      <button
                        className="ticket-action complete"
                        type="button"
                        disabled={busyOrderId === order.id}
                        onClick={() => moveOrder(order.id, "completed")}
                      >
                        {order.fulfilment === "collection"
                          ? "Customer collected"
                          : "Handed to rider"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function MenuAvailability({
  items,
  onToggle,
  onToggleOption,
  menuCsv,
  setMenuCsv,
  onImport,
  canImport,
}: {
  items: VendorMenuItem[];
  onToggle: (id: string) => Promise<void>;
  onToggleOption: (itemId: string, optionId: string) => Promise<void>;
  menuCsv: string;
  setMenuCsv: (value: string) => void;
  onImport: () => Promise<void>;
  canImport: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="menu-workspace">
      <div className="workspace-section-header">
        <div>
          <span className="section-kicker">MENU CONTROL</span>
          <h2>Availability that reaches checkout</h2>
          <p>
            Sold-out changes are immediate in this prototype and ready for the protected menu RPC.
          </p>
        </div>
        <span className="settings-note">Owner/manager imports are validated and audited.</span>
      </div>
      <div className="menu-import-panel">
        <div>
          <Upload />
          <span>
            <strong>Paste menu CSV</strong>
            <small>
              Columns: name, category, price, description, available. Avoid commas inside fields.
            </small>
          </span>
        </div>
        <textarea
          rows={5}
          value={menuCsv}
          onChange={(event) => setMenuCsv(event.target.value)}
          placeholder={
            "name,category,price,description,available\nChicken Karahi,Desi mains,899,Fresh karahi,true"
          }
          disabled={!canImport}
        />
        <button
          type="button"
          onClick={() => void onImport()}
          disabled={!canImport || !menuCsv.trim()}
        >
          <Upload /> Validate and import menu
        </button>
        {!canImport && <p>Sign in as the live branch owner or manager to import.</p>}
      </div>
      <label className="vendor-search">
        <Search size={19} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search menu items"
        />
      </label>
      <div className="menu-table" role="table" aria-label="Menu availability">
        <div className="menu-table-head" role="row">
          <span>Item</span>
          <span>Price</span>
          <span>Customer availability</span>
        </div>
        {filtered.map((item) => (
          <div className="menu-table-row" role="row" key={item.id}>
            <span>
              <i>
                <ShoppingBag size={19} />
              </i>
              <span>
                <strong>{item.name}</strong>
                <small>{item.category}</small>
                {item.optionGroups.map((group) => (
                  <span className="menu-option-group" key={group.id}>
                    <b>
                      {group.name}
                      {group.required ? " · required" : ""}
                    </b>
                    {group.options.map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        className={option.available ? "available" : "sold-out"}
                        onClick={() => void onToggleOption(item.id, option.id)}
                      >
                        {option.name}
                        {option.priceDelta !== 0 &&
                          ` ${option.priceDelta > 0 ? "+" : "−"}Rs. ${Math.abs(option.priceDelta)}`}
                      </button>
                    ))}
                  </span>
                ))}
              </span>
            </span>
            <strong>Rs. {item.price.toLocaleString("en-PK")}</strong>
            <button
              type="button"
              className={`stock-toggle ${item.available ? "available" : "sold-out"}`}
              aria-pressed={item.available}
              onClick={() => onToggle(item.id)}
            >
              <span /> {item.available ? "Available" : "Sold out"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function VendorReports({
  orders,
  metrics,
}: {
  orders: VendorOrder[];
  metrics: ReturnType<typeof vendorMetrics>;
}) {
  const orderValue = orders
    .filter((order) => order.status !== "rejected")
    .reduce((sum, order) => sum + order.totalPaisa, 0);
  return (
    <section className="reports-workspace">
      <div className="workspace-section-header">
        <div>
          <span className="section-kicker">PILOT REPORT</span>
          <h2>Today at a glance</h2>
          <p>Operational numbers use Pakistan rupees and separate COD exposure from sales.</p>
        </div>
      </div>
      <div className="report-cards">
        <Metric
          icon={CircleDollarSign}
          label="Order value"
          value={formatPkr(orderValue)}
          tone="brand"
        />
        <Metric
          icon={CheckCircle2}
          label="Acceptance"
          value={`${metrics.acceptanceRate}%`}
          tone="green"
        />
        <Metric
          icon={TimerReset}
          label="Needs attention"
          value={String(metrics.late)}
          tone="amber"
        />
      </div>
      <article className="pilot-checklist">
        <span className="pilot-check-icon">
          <ListChecks />
        </span>
        <div>
          <h3>Before this report becomes financial evidence</h3>
          <p>
            Connect settled payments, refunds, discounts, delivery cost, COD handover and vendor
            statements. The UI deliberately does not call gross order value “earnings”.
          </p>
        </div>
      </article>
    </section>
  );
}

function OperationsSettings({
  acceptingOrders,
  setAcceptingOrders,
  prepMinutes,
  setPrepMinutes,
  onSave,
  weeklyHours,
  setWeeklyHours,
  branchSchedule,
  closureEndsAt,
  setClosureEndsAt,
  closureReason,
  setClosureReason,
  onSaveHours,
  onSetClosure,
}: {
  acceptingOrders: boolean;
  setAcceptingOrders: React.Dispatch<React.SetStateAction<boolean>>;
  prepMinutes: number;
  setPrepMinutes: React.Dispatch<React.SetStateAction<number>>;
  onSave: () => Promise<void>;
  weeklyHours: VendorDayHours[];
  setWeeklyHours: React.Dispatch<React.SetStateAction<VendorDayHours[]>>;
  branchSchedule: VendorBranchSchedule | null;
  closureEndsAt: string;
  setClosureEndsAt: React.Dispatch<React.SetStateAction<string>>;
  closureReason: string;
  setClosureReason: React.Dispatch<React.SetStateAction<string>>;
  onSaveHours: () => Promise<void>;
  onSetClosure: (clear?: boolean) => Promise<void>;
}) {
  return (
    <section className="settings-workspace">
      <div className="workspace-section-header">
        <div>
          <span className="section-kicker">BRANCH OPERATIONS</span>
          <h2>Capacity and preparation</h2>
          <p>Safe defaults for a controlled Lahore restaurant pilot.</p>
        </div>
      </div>
      <div className="settings-grid">
        <article className="setting-card">
          <span className="setting-icon">
            <Store />
          </span>
          <div>
            <h3>Online ordering</h3>
            <p>Pause new checkout while existing orders continue.</p>
          </div>
          <button
            type="button"
            className={`stock-toggle ${acceptingOrders ? "available" : "sold-out"}`}
            onClick={() => setAcceptingOrders((value) => !value)}
          >
            <span />
            {acceptingOrders ? "Open" : "Paused"}
          </button>
        </article>
        <article className="setting-card prep-setting">
          <span className="setting-icon">
            <Clock3 />
          </span>
          <div>
            <h3>Default preparation time</h3>
            <p>Shown to customers before they order.</p>
          </div>
          <label>
            <input
              type="number"
              min={10}
              max={90}
              step={5}
              value={prepMinutes}
              onChange={(event) => setPrepMinutes(Number(event.target.value))}
            />{" "}
            minutes
          </label>
        </article>
        <article className="setting-card">
          <span className="setting-icon">
            <Wifi />
          </span>
          <div>
            <h3>Low-bandwidth mode</h3>
            <p>Text-first order tickets remain readable on unstable connections.</p>
          </div>
          <span className="setting-ready">
            <Check /> Included
          </span>
        </article>
      </div>
      <button type="button" className="save-settings" onClick={onSave}>
        <Check size={18} /> Save operating settings
      </button>

      <section className="schedule-settings" aria-labelledby="weekly-hours-heading">
        <div className="workspace-section-header">
          <div>
            <span className="section-kicker">CUSTOMER AVAILABILITY</span>
            <h2 id="weekly-hours-heading">Weekly opening hours</h2>
            <p>
              Checkout is blocked outside these Asia/Karachi times. All seven days are required.
            </p>
          </div>
          <span className={`schedule-state ${branchSchedule?.is_open ? "open" : "closed"}`}>
            <Clock3 size={16} /> {branchSchedule?.is_open ? "Open now" : "Closed now"}
          </span>
        </div>
        <div className="weekly-hours-grid">
          {weeklyHours.map((day) => (
            <article key={day.weekday}>
              <strong>{dayNames[day.weekday]}</strong>
              <label className="day-closed-toggle">
                <input
                  type="checkbox"
                  checked={day.closed}
                  onChange={(event) =>
                    setWeeklyHours((current) =>
                      current.map((item) =>
                        item.weekday === day.weekday
                          ? { ...item, closed: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                Closed
              </label>
              <label>
                <span>Opens</span>
                <input
                  type="time"
                  value={day.opens_at.slice(0, 5)}
                  disabled={day.closed}
                  onChange={(event) =>
                    setWeeklyHours((current) =>
                      current.map((item) =>
                        item.weekday === day.weekday
                          ? { ...item, opens_at: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                <span>Closes</span>
                <input
                  type="time"
                  value={day.closes_at.slice(0, 5)}
                  disabled={day.closed}
                  onChange={(event) =>
                    setWeeklyHours((current) =>
                      current.map((item) =>
                        item.weekday === day.weekday
                          ? { ...item, closes_at: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            </article>
          ))}
        </div>
        <button type="button" className="save-settings" onClick={() => void onSaveHours()}>
          <Check size={18} /> Save all opening hours
        </button>
      </section>

      <section className="temporary-closure" aria-labelledby="closure-heading">
        <div>
          <span className="section-kicker">HOLIDAY OR EMERGENCY</span>
          <h2 id="closure-heading">Temporary closure</h2>
          <p>Close checkout immediately without deleting the normal weekly schedule.</p>
        </div>
        {branchSchedule?.active_closure ? (
          <div className="active-closure">
            <PauseCircle />
            <span>
              <strong>{branchSchedule.active_closure.reason}</strong>
              <small>
                Reopens{" "}
                {new Intl.DateTimeFormat("en-PK", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Karachi",
                }).format(new Date(branchSchedule.active_closure.ends_at))}
              </small>
            </span>
            <button type="button" onClick={() => void onSetClosure(true)}>
              Clear closure
            </button>
          </div>
        ) : (
          <div className="closure-fields">
            <label>
              <span>Reopen at</span>
              <input
                type="datetime-local"
                value={closureEndsAt}
                onChange={(event) => setClosureEndsAt(event.target.value)}
              />
            </label>
            <label>
              <span>Reason</span>
              <input
                value={closureReason}
                maxLength={160}
                onChange={(event) => setClosureReason(event.target.value)}
                placeholder="Public holiday or kitchen maintenance"
              />
            </label>
            <button type="button" onClick={() => void onSetClosure(false)}>
              Close temporarily
            </button>
          </div>
        )}
      </section>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>
        <Icon />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
