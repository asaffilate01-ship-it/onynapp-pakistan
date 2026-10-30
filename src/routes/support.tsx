import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Headphones, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LaunchHero, LaunchShell, StatusMessage } from "../components/launch-shell";
import { PilotAuth } from "../components/pilot-auth";
import {
  createCustomerSupportCase,
  getCurrentCustomer,
  isPilotBackendConfigured,
  listCustomerOrders,
  listCustomerSupportCases,
  type SupportCase,
} from "../lib/supabase";
import type { CustomerOrder } from "../lib/customer-workspace";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Customer Support | Dishbee+ Pakistan" }] }),
  component: SupportPage,
});

function SupportPage() {
  const configured = isPilotBackendConfigured();
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [form, setForm] = useState({
    orderId: "",
    category: "order_issue",
    subject: "",
    description: "",
  });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const user = await getCurrentCustomer();
    if (!user) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    setSignedIn(true);
    try {
      const [orderRows, caseRows] = await Promise.all([
        listCustomerOrders(),
        listCustomerSupportCases(),
      ]);
      setOrders(orderRows);
      setCases(caseRows);
    } catch {
      setMessage("Support history could not be loaded.");
    }
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await createCustomerSupportCase({
        orderId: form.orderId || null,
        category: form.category,
        subject: form.subject,
        description: form.description,
      });
      setForm({ orderId: "", category: "order_issue", subject: "", description: "" });
      setMessage("Your support request has been submitted with an audit trail.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request could not be submitted.");
    }
  }

  return (
    <LaunchShell>
      <LaunchHero
        eyebrow="CUSTOMER SUPPORT"
        title="Help linked to the right account and order."
        description="Support requests are protected, timestamped and visible only to you and authorised staff."
      />
      <section className="support-priority-strip">
        <AlertTriangle />
        <div>
          <strong>Immediate danger or medical emergency?</strong>
          <span>
            Contact the appropriate Pakistan emergency service first. Dishbee+ support is not an
            emergency service.
          </span>
        </div>
        <a href="/safety">Safety guidance</a>
      </section>
      {!configured && (
        <div className="launch-narrow">
          <StatusMessage>
            Support submission activates only when the deployment backend is configured. Legal and
            safety guidance remains available.
          </StatusMessage>
        </div>
      )}
      {loading && <div className="launch-loading">Checking your secure account…</div>}
      {configured && !loading && !signedIn && (
        <div className="launch-narrow">
          <PilotAuth title="Sign in before contacting support" onVerified={load} />
        </div>
      )}
      {signedIn && (
        <div className="support-layout">
          <form className="launch-form" onSubmit={submit}>
            <header>
              <Headphones />
              <div>
                <h2>New support request</h2>
                <p>Give the operations team enough information to act safely.</p>
              </div>
            </header>
            <label>
              <span>Related order (optional)</span>
              <select
                value={form.orderId}
                onChange={(event) => setForm({ ...form, orderId: event.target.value })}
              >
                <option value="">General or account request</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.reference} · {order.branchName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Category</span>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                <option value="order_issue">Order issue</option>
                <option value="delivery_issue">Delivery issue</option>
                <option value="account_issue">Account issue</option>
                <option value="safety_issue">Safety issue</option>
                <option value="payment_issue">COD/payment issue</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              <span>Subject</span>
              <input
                required
                minLength={3}
                maxLength={160}
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="Short description of the problem"
              />
            </label>
            <label>
              <span>What happened?</span>
              <textarea
                required
                minLength={5}
                maxLength={1000}
                rows={6}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Include what you expected, what happened and any safe evidence available."
              />
            </label>
            <button type="submit">
              <Send /> Submit protected request
            </button>
            {message && (
              <StatusMessage tone={message.includes("submitted") ? "success" : "error"}>
                {message}
              </StatusMessage>
            )}
          </form>
          <section className="case-history">
            <header>
              <CheckCircle2 />
              <div>
                <h2>Your requests</h2>
                <p>Status and approved resolution notes.</p>
              </div>
            </header>
            {cases.length ? (
              cases.map((item) => (
                <article key={item.id}>
                  <div>
                    <span className={`case-status ${item.status}`}>
                      {item.status.replace("_", " ")}
                    </span>
                    <small>
                      {new Date(item.created_at).toLocaleString("en-PK", {
                        timeZone: "Asia/Karachi",
                      })}
                    </small>
                  </div>
                  <h3>{item.subject}</h3>
                  <p>{item.description}</p>
                  {item.resolution_note && <blockquote>{item.resolution_note}</blockquote>}
                </article>
              ))
            ) : (
              <p className="empty-copy">No support requests yet.</p>
            )}
          </section>
        </div>
      )}
    </LaunchShell>
  );
}
