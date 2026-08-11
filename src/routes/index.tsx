import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Heart,
  Home,
  LocateFixed,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  UserRound,
  Users,
  Utensils,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canRequestCancellation,
  customerOrderProgress,
  type CustomerOrder,
} from "../lib/customer-workspace";
import {
  checkPilotServiceability,
  isPilotLocationServiceable,
  pilotLocations,
  type ServiceabilityResult,
} from "../lib/serviceability";
import {
  createCodOrder,
  getCurrentCustomer,
  isPilotBackendConfigured,
  listCustomerOrders,
  listMarketplaceCatalog,
  requestCustomerCancellation,
  requestPakistanOtp,
  saveCustomerPilotAddress,
  signOutCustomer,
  subscribeToCustomerOrders,
  verifyPakistanOtp,
  type CreatedCodOrder,
} from "../lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Onyn — Pakistan's fair food delivery app" },
      {
        name: "description",
        content:
          "Order from local restaurants and home chefs with clear prices, live tracking and fair delivery, starting with selected Lahore pilot zones.",
      },
      { property: "og:title", content: "Onyn — Local food. Fair delivery." },
      {
        property: "og:description",
        content: "Pakistan's fair food delivery marketplace for customers, vendors and riders.",
      },
    ],
  }),
  component: OnynApp,
});

type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: string;
  eta: string;
  delivery: number;
  min: number;
  promo?: string;
  emoji: string;
  gradient: string;
  tags: string[];
  serviceFee?: number;
  acceptingOrders?: boolean;
  acceptsDelivery?: boolean;
  acceptsCollection?: boolean;
  isLive?: boolean;
};

type MenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  detail: string;
  price: number;
  emoji: string;
  popular?: boolean;
  available?: boolean;
  category?: string;
  isLive?: boolean;
};

type CartLine = MenuItem & { quantity: number };
type AppView = "home" | "search" | "orders" | "account" | "restaurant" | "checkout";

const categories = [
  ["🍔", "Burgers"],
  ["🍛", "Desi"],
  ["🍕", "Pizza"],
  ["🥘", "Home chefs"],
  ["🍗", "Chicken"],
  ["🥗", "Healthy"],
  ["🍰", "Desserts"],
];

const serviceModes = [
  {
    id: "food",
    icon: Utensils,
    label: "Food",
    detail: "Restaurants & home chefs",
    title: "What are you craving today?",
    copy: "Restaurants, home chefs and everyday favourites—delivered across your neighbourhood.",
    phase: "Launch",
  },
  {
    id: "grocery",
    icon: ShoppingBag,
    label: "Grocery",
    detail: "Shops & daily essentials",
    title: "Your essentials, without the extra trip.",
    copy: "A low-bandwidth grocery experience with live stock and sensible substitutions.",
    phase: "Next",
  },
  {
    id: "pharmacy",
    icon: ShieldCheck,
    label: "Pharmacy",
    detail: "Verified health retailers",
    title: "Trusted pharmacy delivery, designed safely.",
    copy: "Verified retailers, prescription controls and clear pharmacist escalation are required first.",
    phase: "Later",
  },
  {
    id: "courier",
    icon: PackageCheck,
    label: "Courier",
    detail: "Local pickup & drop",
    title: "Send a package across your city.",
    copy: "Address validation, item rules, proof of delivery and transparent distance pricing come first.",
    phase: "Later",
  },
] as const;

type ServiceMode = (typeof serviceModes)[number]["id"];

const restaurants: Restaurant[] = [
  {
    id: "karahi-house",
    name: "Lahori Karahi House",
    cuisine: "Pakistani • Karahi • BBQ",
    rating: 4.8,
    reviews: "1.2k",
    eta: "22–32 min",
    delivery: 89,
    min: 399,
    promo: "20% OFF",
    emoji: "🥘",
    gradient: "sunset",
    tags: ["Desi", "BBQ"],
  },
  {
    id: "smash-yard",
    name: "Smash Yard",
    cuisine: "Burgers • Loaded fries",
    rating: 4.7,
    reviews: "860",
    eta: "18–28 min",
    delivery: 69,
    min: 449,
    promo: "FREE DELIVERY",
    emoji: "🍔",
    gradient: "berry",
    tags: ["Burgers", "Fast food"],
  },
  {
    id: "amma-kitchen",
    name: "Amma's Home Kitchen",
    cuisine: "Home chef • Daily menu",
    rating: 4.9,
    reviews: "342",
    eta: "30–40 min",
    delivery: 79,
    min: 299,
    promo: "NEW",
    emoji: "🍲",
    gradient: "leaf",
    tags: ["Home chefs", "Desi"],
  },
  {
    id: "slice-club",
    name: "The Slice Club",
    cuisine: "Pizza • Pasta • Sides",
    rating: 4.6,
    reviews: "705",
    eta: "25–35 min",
    delivery: 99,
    min: 599,
    promo: "BUY 1 GET 1",
    emoji: "🍕",
    gradient: "night",
    tags: ["Pizza", "Italian"],
  },
  {
    id: "green-bowl",
    name: "Green Bowl Co.",
    cuisine: "Healthy • Salads • Wraps",
    rating: 4.7,
    reviews: "221",
    eta: "20–30 min",
    delivery: 59,
    min: 349,
    emoji: "🥗",
    gradient: "mint",
    tags: ["Healthy"],
  },
  {
    id: "sweet-street",
    name: "Sweet Street",
    cuisine: "Desserts • Cakes • Shakes",
    rating: 4.8,
    reviews: "533",
    eta: "15–25 min",
    delivery: 49,
    min: 249,
    promo: "15% OFF",
    emoji: "🍰",
    gradient: "candy",
    tags: ["Desserts"],
  },
];

const menu: MenuItem[] = [
  {
    id: "chicken-karahi",
    restaurantId: "karahi-house",
    name: "Chicken Karahi",
    detail: "Fresh tomato masala, ginger, green chilli and naan",
    price: 899,
    emoji: "🥘",
    popular: true,
  },
  {
    id: "malai-boti",
    restaurantId: "karahi-house",
    name: "Malai Boti",
    detail: "Creamy charcoal-grilled chicken, chutney and salad",
    price: 649,
    emoji: "🍢",
    popular: true,
  },
  {
    id: "daal-chawal",
    restaurantId: "karahi-house",
    name: "Daal Chawal",
    detail: "Comforting yellow daal, steamed rice and achar",
    price: 349,
    emoji: "🍛",
  },
  {
    id: "smash-double",
    restaurantId: "smash-yard",
    name: "Double Smash Burger",
    detail: "Two beef patties, cheddar, onions and house sauce",
    price: 749,
    emoji: "🍔",
    popular: true,
  },
  {
    id: "loaded-fries",
    restaurantId: "smash-yard",
    name: "Loaded Masala Fries",
    detail: "Crispy fries, cheese sauce, jalapeños and masala",
    price: 449,
    emoji: "🍟",
  },
  {
    id: "aloo-keema",
    restaurantId: "amma-kitchen",
    name: "Aloo Keema Thali",
    detail: "Home-style mince, roti, raita and salad",
    price: 499,
    emoji: "🍲",
    popular: true,
  },
];

const roleCards = [
  {
    icon: Store,
    title: "Restaurant partner",
    detail: "Fixed monthly fee. Keep more of every order.",
    action: "Open restaurant workspace",
    href: "/vendor",
  },
  {
    icon: Bike,
    title: "Delivery rider",
    detail: "Flexible shifts, clear earnings and local zones.",
    action: "Ride with Onyn",
  },
  {
    icon: Users,
    title: "Sales partner",
    detail: "Earn commission onboarding quality local vendors.",
    action: "Become an agent",
  },
  {
    icon: PackageCheck,
    title: "Supplier partner",
    detail: "Supply verified restaurants with stock and simpler ordering.",
    action: "Join as a supplier",
  },
];

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-PK")}`;
}

function OnynApp() {
  const backendConfigured = isPilotBackendConfigured();
  const [view, setView] = useState<AppView>("home");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("food");
  const [fulfilment, setFulfilment] = useState<"delivery" | "collection">("delivery");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant>(restaurants[0]);
  const [marketRestaurants, setMarketRestaurants] = useState<Restaurant[]>(restaurants);
  const [marketMenu, setMarketMenu] = useState<MenuItem[]>(menu);
  const [catalogState, setCatalogState] = useState<"demo" | "loading" | "live" | "empty" | "error">(
    backendConfigured ? "loading" : "demo",
  );
  const [catalogMessage, setCatalogMessage] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [partnerMessage, setPartnerMessage] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [location, setLocation] = useState("Gulberg III, Lahore");
  const [locationQuery, setLocationQuery] = useState("");
  const [serviceabilityResult, setServiceabilityResult] = useState<ServiceabilityResult | null>(
    null,
  );
  const [addressLine, setAddressLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<CreatedCodOrder | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [ordersState, setOrdersState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [checkoutState, setCheckoutState] = useState<"idle" | "placing" | "error">("idle");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [returnToCheckout, setReturnToCheckout] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelState, setCancelState] = useState<"idle" | "sending" | "error">("idle");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [otpState, setOtpState] = useState<
    "idle" | "sending" | "sent" | "verifying" | "verified" | "error"
  >("idle");
  const [otpMessage, setOtpMessage] = useState("");

  const loadOrders = useCallback(async () => {
    if (!backendConfigured) return;
    setOrdersState("loading");
    try {
      setCustomerOrders(await listCustomerOrders());
      setOrdersState("ready");
    } catch {
      setOrdersState("error");
    }
  }, [backendConfigured]);

  useEffect(() => {
    if (!backendConfigured) return;
    let active = true;
    setCatalogState("loading");
    void listMarketplaceCatalog("Lahore")
      .then((catalog) => {
        if (!active) return;
        if (!catalog.restaurants.length) {
          setMarketRestaurants([]);
          setMarketMenu([]);
          setCatalogState("empty");
          setCatalogMessage("No Lahore pilot restaurant is accepting discovery yet.");
          return;
        }
        const nextRestaurants = catalog.restaurants as Restaurant[];
        setMarketRestaurants(nextRestaurants);
        setMarketMenu(catalog.menu as MenuItem[]);
        setSelectedRestaurant(nextRestaurants[0]);
        setCatalogState("live");
        setCatalogMessage("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMarketRestaurants([]);
        setMarketMenu([]);
        setCatalogState("error");
        setCatalogMessage(
          error instanceof Error ? error.message : "The live catalog is unavailable.",
        );
      });
    return () => {
      active = false;
    };
  }, [backendConfigured]);

  useEffect(() => {
    if (!backendConfigured) return;
    let active = true;
    void getCurrentCustomer().then((user) => {
      if (!active || !user) return;
      setCustomerId(user.id);
      setOtpState("verified");
      void loadOrders();
    });
    return () => {
      active = false;
    };
  }, [backendConfigured, loadOrders]);

  useEffect(() => {
    if (!customerId) return;
    return subscribeToCustomerOrders(customerId, () => void loadOrders());
  }, [customerId, loadOrders]);

  const filteredRestaurants = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return marketRestaurants.filter((restaurant) => {
      const categoryMatch =
        activeCategory === "All" ||
        restaurant.tags.some((tag) => tag.toLowerCase() === activeCategory.toLowerCase());
      const queryMatch =
        !needle ||
        `${restaurant.name} ${restaurant.cuisine} ${restaurant.tags.join(" ")}`
          .toLowerCase()
          .includes(needle);
      return categoryMatch && queryMatch;
    });
  }, [activeCategory, marketRestaurants, query]);

  const restaurantMenu = marketMenu.filter((item) => item.restaurantId === selectedRestaurant.id);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length && fulfilment === "delivery" ? selectedRestaurant.delivery : 0;
  const serviceFee = cart.length ? (selectedRestaurant.serviceFee ?? 29) : 0;
  const total = subtotal + deliveryFee + serviceFee;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const activeService = serviceModes.find((mode) => mode.id === serviceMode) ?? serviceModes[0];
  const deliveryAddressComplete =
    fulfilment === "collection" ||
    (isPilotLocationServiceable(location) &&
      addressLine.trim().length >= 5 &&
      landmark.trim().length >= 3);
  const minimumOrderMet = subtotal >= selectedRestaurant.min;
  const fulfilmentAvailable =
    fulfilment === "delivery"
      ? selectedRestaurant.acceptsDelivery !== false
      : selectedRestaurant.acceptsCollection !== false;
  const checkoutReady =
    deliveryAddressComplete &&
    minimumOrderMet &&
    fulfilmentAvailable &&
    selectedRestaurant.acceptingOrders !== false &&
    checkoutState !== "placing";

  function checkAddress() {
    const result = checkPilotServiceability(locationQuery);
    setServiceabilityResult(result);
    if (result.status === "serviceable") {
      setLocation(result.location.label);
    }
  }

  function navigate(next: AppView) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openRestaurant(restaurant: Restaurant) {
    setOrderPlaced(false);
    setPlacedOrder(null);
    setCheckoutMessage("");
    if (cart.length && cart[0].restaurantId !== restaurant.id) {
      setCart([]);
      setCatalogMessage("Your basket was cleared because each order can contain one restaurant.");
    }
    if (fulfilment === "delivery" && restaurant.acceptsDelivery === false) {
      setFulfilment("collection");
    } else if (fulfilment === "collection" && restaurant.acceptsCollection === false) {
      setFulfilment("delivery");
    }
    setSelectedRestaurant(restaurant);
    setView("restaurant");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addItem(item: MenuItem) {
    if (item.available === false || selectedRestaurant.acceptingOrders === false) return;
    setCart((current) => {
      const existing = current.find((line) => line.id === item.id);
      if (existing) {
        return current.map((line) =>
          line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { ...item, quantity: 1 }];
    });
  }

  function changeQuantity(id: string, amount: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.id === id ? { ...line, quantity: Math.max(0, line.quantity + amount) } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function toggleFavourite(id: string) {
    setFavourites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function sendOtp() {
    if (otpState === "sending") return;
    setOtpState("sending");
    setOtpMessage("");
    const result = await requestPakistanOtp(phone);
    if (result.ok) {
      setOtpState("sent");
      setPendingPhone(result.phone);
      setOtpMessage(`A secure code was sent to ${result.phone}.`);
      return;
    }
    setOtpState("error");
    setOtpMessage(result.message);
  }

  async function verifyOtpCode() {
    if (otpState === "verifying") return;
    setOtpState("verifying");
    const result = await verifyPakistanOtp(pendingPhone, otpCode);
    if (result.ok) {
      const user = await getCurrentCustomer();
      setCustomerId(user?.id ?? null);
      if (user) void loadOrders();
      setOtpState("verified");
      setOtpMessage("Mobile number verified. You are securely signed in.");
      if (returnToCheckout) {
        setReturnToCheckout(false);
        navigate("checkout");
      }
      return;
    }
    setOtpState("error");
    setOtpMessage(result.message);
  }

  async function placeOrder() {
    if (checkoutState === "placing" || !cart.length) return;
    setCheckoutMessage("");

    if (catalogState !== "live") {
      setPlacedOrder(null);
      setOrderPlaced(true);
      return;
    }
    if (!customerId) {
      setReturnToCheckout(true);
      setOtpMessage("Sign in securely to return to checkout and place this COD order.");
      navigate("account");
      return;
    }

    setCheckoutState("placing");
    try {
      const address =
        fulfilment === "delivery"
          ? await saveCustomerPilotAddress({
              label: location,
              city: "Lahore",
              addressLine,
              landmark,
              deliveryNote,
            })
          : null;
      const created = await createCodOrder({
        branchId: selectedRestaurant.id,
        addressId: address?.id ?? null,
        fulfilment,
        items: cart.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
        note: deliveryNote,
      });
      setPlacedOrder(created);
      setOrderPlaced(true);
      setCart([]);
      setCheckoutState("idle");
      void loadOrders();
    } catch (error) {
      setCheckoutState("error");
      setCheckoutMessage(
        error instanceof Error ? error.message : "The order could not be placed safely.",
      );
    }
  }

  async function submitCancellation() {
    if (!cancelOrderId || cancelState === "sending") return;
    if (cancelReason.trim().length < 5) {
      setCancelState("error");
      return;
    }
    setCancelState("sending");
    try {
      const result = await requestCustomerCancellation(cancelOrderId, cancelReason);
      setCancelOrderId(null);
      setCancelReason("");
      setCancelState("idle");
      setCheckoutMessage(
        result.outcome === "cancelled"
          ? "The order was cancelled before the restaurant accepted it."
          : result.outcome === "review_requested"
            ? "The restaurant had started the order, so support review has been requested."
            : "This completed order can no longer be cancelled.",
      );
      await loadOrders();
    } catch (error) {
      setCancelState("error");
      setCheckoutMessage(error instanceof Error ? error.message : "Cancellation failed.");
    }
  }

  async function logOutCustomer() {
    await signOutCustomer();
    setCustomerId(null);
    setCustomerOrders([]);
    setOtpState("idle");
    setOtpCode("");
    setPendingPhone("");
    setOtpMessage("You have been signed out.");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            type="button"
            onClick={() => navigate("home")}
            aria-label="Onyn home"
          >
            <span className="brand-mark">O</span>
            <span>onyn</span>
            <small>PK</small>
          </button>

          <button className="location-button" type="button" onClick={() => setLocationOpen(true)}>
            <MapPin size={18} />
            <span>
              <small>{fulfilment === "delivery" ? "Deliver to" : "Collect near"}</small>
              <strong>{location}</strong>
            </span>
            <ChevronDown size={16} />
          </button>

          <nav className="desktop-nav" aria-label="Main navigation">
            <button type="button" onClick={() => navigate("orders")}>
              Orders
            </button>
            <button type="button" onClick={() => setRoleOpen(true)}>
              Partner with us
            </button>
            <button className="sign-in-button" type="button" onClick={() => navigate("account")}>
              {customerId ? "Account" : "Sign in"}
            </button>
          </nav>

          <button
            className="cart-button"
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Basket with ${cartCount} items`}
          >
            <ShoppingBag size={20} />
            <span>{cartCount || "Basket"}</span>
          </button>
        </div>
      </header>

      <main id="main-content">
        {view === "home" && (
          <>
            <section className="hero-section">
              <div className="hero-content">
                <span className="eyebrow">
                  <Sparkles size={15} /> Fair delivery. Better for local businesses.
                </span>
                <div className="service-switcher" aria-label="Choose an Onyn service">
                  {serviceModes.map(({ id, icon: Icon, label, phase }) => (
                    <button
                      type="button"
                      key={id}
                      className={serviceMode === id ? "active" : ""}
                      aria-pressed={serviceMode === id}
                      onClick={() => setServiceMode(id)}
                    >
                      <Icon size={17} />
                      <span>{label}</span>
                      <small>{phase}</small>
                    </button>
                  ))}
                </div>
                <h1>{activeService.title}</h1>
                <p>{activeService.copy}</p>
                {serviceMode === "food" ? (
                  <>
                    <div className="fulfilment-toggle" aria-label="Order fulfilment">
                      <button
                        type="button"
                        className={fulfilment === "delivery" ? "active" : ""}
                        aria-pressed={fulfilment === "delivery"}
                        onClick={() => setFulfilment("delivery")}
                      >
                        <Bike size={16} /> Delivery
                      </button>
                      <button
                        type="button"
                        className={fulfilment === "collection" ? "active" : ""}
                        aria-pressed={fulfilment === "collection"}
                        onClick={() => setFulfilment("collection")}
                      >
                        <Store size={16} /> Collection
                      </button>
                    </div>
                    <SearchBox
                      query={query}
                      setQuery={setQuery}
                      onFocus={() => setView("search")}
                    />
                  </>
                ) : (
                  <div className="service-roadmap-note" role="status">
                    <span>
                      <activeService.icon size={20} />
                    </span>
                    <div>
                      <strong>{activeService.label} is deliberately outside the launch MVP.</strong>
                      <small>
                        The customer entry point is designed; catalog, compliance and operations
                        must pass their launch gate before ordering is enabled.
                      </small>
                    </div>
                    <button type="button" onClick={() => setServiceMode("food")}>
                      Browse food
                    </button>
                  </div>
                )}
                <div className="trust-row">
                  <span>
                    <Check size={15} /> Clear fees
                  </span>
                  <span>
                    <Check size={15} /> Live order updates
                  </span>
                  <span>
                    <Check size={15} /> Local support
                  </span>
                </div>
              </div>
              <div className="hero-art" aria-label="Fresh Pakistani food illustration">
                <div className="dish dish-main">🥘</div>
                <div className="dish dish-small dish-one">🥙</div>
                <div className="dish dish-small dish-two">🍛</div>
                <div className="delivery-chip">
                  <Bike size={18} /> 24 min away
                </div>
                <div className="rating-chip">
                  <ShieldCheck size={16} /> Verified Lahore partners
                </div>
              </div>
            </section>

            <section
              className="content-section category-section"
              aria-labelledby="categories-title"
            >
              <div className="section-heading">
                <div>
                  <span className="kicker">EXPLORE</span>
                  <h2 id="categories-title">What would you like?</h2>
                </div>
                <button type="button" onClick={() => navigate("search")}>
                  See all <ArrowRight size={17} />
                </button>
              </div>
              <div className="category-grid">
                {categories.map(([emoji, label]) => (
                  <button
                    type="button"
                    className="category-card"
                    key={label}
                    onClick={() => {
                      setActiveCategory(label);
                      navigate("search");
                    }}
                  >
                    <span>{emoji}</span>
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="content-section" aria-labelledby="nearby-title">
              <div className="section-heading">
                <div>
                  <span className="kicker">NEAR YOU</span>
                  <h2 id="nearby-title">Lahore pilot restaurants</h2>
                </div>
                <button type="button" onClick={() => navigate("search")}>
                  View all <ArrowRight size={17} />
                </button>
              </div>
              {catalogState === "loading" ? (
                <p className="catalog-status" role="status">
                  Loading verified pilot restaurants…
                </p>
              ) : marketRestaurants.length ? (
                <RestaurantGrid
                  items={marketRestaurants.slice(0, 4)}
                  favourites={favourites}
                  fulfilment={fulfilment}
                  toggleFavourite={toggleFavourite}
                  openRestaurant={openRestaurant}
                />
              ) : (
                <EmptyState
                  icon={Store}
                  title="Pilot restaurants are not open yet"
                  detail={
                    catalogMessage ||
                    "Verified Lahore partners will appear here when onboarding is complete."
                  }
                />
              )}
              {catalogState === "demo" && (
                <p className="catalog-status demo" role="status">
                  Preview catalog only — this deployment is not connected to live restaurant stock.
                </p>
              )}
            </section>

            <section className="fair-section">
              <div>
                <span className="eyebrow light">
                  <ShieldCheck size={15} /> The fair marketplace
                </span>
                <h2>More of your money stays with the restaurant.</h2>
                <p>
                  Onyn charges partners a predictable monthly subscription instead of taking a large
                  cut from every meal.
                </p>
                <button type="button" onClick={() => setRoleOpen(true)}>
                  How Onyn works <ArrowRight size={18} />
                </button>
              </div>
              <div className="fair-stats">
                <article>
                  <strong>0%</strong>
                  <span>Onyn sales commission*</span>
                </article>
                <article>
                  <strong>PKR</strong>
                  <span>Transparent local pricing</span>
                </article>
                <article>
                  <strong>4</strong>
                  <span>Connected experiences</span>
                </article>
              </div>
              <small>
                *Payment processing, delivery and subscription charges may still apply. Full terms
                shown before partner signup.
              </small>
            </section>

            <section className="content-section partner-section" aria-labelledby="partner-title">
              <div className="section-heading">
                <div>
                  <span className="kicker">GROW WITH ONYN</span>
                  <h2 id="partner-title">There is a place for you</h2>
                </div>
              </div>
              <div className="role-grid">
                {roleCards.map(({ icon: Icon, title, detail, action, href }) => (
                  <article className="role-card" key={title}>
                    <span className="role-icon">
                      <Icon />
                    </span>
                    <h3>{title}</h3>
                    <p>{detail}</p>
                    <button
                      type="button"
                      onClick={() => (href ? window.location.assign(href) : setRoleOpen(true))}
                    >
                      {action} <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {view === "search" && (
          <section className="content-section search-page">
            <div className="page-heading">
              <span className="kicker">DISCOVER</span>
              <h1>Find food near you</h1>
              <p>Search restaurants, dishes, cuisines and home chefs.</p>
            </div>
            <SearchBox query={query} setQuery={setQuery} autoFocus />
            <div className="filter-row" aria-label="Restaurant filters">
              {["All", "Desi", "Burgers", "Pizza", "Home chefs", "Healthy", "Desserts"].map(
                (filter) => (
                  <button
                    type="button"
                    key={filter}
                    className={activeCategory === filter ? "active" : ""}
                    onClick={() => setActiveCategory(filter)}
                  >
                    {filter}
                  </button>
                ),
              )}
            </div>
            <div className="results-heading">
              <strong>{filteredRestaurants.length} places</strong>
              <span>
                {fulfilment === "delivery" ? "Delivering to" : "Collection near"} {location}
              </span>
            </div>
            {catalogMessage && (
              <p className="catalog-status" role="status">
                {catalogMessage}
              </p>
            )}
            {filteredRestaurants.length ? (
              <RestaurantGrid
                items={filteredRestaurants}
                favourites={favourites}
                fulfilment={fulfilment}
                toggleFavourite={toggleFavourite}
                openRestaurant={openRestaurant}
              />
            ) : (
              <EmptyState
                icon={Search}
                title="No exact matches"
                detail="Try another dish or clear the selected filter."
                action="Show all places"
                onAction={() => {
                  setQuery("");
                  setActiveCategory("All");
                }}
              />
            )}
          </section>
        )}

        {view === "restaurant" && (
          <section className="restaurant-page">
            <div className={`restaurant-hero ${selectedRestaurant.gradient}`}>
              <button
                className="round-back"
                type="button"
                onClick={() => navigate("search")}
                aria-label="Back to restaurants"
              >
                <ArrowLeft />
              </button>
              <span className="restaurant-emoji">{selectedRestaurant.emoji}</span>
              <button
                className="round-heart"
                type="button"
                onClick={() => toggleFavourite(selectedRestaurant.id)}
                aria-label="Save restaurant"
              >
                <Heart
                  fill={favourites.includes(selectedRestaurant.id) ? "currentColor" : "none"}
                />
              </button>
            </div>
            <div className="restaurant-content">
              <div className="restaurant-title-row">
                <div>
                  <span className="status-pill">
                    <span /> {selectedRestaurant.acceptingOrders === false ? "Paused" : "Open"}
                  </span>
                  <h1>{selectedRestaurant.name}</h1>
                  <p>{selectedRestaurant.cuisine}</p>
                </div>
                <div className="rating-box">
                  <Star fill="currentColor" size={17} />
                  <strong>{selectedRestaurant.isLive ? "New" : selectedRestaurant.rating}</strong>
                  <small>
                    {selectedRestaurant.isLive
                      ? "Verified pilot partner"
                      : `${selectedRestaurant.reviews} reviews`}
                  </small>
                </div>
              </div>
              <div className="restaurant-facts">
                <span>
                  <Clock3 size={17} /> {selectedRestaurant.eta}
                </span>
                <span>
                  {fulfilment === "delivery" ? <Bike size={18} /> : <Store size={18} />}
                  {fulfilment === "delivery"
                    ? `${money(selectedRestaurant.delivery)} delivery`
                    : "Collection available"}
                </span>
                <span>
                  <ShoppingBag size={17} /> Min. {money(selectedRestaurant.min)}
                </span>
              </div>
              {selectedRestaurant.acceptingOrders === false && (
                <p className="catalog-status" role="status">
                  This restaurant has paused new orders. You can browse the menu but cannot add
                  items.
                </p>
              )}
              <div className="menu-layout">
                <div>
                  <div className="section-heading compact">
                    <div>
                      <span className="kicker">MENU</span>
                      <h2>Popular choices</h2>
                    </div>
                  </div>
                  {restaurantMenu.length ? (
                    restaurantMenu.map((item) => (
                      <article className="menu-item" key={item.id}>
                        <div className="menu-copy">
                          {item.popular && (
                            <span className="popular-tag">
                              <Zap size={12} fill="currentColor" /> Popular
                            </span>
                          )}
                          <h3>{item.name}</h3>
                          <p>{item.detail}</p>
                          <strong>{money(item.price)}</strong>
                        </div>
                        <div className="menu-visual">
                          <span>{item.emoji}</span>
                          <button
                            type="button"
                            onClick={() => addItem(item)}
                            aria-label={`Add ${item.name}`}
                            disabled={
                              item.available === false ||
                              selectedRestaurant.acceptingOrders === false
                            }
                          >
                            {item.available === false ? <X /> : <Plus />}
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState
                      icon={Utensils}
                      title="Menu being prepared"
                      detail="This restaurant has not published any active menu items yet."
                    />
                  )}
                </div>
                <aside className="desktop-basket">
                  <BasketContent
                    cart={cart}
                    subtotal={subtotal}
                    deliveryFee={deliveryFee}
                    fulfilment={fulfilment}
                    serviceFee={serviceFee}
                    total={total}
                    changeQuantity={changeQuantity}
                    checkout={() => navigate("checkout")}
                    checkoutDisabled={
                      selectedRestaurant.acceptingOrders === false || !fulfilmentAvailable
                    }
                  />
                </aside>
              </div>
            </div>
          </section>
        )}

        {view === "checkout" && (
          <section className="content-section checkout-page">
            {!orderPlaced ? (
              <>
                <button className="text-back" type="button" onClick={() => navigate("restaurant")}>
                  <ArrowLeft size={17} /> Back to menu
                </button>
                <div className="page-heading">
                  <span className="kicker">SECURE CHECKOUT</span>
                  <h1>Review the pilot order</h1>
                  <p>
                    {catalogState === "live"
                      ? "The server rechecks stock, serviceability and every price before creating a cash-on-delivery order."
                      : "Final fees are shown for review. This deployment is still using preview catalog data."}
                  </p>
                </div>
                <div className="checkout-grid">
                  <div className="checkout-details">
                    <CheckoutCard
                      icon={fulfilment === "delivery" ? MapPin : Store}
                      title={fulfilment === "delivery" ? "Delivery address" : "Collection branch"}
                      action="Change"
                      onAction={() => setLocationOpen(true)}
                    >
                      <strong>{location}</strong>
                      <p>
                        {fulfilment === "delivery"
                          ? "Controlled Lahore pilot zone"
                          : selectedRestaurant.name}
                      </p>
                    </CheckoutCard>
                    {fulfilment === "delivery" && (
                      <div className="delivery-address-fields">
                        <label>
                          <span>House, street or building</span>
                          <input
                            value={addressLine}
                            onChange={(event) => setAddressLine(event.target.value)}
                            maxLength={240}
                            autoComplete="street-address"
                            placeholder="House 24, Street 7"
                          />
                        </label>
                        <label>
                          <span>Nearest landmark (required)</span>
                          <input
                            value={landmark}
                            onChange={(event) => setLandmark(event.target.value)}
                            maxLength={160}
                            placeholder="Near Main Market mosque"
                          />
                        </label>
                      </div>
                    )}
                    <CheckoutCard
                      icon={Clock3}
                      title={fulfilment === "delivery" ? "Delivery time" : "Collection time"}
                    >
                      <strong>As soon as possible</strong>
                      <p>Estimated {selectedRestaurant.eta}</p>
                    </CheckoutCard>
                    <CheckoutCard icon={WalletCards} title="Payment method">
                      <strong>
                        {fulfilment === "delivery" ? "Cash on delivery" : "Pay on collection"}
                      </strong>
                      <p>JazzCash, Easypaisa and cards will be enabled after gateway approval.</p>
                    </CheckoutCard>
                    <label className="notes-field">
                      <span>
                        {fulfilment === "delivery" ? "Delivery" : "Collection"} note (optional)
                      </span>
                      <textarea
                        maxLength={160}
                        value={deliveryNote}
                        onChange={(event) => setDeliveryNote(event.target.value)}
                        placeholder={
                          fulfilment === "delivery"
                            ? "Gate, landmark or rider instructions"
                            : "Collection name or restaurant request"
                        }
                      />
                    </label>
                  </div>
                  <aside className="order-summary">
                    <BasketContent
                      cart={cart}
                      subtotal={subtotal}
                      deliveryFee={deliveryFee}
                      fulfilment={fulfilment}
                      serviceFee={serviceFee}
                      total={total}
                      changeQuantity={changeQuantity}
                      checkout={() => void placeOrder()}
                      checkoutLabel={
                        checkoutState === "placing"
                          ? "Placing securely…"
                          : `${catalogState === "live" ? "Place COD order" : "Preview order"} • ${money(total)}`
                      }
                      checkoutDisabled={!checkoutReady}
                    />
                    {!deliveryAddressComplete && fulfilment === "delivery" && (
                      <p className="checkout-blocker" role="status">
                        Add the full address and a nearby landmark before placing this delivery
                        order.
                      </p>
                    )}
                    {!minimumOrderMet && cart.length > 0 && (
                      <p className="checkout-blocker" role="status">
                        Add {money(selectedRestaurant.min - subtotal)} more to meet this
                        restaurant's minimum.
                      </p>
                    )}
                    {selectedRestaurant.acceptingOrders === false && (
                      <p className="checkout-blocker" role="status">
                        This restaurant has paused new orders.
                      </p>
                    )}
                    {checkoutMessage && (
                      <p className="checkout-blocker" role="alert">
                        {checkoutMessage}
                      </p>
                    )}
                  </aside>
                </div>
              </>
            ) : (
              <div className="success-state">
                <span>
                  <Check />
                </span>
                <p className="kicker">{placedOrder ? "ORDER CONFIRMED" : "PILOT PREVIEW"}</p>
                <h1>
                  {placedOrder
                    ? "Your COD order is confirmed."
                    : "Thanks—your order preview is ready."}
                </h1>
                {placedOrder ? (
                  <p>
                    Order <strong>#{placedOrder.reference}</strong> was sent to{" "}
                    {selectedRestaurant.name}. The server-confirmed total is{" "}
                    <strong>{money(Math.round(placedOrder.total_paisa / 100))}</strong>.
                  </p>
                ) : (
                  <p>
                    This preview would be sent to {selectedRestaurant.name}. It has not created a
                    live order or cash liability because this deployment has no configured pilot
                    backend.
                  </p>
                )}
                <div className="tracking-steps">
                  <span className="done">
                    <Check /> {placedOrder ? "Placed" : "Simulated"}
                  </span>
                  <span>
                    <Utensils /> Preparing
                  </span>
                  <span>
                    {fulfilment === "delivery" ? <Bike /> : <Store />}
                    {fulfilment === "delivery" ? "On the way" : "Ready to collect"}
                  </span>
                  <span>
                    {fulfilment === "delivery" ? <Home /> : <Check />}
                    {fulfilment === "delivery" ? "Delivered" : "Collected"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    navigate("orders");
                  }}
                >
                  {placedOrder ? "Track live order" : "Preview tracking"}
                </button>
              </div>
            )}
          </section>
        )}

        {view === "orders" && (
          <section className="content-section simple-page">
            <div className="page-heading">
              <span className="kicker">YOUR ORDERS</span>
              <h1>Orders and live tracking</h1>
              <p>One place for active orders, support and receipts.</p>
            </div>
            {checkoutMessage && (
              <p className="catalog-status" role="status">
                {checkoutMessage}
              </p>
            )}
            {backendConfigured && !customerId ? (
              <EmptyState
                icon={UserRound}
                title="Sign in to see protected orders"
                detail="Your order history is only loaded after secure mobile verification."
                action="Sign in"
                onAction={() => navigate("account")}
              />
            ) : backendConfigured && ordersState === "loading" ? (
              <p className="catalog-status" role="status">
                Loading your protected order history…
              </p>
            ) : backendConfigured && customerOrders.length ? (
              <div className="customer-orders-list">
                {customerOrders.map((order) => (
                  <CustomerOrderCard
                    key={order.id}
                    order={order}
                    onCancel={() => {
                      setCancelOrderId(order.id);
                      setCancelReason("");
                      setCancelState("idle");
                    }}
                  />
                ))}
              </div>
            ) : !backendConfigured && orderPlaced ? (
              <article className="active-order">
                <div>
                  <span className="status-pill">
                    <span /> Simulated
                  </span>
                  <h2>{selectedRestaurant.name}</h2>
                  <p>Demo order #ON-10482 • Estimated {selectedRestaurant.eta}</p>
                </div>
                <PackageCheck size={42} />
                <button type="button" onClick={() => navigate("checkout")}>
                  View live status
                </button>
              </article>
            ) : (
              <EmptyState
                icon={ShoppingBag}
                title={ordersState === "error" ? "Orders could not be loaded" : "No orders yet"}
                detail={
                  ordersState === "error"
                    ? "Check the connection and try loading your orders again."
                    : "When you place an order, its protected live status and receipt will appear here."
                }
                action="Explore restaurants"
                onAction={() => navigate("search")}
              />
            )}
          </section>
        )}

        {view === "account" && (
          <section className="content-section account-page">
            <div className="auth-card">
              <span className="brand-mark large">O</span>
              <span className="kicker">WELCOME TO ONYN</span>
              <h1>{customerId ? "You are securely signed in" : "Sign in with your mobile"}</h1>
              <p>
                {customerId
                  ? "Your protected orders and live status updates are available on this device."
                  : "We will send a one-time code. Never share that code with anyone, including an Onyn agent."}
              </p>
              {customerId ? (
                <>
                  <button type="button" onClick={() => navigate("orders")}>
                    View my orders <ArrowRight size={18} />
                  </button>
                  <button
                    type="button"
                    className="account-secondary"
                    onClick={() => void logOutCustomer()}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <label>
                    <span>Pakistan mobile number</span>
                    <div className="phone-input">
                      <strong>+92</strong>
                      <input
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={10}
                        placeholder="3XX XXXXXXX"
                        aria-label="Pakistan mobile number"
                        value={phone}
                        onChange={(event) => {
                          setPhone(event.target.value);
                          if (otpState !== "idle") {
                            setOtpState("idle");
                            setOtpCode("");
                            setPendingPhone("");
                            setOtpMessage("");
                          }
                        }}
                      />
                    </div>
                  </label>
                  {!isPilotBackendConfigured() && (
                    <p className="demo-auth-notice">
                      Demo mode: SMS sign-in is not connected in this deployment.
                    </p>
                  )}
                  {otpMessage && (
                    <p className={`auth-feedback ${otpState}`} role="status" aria-live="polite">
                      {otpMessage}
                    </p>
                  )}
                  {(otpState === "sent" || otpState === "verifying" || otpState === "error") &&
                    pendingPhone && (
                      <label className="otp-code-field">
                        <span>Six-digit code</span>
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={otpCode}
                          onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
                          aria-label="Six-digit verification code"
                        />
                      </label>
                    )}
                  {otpState !== "verified" && (
                    <button
                      type="button"
                      onClick={pendingPhone ? verifyOtpCode : sendOtp}
                      disabled={otpState === "sending" || otpState === "verifying"}
                    >
                      {otpState === "sending"
                        ? "Sending…"
                        : otpState === "verifying"
                          ? "Verifying…"
                          : pendingPhone
                            ? "Verify code"
                            : "Send secure code"}
                      <ArrowRight size={18} />
                    </button>
                  )}
                  {otpState === "verified" && (
                    <button type="button" onClick={() => navigate("home")}>
                      Continue to Onyn <Check size={18} />
                    </button>
                  )}
                  <small>
                    By continuing you agree to Onyn's Terms and Privacy Notice. OTP rate limits and
                    device checks are required before launch.
                  </small>
                </>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <div className="brand footer-brand">
              <span className="brand-mark">O</span>
              <span>onyn</span>
              <small>PK</small>
            </div>
            <p>Local food. Fair delivery. Built for Pakistan.</p>
          </div>
          <div>
            <strong>Order</strong>
            <button onClick={() => navigate("search")} type="button">
              Restaurants
            </button>
            <button
              type="button"
              onClick={() => {
                setServiceMode("grocery");
                navigate("home");
              }}
            >
              Groceries roadmap
            </button>
            <button type="button" disabled title="Support service must be staffed before launch">
              Help centre (pre-launch)
            </button>
          </div>
          <div>
            <strong>Partners</strong>
            <button onClick={() => setRoleOpen(true)} type="button">
              Restaurants
            </button>
            <button onClick={() => setRoleOpen(true)} type="button">
              Riders
            </button>
            <button onClick={() => setRoleOpen(true)} type="button">
              Sales agents
            </button>
          </div>
          <div>
            <strong>Legal</strong>
            <button type="button" disabled title="Legal approval required before public launch">
              Terms (drafting)
            </button>
            <button type="button" disabled title="Legal approval required before public launch">
              Privacy (drafting)
            </button>
            <button
              type="button"
              disabled
              title="Operations approval required before public launch"
            >
              Refunds (drafting)
            </button>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © 2026 Onyn Pakistan.{" "}
            {catalogState === "demo" ? "Preview marketplace." : "Controlled Lahore pilot."}
          </span>
          <span>English • اردو (planned)</span>
        </div>
      </footer>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <MobileNavButton
          icon={Home}
          label="Home"
          active={view === "home"}
          onClick={() => navigate("home")}
        />
        <MobileNavButton
          icon={Search}
          label="Search"
          active={view === "search" || view === "restaurant"}
          onClick={() => navigate("search")}
        />
        <MobileNavButton
          icon={ShoppingBag}
          label="Orders"
          active={view === "orders"}
          onClick={() => navigate("orders")}
        />
        <MobileNavButton
          icon={UserRound}
          label="Account"
          active={view === "account"}
          onClick={() => navigate("account")}
        />
      </nav>

      {cartCount > 0 && view === "restaurant" && (
        <button className="mobile-basket-bar" type="button" onClick={() => setCartOpen(true)}>
          <span>{cartCount}</span>
          <strong>View basket</strong>
          <b>{money(total)}</b>
        </button>
      )}

      {cartOpen && (
        <Modal title="Your basket" onClose={() => setCartOpen(false)}>
          <BasketContent
            cart={cart}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            fulfilment={fulfilment}
            serviceFee={serviceFee}
            total={total}
            changeQuantity={changeQuantity}
            checkout={() => {
              setCartOpen(false);
              navigate("checkout");
            }}
            checkoutDisabled={selectedRestaurant.acceptingOrders === false || !fulfilmentAvailable}
          />
        </Modal>
      )}

      {locationOpen && (
        <Modal title="Choose delivery location" onClose={() => setLocationOpen(false)}>
          <div className="location-modal">
            <div className="pilot-area-note">
              <LocateFixed />
              <span>
                <strong>Lahore pilot</strong>
                <small>Ordering is open only in the two confirmed zones below.</small>
              </span>
            </div>
            <label>
              <span>Check your area and city</span>
              <div className="modal-search">
                <Search size={18} />
                <input
                  value={locationQuery}
                  onChange={(event) => {
                    setLocationQuery(event.target.value);
                    setServiceabilityResult(null);
                  }}
                  onKeyDown={(event) => event.key === "Enter" && checkAddress()}
                  placeholder="e.g. DHA Phase 5, Lahore"
                />
                <button type="button" onClick={checkAddress}>
                  Check
                </button>
              </div>
            </label>
            {serviceabilityResult && (
              <p className={`serviceability-result ${serviceabilityResult.status}`} role="status">
                {serviceabilityResult.status === "serviceable" ? <Check /> : <MapPin />}
                {serviceabilityResult.message}
              </p>
            )}
            {pilotLocations.map((place) => (
              <button
                className={`saved-location ${place.launchStatus}`}
                type="button"
                key={place.id}
                onClick={() => {
                  if (place.launchStatus === "pilot") {
                    setLocation(place.label);
                    setLocationOpen(false);
                    setServiceabilityResult(null);
                    return;
                  }
                  setServiceabilityResult({
                    status: "coming_soon",
                    city: place.city,
                    message: `${place.city} is coming soon. The controlled launch pilot is in selected Lahore zones.`,
                  });
                }}
              >
                <MapPin />
                <span>
                  <strong>{place.label}</strong>
                  <small>
                    {place.launchStatus === "pilot" ? "Pilot delivery area" : "Coming soon"}
                  </small>
                </span>
                {location === place.label && <Check />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {roleOpen && (
        <Modal
          title="Grow with Onyn"
          onClose={() => {
            setRoleOpen(false);
            setPartnerMessage("");
          }}
        >
          <div className="role-modal">
            <p>
              Choose the workspace you want to join. Each production portal will have its own
              permissions, verification and audit trail.
            </p>
            {roleCards.map(({ icon: Icon, title, detail, action, href }) => (
              <button
                type="button"
                key={title}
                onClick={() => {
                  if (href) {
                    window.location.assign(href);
                    return;
                  }
                  setPartnerMessage(
                    `${title} applications are not open during the controlled restaurant pilot.`,
                  );
                }}
              >
                <span className="role-icon">
                  <Icon />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
                <ArrowRight />
              </button>
            ))}
            {partnerMessage && (
              <p className="partner-status" role="status">
                <Clock3 size={16} /> {partnerMessage}
              </p>
            )}
            <button
              type="button"
              className="admin-link"
              onClick={() =>
                setPartnerMessage(
                  "The operations portal is private and available only to invited staff.",
                )
              }
            >
              <Building2 /> Onyn operations sign-in
            </button>
          </div>
        </Modal>
      )}

      {cancelOrderId && (
        <Modal
          title="Request cancellation"
          onClose={() => {
            setCancelOrderId(null);
            setCancelReason("");
            setCancelState("idle");
          }}
        >
          <div className="cancellation-modal">
            <p>
              Orders still at <strong>Placed</strong> are cancelled immediately. If preparation has
              started, this creates an auditable support review instead.
            </p>
            <label>
              <span>Why do you need to cancel?</span>
              <textarea
                value={cancelReason}
                maxLength={300}
                onChange={(event) => {
                  setCancelReason(event.target.value);
                  if (cancelState === "error") setCancelState("idle");
                }}
                placeholder="For example: I entered the wrong delivery address"
              />
            </label>
            {cancelState === "error" && (
              <p className="checkout-blocker" role="alert">
                Enter at least five characters so the restaurant and support team have a reason.
              </p>
            )}
            <button
              type="button"
              className="checkout-button"
              disabled={cancelState === "sending" || cancelReason.trim().length < 5}
              onClick={() => void submitCancellation()}
            >
              {cancelState === "sending" ? "Submitting…" : "Submit cancellation request"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SearchBox({
  query,
  setQuery,
  onFocus,
  autoFocus = false,
}: {
  query: string;
  setQuery: (value: string) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="search-box">
      <Search size={21} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={onFocus}
        autoFocus={autoFocus}
        placeholder="Search biryani, burgers or restaurants"
        aria-label="Search restaurants and food"
      />
      {query && (
        <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
          <X size={17} />
        </button>
      )}
    </label>
  );
}

function RestaurantGrid({
  items,
  favourites,
  fulfilment,
  toggleFavourite,
  openRestaurant,
}: {
  items: Restaurant[];
  favourites: string[];
  fulfilment: "delivery" | "collection";
  toggleFavourite: (id: string) => void;
  openRestaurant: (restaurant: Restaurant) => void;
}) {
  return (
    <div className="restaurant-grid">
      {items.map((restaurant) => (
        <article className="restaurant-card" key={restaurant.id}>
          <button
            className={`restaurant-image ${restaurant.gradient}`}
            type="button"
            onClick={() => openRestaurant(restaurant)}
            aria-label={`Open ${restaurant.name}`}
          >
            <span>{restaurant.emoji}</span>
            {restaurant.promo && <b>{restaurant.promo}</b>}
          </button>
          <button
            className="favourite-button"
            type="button"
            onClick={() => toggleFavourite(restaurant.id)}
            aria-label={`Save ${restaurant.name}`}
          >
            <Heart size={19} fill={favourites.includes(restaurant.id) ? "currentColor" : "none"} />
          </button>
          <button
            className="restaurant-info"
            type="button"
            onClick={() => openRestaurant(restaurant)}
          >
            <span className="restaurant-name">
              <strong>{restaurant.name}</strong>
              <span>
                <Star size={14} fill="currentColor" />{" "}
                {restaurant.isLive ? "New" : restaurant.rating}
              </span>
            </span>
            <small>{restaurant.cuisine}</small>
            <span className="meta-row">
              <span>
                <Clock3 size={14} /> {restaurant.eta}
              </span>
              <span>
                {fulfilment === "delivery" ? <Bike size={15} /> : <Store size={15} />}
                {fulfilment === "delivery" ? money(restaurant.delivery) : "Collection"}
              </span>
              <span>Min. {money(restaurant.min)}</span>
            </span>
          </button>
        </article>
      ))}
    </div>
  );
}

function CustomerOrderCard({ order, onCancel }: { order: CustomerOrder; onCancel: () => void }) {
  const progress = customerOrderProgress(order.status);
  const terminal = ["rejected", "cancelled", "delivery_failed", "refunded"].includes(order.status);
  const statusLabel = order.status.replaceAll("_", " ");
  return (
    <article className="customer-order-card">
      <header>
        <div>
          <span className={`status-pill ${terminal ? "terminal" : ""}`}>
            <span /> {statusLabel}
          </span>
          <h2>{order.branchName}</h2>
          <p>
            #{order.reference} •{" "}
            {new Intl.DateTimeFormat("en-PK", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(order.placedAt))}
          </p>
        </div>
        <strong>{money(order.total)}</strong>
      </header>
      {!terminal && (
        <div className="order-progress" aria-label={`Order progress: ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="customer-order-lines">
        {order.lines.map((line) => (
          <span key={line.id}>
            <small>
              {line.quantity}× {line.name}
            </small>
            <b>{money(line.lineTotal)}</b>
          </span>
        ))}
      </div>
      <footer>
        <span>
          {order.fulfilment === "delivery" ? <Bike size={16} /> : <Store size={16} />}
          {order.fulfilment === "delivery" ? "Delivery" : "Collection"} • Cash
        </span>
        {order.openSupportCaseId ? (
          <small>Cancellation review in progress</small>
        ) : canRequestCancellation(order.status) ? (
          <button type="button" onClick={onCancel}>
            Request cancellation
          </button>
        ) : null}
      </footer>
    </article>
  );
}

function BasketContent({
  cart,
  subtotal,
  deliveryFee,
  fulfilment,
  serviceFee,
  total,
  changeQuantity,
  checkout,
  checkoutLabel = "Go to checkout",
  checkoutDisabled = false,
}: {
  cart: CartLine[];
  subtotal: number;
  deliveryFee: number;
  fulfilment: "delivery" | "collection";
  serviceFee: number;
  total: number;
  changeQuantity: (id: string, amount: number) => void;
  checkout: () => void;
  checkoutLabel?: string;
  checkoutDisabled?: boolean;
}) {
  if (!cart.length)
    return (
      <div className="empty-basket">
        <span>🛍️</span>
        <h3>Your basket is empty</h3>
        <p>Add a dish to get started. Fees will be shown before checkout.</p>
      </div>
    );
  return (
    <div className="basket-content">
      <div className="basket-lines">
        {cart.map((line) => (
          <div className="basket-line" key={line.id}>
            <span className="basket-emoji">{line.emoji}</span>
            <span>
              <strong>{line.name}</strong>
              <small>{money(line.price)}</small>
            </span>
            <div className="quantity-control">
              <button
                type="button"
                onClick={() => changeQuantity(line.id, -1)}
                aria-label={`Remove one ${line.name}`}
              >
                <Minus />
              </button>
              <b>{line.quantity}</b>
              <button
                type="button"
                onClick={() => changeQuantity(line.id, 1)}
                aria-label={`Add one ${line.name}`}
              >
                <Plus />
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="voucher-roadmap">Voucher codes will open after the controlled pilot.</p>
      <div className="price-lines">
        <span>
          <small>Subtotal</small>
          <strong>{money(subtotal)}</strong>
        </span>
        <span>
          <small>{fulfilment === "delivery" ? "Delivery fee" : "Collection fee"}</small>
          <strong>{money(deliveryFee)}</strong>
        </span>
        <span>
          <small>Service fee</small>
          <strong>{money(serviceFee)}</strong>
        </span>
        <span className="total-line">
          <b>Total</b>
          <b>{money(total)}</b>
        </span>
      </div>
      <button
        className="checkout-button"
        type="button"
        onClick={checkout}
        disabled={checkoutDisabled}
      >
        {checkoutLabel} <ArrowRight size={18} />
      </button>
      <p className="fee-note">
        <ShieldCheck size={14} /> No hidden charges are added after confirmation.
      </p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function MobileNavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? "active" : ""} onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
  action,
  onAction,
}: {
  icon: typeof Search;
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon />
      </span>
      <h2>{title}</h2>
      <p>{detail}</p>
      {action && (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function CheckoutCard({
  icon: Icon,
  title,
  action,
  onAction,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="checkout-card">
      <span className="checkout-icon">
        <Icon />
      </span>
      <div>
        <small>{title}</small>
        {children}
      </div>
      {action && (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      )}
    </article>
  );
}
