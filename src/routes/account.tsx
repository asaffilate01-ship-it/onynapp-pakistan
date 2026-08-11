import { createFileRoute } from "@tanstack/react-router";
import { Bell, ClipboardList, LogOut, MapPin, Save, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LaunchHero, LaunchShell, StatusMessage } from "../components/launch-shell";
import { PilotAuth } from "../components/pilot-auth";
import {
  getCurrentCustomer,
  getCustomerProfileSnapshot,
  isPilotBackendConfigured,
  listCustomerNotifications,
  listCustomerOrders,
  saveCustomerPilotAddress,
  signOutCustomer,
  updateCustomerProfile,
  type CustomerNotification,
  type CustomerProfileSnapshot,
} from "../lib/supabase";
import type { CustomerOrder } from "../lib/customer-workspace";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My Account | Onyn Pakistan" }] }),
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
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
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
      const [profileData, orderData, notificationData] = await Promise.all([
        getCustomerProfileSnapshot(),
        listCustomerOrders(),
        listCustomerNotifications(),
      ]);
      setProfile(profileData);
      setDisplayName(profileData.profile?.display_name ?? "");
      setOrders(orderData);
      setNotifications(notificationData);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [configured]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function saveProfile() {
    try {
      await updateCustomerProfile(displayName);
      setMessage("Your account name has been saved.");
      await loadAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account could not be saved.");
    }
  }

  async function addAddress() {
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
    }
  }

  async function logout() {
    await signOutCustomer();
    setProfile(null);
    setOrders([]);
    setNotifications([]);
    setState("signed_out");
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
          <PilotAuth title="Sign in to your Onyn account" onVerified={loadAccount} />
        </div>
      )}
      {state === "ready" && profile && (
        <div className="account-layout">
          <aside className="account-summary">
            <span>
              <UserRound />
            </span>
            <h2>{profile.profile?.display_name || "Onyn customer"}</h2>
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
              <button type="button" onClick={saveProfile}>
                <Save /> Save details
              </button>
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
              <button type="button" onClick={addAddress}>
                <MapPin /> Verify and add address
              </button>
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
                  orders.map((order) => (
                    <article key={order.id}>
                      <span>
                        <strong>{order.reference}</strong>
                        <small>{order.branchName}</small>
                      </span>
                      <b>{order.status.replaceAll("_", " ")}</b>
                      <span>Rs. {order.total.toLocaleString("en-PK")}</span>
                    </article>
                  ))
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
