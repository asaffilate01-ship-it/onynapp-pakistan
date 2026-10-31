import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  ClipboardList,
  LogOut,
  MapPin,
  RefreshCw,
  Save,
  Star,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "../components/portfolio-ui";
import { LaunchHero, LaunchShell, StatusMessage } from "../components/launch-shell";
import { PilotAuth } from "../components/pilot-auth";
import {
  getCurrentCustomer,
  getCustomerProfileSnapshot,
  isPilotBackendConfigured,
  listCustomerNotifications,
  listCustomerOrders,
  listCustomerReviews,
  repeatCustomerCodOrder,
  saveCustomerPilotAddress,
  signOutCustomer,
  submitCustomerReview,
  updateCustomerProfile,
  type CustomerNotification,
  type CustomerProfileSnapshot,
  type CustomerReview,
} from "../lib/supabase";
import type { CustomerOrder } from "../lib/customer-workspace";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My Account | Dishbee+ Pakistan" }] }),
  component: AccountPage,
});

function AccountPage() {
  const configured = isPilotBackendConfigured();
  const [state, setState] = useState<"loading" | "signed_out" | "ready" | "error">(
    configured ? "loading" : "signed_out",
  );
  const [profile, setProfile] = useState<CustomerProfileSnapshot | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"profile" | "address" | null>(null);
  const mutationLock = useRef(false);
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { rating: number; comment: string }>
  >({});
  const [address, setAddress] = useState({
    label: "Gulberg III, Lahore",
    addressLine: "",
    landmark: "",
    deliveryNote: "",
  });

  const loadAccount = useCallback(async () => {
    if (!configured) {
      setState("signed_out");
      return;
    }
    const user = await getCurrentCustomer();
    if (!user) {
      setState("signed_out");
      return;
    }
    try {
      const [profileData, orderData, notificationData, reviewData] = await Promise.all([
        getCustomerProfileSnapshot(),
        listCustomerOrders(),
        listCustomerNotifications(),
        listCustomerReviews(),
      ]);
      setProfile(profileData);
      setDisplayName(profileData.profile?.display_name ?? "");
      setOrders(orderData);
      setNotifications(notificationData);
      setReviews(reviewData);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [configured]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function saveProfile() {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusyAction("profile");
    setMessage("");
    try {
      await updateCustomerProfile(displayName);
      setMessage("Your account name has been saved.");
      await loadAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account could not be saved.");
    } finally {
      mutationLock.current = false;
      setBusyAction(null);
    }
  }

  async function addAddress() {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusyAction("address");
    setMessage("");
    try {
      await saveCustomerPilotAddress({
        label: address.label,
        city: "Lahore",
        addressLine: address.addressLine,
        landmark: address.landmark,
        deliveryNote: address.deliveryNote,
      });
      setAddress((current) => ({ ...current, addressLine: "", landmark: "", deliveryNote: "" }));
      setMessage("Verified Lahore address added.");
      await loadAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Address could not be saved.");
    } finally {
      mutationLock.current = false;
      setBusyAction(null);
    }
  }

  async function logout() {
    await signOutCustomer();
    setProfile(null);
    setOrders([]);
    setNotifications([]);
    setReviews([]);
    setState("signed_out");
  }

  async function repeatOrder(orderId: string) {
    setBusyOrderId(orderId);
    try {
      const repeated = await repeatCustomerCodOrder(orderId);
      setMessage(`Order ${repeated.reference} was placed using current prices and availability.`);
      await loadAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The order could not be repeated.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function saveReview(orderId: string) {
    const draft = reviewDrafts[orderId] ?? { rating: 5, comment: "" };
    setBusyOrderId(orderId);
    try {
      await submitCustomerReview({ orderId, rating: draft.rating, comment: draft.comment });
      setMessage(
        draft.comment.trim()
          ? "Rating saved. Your written review is waiting for moderation."
          : "Restaurant rating saved.",
      );
      await loadAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The review could not be saved.");
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <LaunchShell>
      <LaunchHero
        eyebrow="CUSTOMER ACCOUNT"
        title="Your orders, addresses and updates."
        description="One protected place for the controlled Lahore food pilot."
      />
      {!configured && (
        <div className="launch-narrow">
          <StatusMessage>
            Account features are correctly disabled until the deployment has its public Supabase URL
            and publishable key.
          </StatusMessage>
        </div>
      )}
      {state === "loading" && <div className="launch-loading">Loading your protected account…</div>}
      {state === "error" && (
        <div className="launch-narrow">
          <StatusMessage tone="error">
            Your account could not be loaded. Try again without placing another order.
          </StatusMessage>
        </div>
      )}
      {state === "signed_out" && configured && (
        <div className="launch-narrow">
          <PilotAuth title="Sign in to your Dishbee+ account" onVerified={loadAccount} />
        </div>
      )}
      {state === "ready" && profile && (
        <div className="account-layout">
          <aside className="account-summary">
            <span>
              <UserRound />
            </span>
            <h2>{profile.profile?.display_name || "Dishbee+ customer"}</h2>
            <p>{profile.profile?.phone_e164}</p>
            <div>
              <b>{orders.length}</b>
              <small>Orders</small>
            </div>
            <div>
              <b>{profile.addresses.length}</b>
              <small>Addresses</small>
            </div>
            <button type="button" onClick={logout}>
              <LogOut /> Sign out
            </button>
          </aside>
          <div className="account-panels">
            {message && (
              <StatusMessage tone={message.includes("could not") ? "error" : "success"}>
                {message}
              </StatusMessage>
            )}
            <section className="account-panel">
              <header>
                <UserRound />
                <div>
                  <h2>Personal details</h2>
                  <p>Used on orders and support requests.</p>
                </div>
              </header>
              <label>
                <span>Display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={100}
                />
              </label>
              <ActionButton
                type="button"
                onClick={() => void saveProfile()}
                pending={busyAction === "profile"}
                pendingLabel="Saving details…"
                disabled={busyAction !== null}
              >
                <Save aria-hidden="true" /> Save details
              </ActionButton>
            </section>
            <section className="account-panel">
              <header>
                <MapPin />
                <div>
                  <h2>Saved delivery addresses</h2>
                  <p>Only verified pilot areas can be saved.</p>
                </div>
              </header>
              <div className="saved-address-list">
                {profile.addresses.map((item) => (
                  <article key={item.id}>
                    <strong>{item.label}</strong>
                    <span>{item.address_line}</span>
                    <small>
                      {item.landmark}
                      {item.delivery_note ? ` · ${item.delivery_note}` : ""}
                    </small>
                  </article>
                ))}
              </div>
              <div className="address-form-grid">
                <label>
                  <span>Pilot area</span>
                  <select
                    value={address.label}
                    onChange={(event) => setAddress({ ...address, label: event.target.value })}
                  >
                    <option>Gulberg III, Lahore</option>
                    <option>DHA Phase 5, Lahore</option>
                  </select>
                </label>
                <label>
                  <span>Address</span>
                  <input
                    value={address.addressLine}
                    onChange={(event) =>
                      setAddress({ ...address, addressLine: event.target.value })
                    }
                    placeholder="House and street"
                  />
                </label>
                <label>
                  <span>Landmark</span>
                  <input
                    value={address.landmark}
                    onChange={(event) => setAddress({ ...address, landmark: event.target.value })}
                    placeholder="Nearby landmark"
                  />
                </label>
                <label>
                  <span>Delivery note</span>
                  <input
                    value={address.deliveryNote}
                    onChange={(event) =>
                      setAddress({ ...address, deliveryNote: event.target.value })
                    }
                    placeholder="Optional handover instruction"
                  />
                </label>
              </div>
              <ActionButton
                type="button"
                onClick={() => void addAddress()}
                pending={busyAction === "address"}
                pendingLabel="Verifying address…"
                disabled={busyAction !== null || !address.addressLine.trim()}
              >
                <MapPin aria-hidden="true" /> Verify and add address
              </ActionButton>
            </section>
            <section className="account-panel">
              <header>
                <ClipboardList />
                <div>
                  <h2>Recent orders</h2>
                  <p>Server totals and status history.</p>
                </div>
              </header>
              <div className="account-order-list">
                {orders.length ? (
                  orders.map((order) => {
                    const existingReview = reviews.find((review) => review.order_id === order.id);
                    const draft = reviewDrafts[order.id] ?? {
                      rating: existingReview?.rating ?? 5,
                      comment: existingReview?.comment ?? "",
                    };
                    const completed = ["delivered", "collected"].includes(order.status);
                    const repeatable = [
                      "delivered",
                      "collected",
                      "cancelled",
                      "rejected",
                      "delivery_failed",
                    ].includes(order.status);
                    return (
                      <article key={order.id} className="account-order-card">
                        <span>
                          <strong>{order.reference}</strong>
                          <small>{order.branchName}</small>
                        </span>
                        <b>{order.status.replaceAll("_", " ")}</b>
                        <span>Rs. {order.total.toLocaleString("en-PK")}</span>
                        {(repeatable || completed) && (
                          <div className="account-order-actions">
                            {repeatable && (
                              <button
                                type="button"
                                disabled={busyOrderId === order.id}
                                onClick={() => void repeatOrder(order.id)}
                              >
                                <RefreshCw /> Repeat with current prices
                              </button>
                            )}
                            {completed && (
                              <div className="account-review-editor">
                                <span>Rate this order</span>
                                <div className="review-stars" aria-label="Order rating">
                                  {[1, 2, 3, 4, 5].map((rating) => (
                                    <button
                                      type="button"
                                      key={rating}
                                      aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                                      className={rating <= draft.rating ? "active" : ""}
                                      onClick={() =>
                                        setReviewDrafts({
                                          ...reviewDrafts,
                                          [order.id]: { ...draft, rating },
                                        })
                                      }
                                    >
                                      <Star />
                                    </button>
                                  ))}
                                </div>
                                <textarea
                                  rows={2}
                                  maxLength={500}
                                  value={draft.comment}
                                  onChange={(event) =>
                                    setReviewDrafts({
                                      ...reviewDrafts,
                                      [order.id]: { ...draft, comment: event.target.value },
                                    })
                                  }
                                  placeholder="Optional review (moderated before publication)"
                                />
                                <button
                                  type="button"
                                  disabled={busyOrderId === order.id}
                                  onClick={() => void saveReview(order.id)}
                                >
                                  <Star /> {existingReview ? "Update rating" : "Save rating"}
                                </button>
                                {existingReview && (
                                  <small>Review status: {existingReview.moderation_status}</small>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <p>No live orders yet. Your first server-confirmed order will appear here.</p>
                )}
              </div>
            </section>
            <section className="account-panel">
              <header>
                <Bell />
                <div>
                  <h2>Notifications</h2>
                  <p>Order updates visible only to your account.</p>
                </div>
              </header>
              <div className="account-notification-list">
                {notifications.length ? (
                  notifications.slice(0, 10).map((item) => (
                    <article key={item.id} className={item.read_at ? "" : "unread"}>
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                      <small>
                        {new Date(item.created_at).toLocaleString("en-PK", {
                          timeZone: "Asia/Karachi",
                        })}
                      </small>
                    </article>
                  ))
                ) : (
                  <p>No notifications yet.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </LaunchShell>
  );
}
