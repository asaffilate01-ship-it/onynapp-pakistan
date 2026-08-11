import { createFileRoute } from "@tanstack/react-router";
import { Bike, Building2, Headphones, RefreshCw, Send, ShieldAlert, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LaunchHero, LaunchShell, StatusMessage } from "../components/launch-shell";
import { PilotAuth } from "../components/pilot-auth";
import {
  assignOpsDelivery,
  getCurrentCustomer,
  getOpsLaunchSnapshot,
  isPilotBackendConfigured,
  reviewOpsApplication,
  updateOpsSupportCase,
  type OpsLaunchSnapshot,
} from "../lib/supabase";

export const Route = createFileRoute("/ops")({
  head: () => ({
    meta: [
      { title: "Launch Operations | Onyn Pakistan" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OpsPage,
});

const value = (row: Record<string, unknown>, key: string) => String(row[key] ?? "");

function OpsPage() {
  const configured = isPilotBackendConfigured();
  const [state, setState] = useState<"loading" | "signed_out" | "denied" | "ready">(
    configured ? "loading" : "denied",
  );
  const [snapshot, setSnapshot] = useState<OpsLaunchSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [riderSelections, setRiderSelections] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!configured) {
      setState("denied");
      return;
    }
    const user = await getCurrentCustomer();
    if (!user) {
      setState("signed_out");
      return;
    }
    try {
      setSnapshot(await getOpsLaunchSnapshot());
      setState("ready");
    } catch {
      setState("denied");
    }
  }, [configured]);
  useEffect(() => {
    void load();
  }, [load]);

  const approvedRiders = useMemo(
    () => snapshot?.rider_applications.filter((row) => value(row, "status") === "approved") ?? [],
    [snapshot],
  );

  async function review(kind: "partner" | "rider", id: string, status: string) {
    try {
      await reviewOpsApplication({ kind, applicationId: id, status, note: reviewNote });
      setMessage(`Application moved to ${status.replace("_", " ")}.`);
      setReviewNote("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review could not be saved.");
    }
  }
  async function resolveCase(id: string, status: "in_review" | "resolved") {
    try {
      await updateOpsSupportCase({ caseId: id, status, resolutionNote: resolution });
      setMessage(`Support case moved to ${status.replace("_", " ")}.`);
      setResolution("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Case could not be saved.");
    }
  }
  async function assign(orderId: string) {
    const riderId = riderSelections[orderId];
    if (!riderId) {
      setMessage("Select an approved rider first.");
      return;
    }
    try {
      await assignOpsDelivery(orderId, riderId);
      setMessage("Delivery offered to the selected rider.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delivery could not be assigned.");
    }
  }

  return (
    <LaunchShell>
      <LaunchHero
        eyebrow="PRIVATE OPERATIONS"
        title="Controlled pilot command centre."
        description="Support, partner review and manual dispatch are authorised separately from restaurant workspaces."
      />
      {!configured && (
        <div className="launch-narrow">
          <StatusMessage tone="error">
            Operations is unavailable until the deployment backend is configured.
          </StatusMessage>
        </div>
      )}
      {state === "loading" && <div className="launch-loading">Verifying platform role…</div>}
      {state === "signed_out" && (
        <div className="launch-narrow">
          <PilotAuth title="Platform staff sign in" onVerified={load} />
        </div>
      )}
      {state === "denied" && configured && (
        <div className="launch-narrow">
          <section className="access-denied-card">
            <ShieldAlert />
            <h2>Platform access required</h2>
            <p>
              This route does not accept restaurant memberships. A service-role administrator must
              explicitly add an approved support, operations or admin identity.
            </p>
            <a href="/">Return to marketplace</a>
          </section>
        </div>
      )}
      {state === "ready" && snapshot && (
        <div className="ops-workspace">
          <header className="ops-summary">
            <div>
              <small>AUTHORISED ROLE</small>
              <strong>{snapshot.staff_role}</strong>
            </div>
            <div>
              <small>OPEN SUPPORT</small>
              <strong>{snapshot.support_cases.length}</strong>
            </div>
            <div>
              <small>READY TO DISPATCH</small>
              <strong>{snapshot.ready_delivery_orders.length}</strong>
            </div>
            <div>
              <small>ACTIVE DELIVERIES</small>
              <strong>{snapshot.delivery_jobs.length}</strong>
            </div>
            <button type="button" onClick={load}>
              <RefreshCw /> Refresh
            </button>
          </header>
          {message && (
            <StatusMessage
              tone={
                message.includes("could not") || message.includes("Select") ? "error" : "success"
              }
            >
              {message}
            </StatusMessage>
          )}
          <label className="ops-note">
            <span>Review/resolution note</span>
            <textarea
              rows={3}
              value={reviewNote || resolution}
              onChange={(event) => {
                setReviewNote(event.target.value);
                setResolution(event.target.value);
              }}
              placeholder="Required for a defensible rejection or resolution."
            />
          </label>
          {snapshot.staff_role !== "support" && (
            <section className="ops-section">
              <div className="workspace-section-header">
                <div>
                  <span className="section-kicker">ONBOARDING</span>
                  <h2>Partner applications</h2>
                </div>
                <Building2 />
              </div>
              <div className="ops-list">
                {snapshot.partner_applications.length ? (
                  snapshot.partner_applications.map((row) => (
                    <article key={value(row, "id")}>
                      <span>
                        <strong>{value(row, "trading_name")}</strong>
                        <small>
                          {value(row, "application_type").replace("_", " ")} · {value(row, "city")}{" "}
                          · {value(row, "area")}
                        </small>
                        <em>
                          {value(row, "contact_name")} · {value(row, "phone_e164")}
                        </em>
                      </span>
                      <b className={`case-status ${value(row, "status")}`}>
                        {value(row, "status").replace("_", " ")}
                      </b>
                      <div>
                        <button
                          type="button"
                          onClick={() => void review("partner", value(row, "id"), "in_review")}
                        >
                          Start review
                        </button>
                        <button
                          type="button"
                          onClick={() => void review("partner", value(row, "id"), "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="danger"
                          type="button"
                          onClick={() => void review("partner", value(row, "id"), "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No partner applications waiting.</p>
                )}
              </div>
            </section>
          )}
          {snapshot.staff_role !== "support" && (
            <section className="ops-section">
              <div className="workspace-section-header">
                <div>
                  <span className="section-kicker">RIDER SCREENING</span>
                  <h2>Rider applications</h2>
                </div>
                <Users />
              </div>
              <div className="ops-list">
                {snapshot.rider_applications.length ? (
                  snapshot.rider_applications.map((row) => (
                    <article key={value(row, "id")}>
                      <span>
                        <strong>{value(row, "full_name")}</strong>
                        <small>
                          {value(row, "vehicle_type")} · {value(row, "area")}
                        </small>
                        <em>
                          Licence declared:{" "}
                          {value(row, "has_valid_licence") === "true" ? "yes" : "no"}
                        </em>
                      </span>
                      <b className={`case-status ${value(row, "status")}`}>
                        {value(row, "status")}
                      </b>
                      <div>
                        <button
                          type="button"
                          onClick={() => void review("rider", value(row, "id"), "screening")}
                        >
                          Screen
                        </button>
                        <button
                          type="button"
                          onClick={() => void review("rider", value(row, "id"), "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="danger"
                          type="button"
                          onClick={() => void review("rider", value(row, "id"), "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No rider applications waiting.</p>
                )}
              </div>
            </section>
          )}
          <section className="ops-section">
            <div className="workspace-section-header">
              <div>
                <span className="section-kicker">SUPPORT QUEUE</span>
                <h2>Customer cases</h2>
              </div>
              <Headphones />
            </div>
            <div className="ops-list">
              {snapshot.support_cases.length ? (
                snapshot.support_cases.map((row) => (
                  <article key={value(row, "id")}>
                    <span>
                      <strong>{value(row, "subject")}</strong>
                      <small>
                        {value(row, "priority") === "urgent" ? "URGENT · " : ""}
                        {value(row, "category").replace("_", " ")} ·{" "}
                        {value(row, "order_id") || "No order"}
                      </small>
                      <em>{value(row, "description")}</em>
                    </span>
                    <b className={`case-status ${value(row, "status")}`}>
                      {value(row, "status").replace("_", " ")}
                    </b>
                    <div>
                      <button
                        type="button"
                        onClick={() => void resolveCase(value(row, "id"), "in_review")}
                      >
                        Take case
                      </button>
                      <button
                        type="button"
                        onClick={() => void resolveCase(value(row, "id"), "resolved")}
                      >
                        Resolve with note
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-copy">No open support cases.</p>
              )}
            </div>
          </section>
          {snapshot.staff_role !== "support" && (
            <section className="ops-section">
              <div className="workspace-section-header">
                <div>
                  <span className="section-kicker">MANUAL DISPATCH</span>
                  <h2>Orders ready for a rider</h2>
                </div>
                <Bike />
              </div>
              <div className="ops-list">
                {snapshot.ready_delivery_orders.length ? (
                  snapshot.ready_delivery_orders.map((row) => (
                    <article key={value(row, "id")}>
                      <span>
                        <strong>{value(row, "reference")}</strong>
                        <small>
                          {value(row, "restaurant")} · Rs.{" "}
                          {(Number(row.total_paisa ?? 0) / 100).toLocaleString("en-PK")}
                        </small>
                      </span>
                      <select
                        value={riderSelections[value(row, "id")] ?? ""}
                        onChange={(event) =>
                          setRiderSelections({
                            ...riderSelections,
                            [value(row, "id")]: event.target.value,
                          })
                        }
                      >
                        <option value="">Select approved rider</option>
                        {approvedRiders.map((rider) => (
                          <option
                            key={value(rider, "applicant_id")}
                            value={value(rider, "applicant_id")}
                          >
                            {value(rider, "full_name")} · {value(rider, "area")}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => void assign(value(row, "id"))}>
                        <Send /> Offer delivery
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No ready delivery orders waiting.</p>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </LaunchShell>
  );
}
