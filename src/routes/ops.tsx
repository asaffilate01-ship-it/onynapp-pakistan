import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  BellRing,
  Bike,
  Building2,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  Headphones,
  Navigation,
  RefreshCw,
  Send,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LaunchHero, LaunchShell, StatusMessage } from "../components/launch-shell";
import { PilotAuth } from "../components/pilot-auth";
import {
  assignOpsDelivery,
  getCurrentCustomer,
  getOpsLaunchSnapshot,
  getOpsRiderDocumentUrl,
  isPilotBackendConfigured,
  listOpsRiderPresence,
  reconcileOpsCodJob,
  retryOpsDishbeeOneHandoff,
  reviewOpsRiderDocument,
  reviewOpsApplication,
  updateOpsLaunchCheck,
  updateOpsSupportCase,
  type OpsLaunchSnapshot,
  type OpsRiderPresence,
} from "../lib/supabase";

export const Route = createFileRoute("/ops")({
  head: () => ({
    meta: [
      { title: "Launch Operations | Dishbee+ Pakistan" },
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
  const [riderPresence, setRiderPresence] = useState<OpsRiderPresence[]>([]);
  const [message, setMessage] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [riderSelections, setRiderSelections] = useState<Record<string, string>>({});
  const [codAmounts, setCodAmounts] = useState<Record<string, string>>({});
  const [gateNotes, setGateNotes] = useState<Record<string, string>>({});

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
      try {
        setRiderPresence(await listOpsRiderPresence());
      } catch {
        setRiderPresence([]);
      }
      setState("ready");
    } catch {
      setState("denied");
    }
  }, [configured]);
  useEffect(() => {
    void load();
  }, [load]);

  const approvedRiders = useMemo(
    () =>
      snapshot?.rider_applications.filter(
        (row) =>
          value(row, "status") === "approved" &&
          value(row, "verification_status") === "verified" &&
          riderPresence.some(
            (presence) =>
              presence.rider_id === value(row, "applicant_id") &&
              presence.availability_status === "online",
          ),
      ) ?? [],
    [riderPresence, snapshot],
  );

  const riderPresenceById = useMemo(
    () => new Map(riderPresence.map((presence) => [presence.rider_id, presence])),
    [riderPresence],
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

  async function openEvidence(path: string) {
    try {
      const url = await getOpsRiderDocumentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence could not be opened.");
    }
  }
  async function reviewDocument(id: string, status: "verified" | "rejected") {
    try {
      await reviewOpsRiderDocument({ documentId: id, status, note: reviewNote });
      setMessage(`Rider evidence ${status}.`);
      setReviewNote("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence review could not be saved.");
    }
  }
  async function reconcile(jobId: string, expectedPaisa: number) {
    const entered = Number(codAmounts[jobId] ?? expectedPaisa / 100);
    if (!Number.isFinite(entered) || entered < 0) {
      setMessage("Enter the cash physically counted at handover.");
      return;
    }
    try {
      await reconcileOpsCodJob({
        jobId,
        receivedPaisa: Math.round(entered * 100),
        note: resolution,
      });
      setMessage("COD handover reconciled to the paisa.");
      setResolution("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "COD could not be reconciled.");
    }
  }
  async function updateGate(key: string, status: "blocked" | "in_progress" | "passed") {
    try {
      await updateOpsLaunchCheck({ checkKey: key, status, evidenceNote: gateNotes[key] ?? "" });
      setMessage(`Launch gate moved to ${status.replace("_", " ")}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Launch gate could not be updated.");
    }
  }

  async function retryDishbeeOneHandoff(handoffId: string) {
    try {
      await retryOpsDishbeeOneHandoff(handoffId);
      setMessage("Dishbee One handoff released with its original idempotency key.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Handoff could not be released.");
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
            <a href="/order">Return to marketplace</a>
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
            <div>
              <small>RIDERS ONLINE</small>
              <strong>
                {riderPresence.filter((item) => item.availability_status === "online").length}
              </strong>
            </div>
            <div>
              <small>SMS DEAD LETTER</small>
              <strong>{snapshot.notification_health.dead_letter}</strong>
            </div>
            <div>
              <small>EPOS HANDOFF QUEUE</small>
              <strong>{snapshot.dishbee_one_handoffs.counts.queued}</strong>
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
                        <em>Evidence: {value(row, "verification_status").replaceAll("_", " ")}</em>
                        {value(row, "status") === "approved" && (
                          <em
                            className={`rider-presence ${riderPresenceById.get(value(row, "applicant_id"))?.availability_status ?? "offline"}`}
                          >
                            Dispatch:{" "}
                            {riderPresenceById
                              .get(value(row, "applicant_id"))
                              ?.availability_status.replaceAll("_", " ") ?? "offline"}
                          </em>
                        )}
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
                      <div className="ops-evidence-list">
                        {snapshot.verification_documents
                          .filter(
                            (document) =>
                              value(document, "rider_application_id") === value(row, "id"),
                          )
                          .map((document) => (
                            <span key={value(document, "id")}>
                              <FileCheck2 />
                              <b>{value(document, "document_kind").replaceAll("_", " ")}</b>
                              <small className={`case-status ${value(document, "status")}`}>
                                {value(document, "status")}
                              </small>
                              <button
                                type="button"
                                onClick={() => void openEvidence(value(document, "object_path"))}
                              >
                                <ExternalLink /> View
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void reviewDocument(value(document, "id"), "verified")
                                }
                              >
                                Verify
                              </button>
                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  void reviewDocument(value(document, "id"), "rejected")
                                }
                              >
                                Reject
                              </button>
                            </span>
                          ))}
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
          <section className="ops-section ops-health-section">
            <div className="workspace-section-header">
              <div>
                <span className="section-kicker">DELIVERY HEALTH</span>
                <h2>Notification outbox</h2>
              </div>
              <BellRing />
            </div>
            <div className="ops-health-grid">
              <article>
                <small>QUEUED / RETRYING</small>
                <strong>{snapshot.notification_health.queued}</strong>
              </article>
              <article>
                <small>CLAIMED BY WORKER</small>
                <strong>{snapshot.notification_health.sending}</strong>
              </article>
              <article className={snapshot.notification_health.dead_letter ? "danger" : ""}>
                <small>NEEDS OPERATOR</small>
                <strong>{snapshot.notification_health.dead_letter}</strong>
              </article>
            </div>
          </section>
          <section className="ops-section ops-health-section">
            <div className="workspace-section-header">
              <div>
                <span className="section-kicker">DISHBEE ONE BRIDGE</span>
                <h2>Signed EPOS/KDS handoffs</h2>
              </div>
              <ExternalLink />
            </div>
            <div className="ops-health-grid">
              <article className={snapshot.dishbee_one_handoffs.counts.blocked ? "danger" : ""}>
                <small>MAPPING BLOCKED</small>
                <strong>{snapshot.dishbee_one_handoffs.counts.blocked}</strong>
              </article>
              <article>
                <small>QUEUED / SENDING</small>
                <strong>{snapshot.dishbee_one_handoffs.counts.queued}</strong>
              </article>
              <article>
                <small>ACKNOWLEDGED</small>
                <strong>{snapshot.dishbee_one_handoffs.counts.acknowledged}</strong>
              </article>
              <article className={snapshot.dishbee_one_handoffs.counts.dead_letter ? "danger" : ""}>
                <small>NEEDS OPERATOR</small>
                <strong>{snapshot.dishbee_one_handoffs.counts.dead_letter}</strong>
              </article>
            </div>
            <div className="ops-list dishbee-handoff-list">
              {snapshot.dishbee_one_handoffs.recent.length ? (
                snapshot.dishbee_one_handoffs.recent.map((handoff) => (
                  <article key={handoff.id}>
                    <span>
                      <strong>{handoff.reference}</strong>
                      <small>{handoff.branch_name}</small>
                      <em>
                        Attempt {handoff.attempt_count}
                        {handoff.last_http_status ? ` · HTTP ${handoff.last_http_status}` : ""}
                        {handoff.provider_order_id ? ` · EPOS ${handoff.provider_order_id}` : ""}
                      </em>
                      {handoff.last_error && <em>{handoff.last_error}</em>}
                    </span>
                    <b className={`case-status ${handoff.status}`}>
                      {handoff.status.replaceAll("_", " ")}
                    </b>
                    {snapshot.staff_role !== "support" &&
                      ["blocked", "retrying", "dead_letter", "cancelled"].includes(
                        handoff.status,
                      ) && (
                        <button
                          type="button"
                          onClick={() => void retryDishbeeOneHandoff(handoff.id)}
                        >
                          <RefreshCw /> Rebuild and retry
                        </button>
                      )}
                  </article>
                ))
              ) : (
                <p className="empty-copy">No marketplace orders have entered the bridge.</p>
              )}
            </div>
          </section>
          {snapshot.staff_role !== "support" && (
            <section className="ops-section">
              <div className="workspace-section-header">
                <div>
                  <span className="section-kicker">LIVE DISPATCH</span>
                  <h2>Active delivery manifest</h2>
                </div>
                <Navigation />
              </div>
              <div className="ops-dispatch-board">
                {snapshot.delivery_jobs.length ? (
                  snapshot.delivery_jobs.map((row) => (
                    <article key={value(row, "id")}>
                      <span>
                        <strong>{value(row, "reference")}</strong>
                        <small>{value(row, "restaurant")}</small>
                      </span>
                      <b className={`case-status ${value(row, "status")}`}>
                        {value(row, "status").replaceAll("_", " ")}
                      </b>
                      <span>
                        <small>RIDER</small>
                        <strong>{value(row, "rider_id") || "Awaiting assignment"}</strong>
                      </span>
                    </article>
                  ))
                ) : (
                  <p className="empty-copy">No active deliveries.</p>
                )}
              </div>
            </section>
          )}
          {snapshot.staff_role !== "support" && (
            <section className="ops-section">
              <div className="workspace-section-header">
                <div>
                  <span className="section-kicker">CASH CONTROL</span>
                  <h2>COD handover and reconciliation</h2>
                </div>
                <Banknote />
              </div>
              <div className="ops-list cod-reconciliation-list">
                {snapshot.cod_reconciliation.length ? (
                  snapshot.cod_reconciliation.map((row) => {
                    const jobId = value(row, "id");
                    const expected = Number(row.cash_collected_paisa ?? 0);
                    return (
                      <article key={jobId}>
                        <span>
                          <strong>{value(row, "reference")}</strong>
                          <small>{value(row, "rider_name") || value(row, "rider_id")}</small>
                          <em>Expected: Rs. {(expected / 100).toLocaleString("en-PK")}</em>
                        </span>
                        <label>
                          <span>Cash physically counted (Rs.)</span>
                          <input
                            inputMode="decimal"
                            value={codAmounts[jobId] ?? (expected / 100).toString()}
                            onChange={(event) =>
                              setCodAmounts({ ...codAmounts, [jobId]: event.target.value })
                            }
                          />
                        </label>
                        <button type="button" onClick={() => void reconcile(jobId, expected)}>
                          <Banknote /> Confirm exact handover
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <p className="empty-copy">No rider cash is awaiting handover.</p>
                )}
              </div>
            </section>
          )}
          <section className="ops-section">
            <div className="workspace-section-header">
              <div>
                <span className="section-kicker">RELEASE CONTROL</span>
                <h2>Evidence-backed launch gates</h2>
              </div>
              <ClipboardCheck />
            </div>
            <div className="launch-check-grid">
              {snapshot.launch_checks.map((row) => {
                const key = value(row, "check_key");
                return (
                  <article key={key}>
                    <header>
                      <small>{value(row, "category")}</small>
                      <b className={`case-status ${value(row, "status")}`}>
                        {value(row, "status").replaceAll("_", " ")}
                      </b>
                    </header>
                    <h3>{value(row, "title")}</h3>
                    {value(row, "evidence_note") && <p>{value(row, "evidence_note")}</p>}
                    {snapshot.staff_role !== "support" && (
                      <>
                        <textarea
                          rows={2}
                          value={gateNotes[key] ?? ""}
                          onChange={(event) =>
                            setGateNotes({ ...gateNotes, [key]: event.target.value })
                          }
                          placeholder="Evidence, ticket or test result"
                        />
                        <div>
                          <button type="button" onClick={() => void updateGate(key, "in_progress")}>
                            Start
                          </button>
                          <button type="button" onClick={() => void updateGate(key, "passed")}>
                            Pass with evidence
                          </button>
                          <button
                            className="danger"
                            type="button"
                            onClick={() => void updateGate(key, "blocked")}
                          >
                            Block
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
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
