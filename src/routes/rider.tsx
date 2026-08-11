import { createFileRoute } from "@tanstack/react-router";
import {
  Bike,
  CheckCircle2,
  MapPin,
  Navigation,
  Send,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LaunchHero, LaunchShell, StatusMessage } from "../components/launch-shell";
import { PilotAuth } from "../components/pilot-auth";
import { nextRiderActions } from "../lib/launch";
import { normalizePakistanPhone } from "../lib/pilot";
import {
  getCurrentCustomer,
  getRiderWorkspaceSnapshot,
  isPilotBackendConfigured,
  submitRiderApplication,
  transitionRiderJob,
  type RiderWorkspaceSnapshot,
} from "../lib/supabase";

export const Route = createFileRoute("/rider")({
  head: () => ({ meta: [{ title: "Ride with Onyn Pakistan" }] }),
  component: RiderPage,
});

function RiderPage() {
  const configured = isPilotBackendConfigured();
  const [signedIn, setSignedIn] = useState(false);
  const [workspace, setWorkspace] = useState<RiderWorkspaceSnapshot | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    area: "",
    vehicleType: "motorbike",
    hasValidLicence: false,
  });
  const [proof, setProof] = useState("");
  const [cash, setCash] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!configured) return;
    const user = await getCurrentCustomer();
    setSignedIn(Boolean(user));
    if (user) {
      try {
        setWorkspace(await getRiderWorkspaceSnapshot());
      } catch {
        setMessage("Rider workspace could not be loaded.");
      }
    }
  }, [configured]);
  useEffect(() => {
    void load();
  }, [load]);

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    const phone = normalizePakistanPhone(form.phone);
    if (!phone) {
      setMessage("Enter a valid Pakistan mobile number.");
      return;
    }
    if (form.fullName.trim().length < 2 || form.area.trim().length < 2) {
      setMessage("Enter your name and Lahore operating area.");
      return;
    }
    try {
      await submitRiderApplication({
        fullName: form.fullName,
        phoneE164: phone,
        area: form.area,
        vehicleType: form.vehicleType,
        hasValidLicence: form.hasValidLicence,
      });
      setMessage("Rider application submitted for screening.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Application could not be submitted.");
    }
  }

  async function transition(jobId: string, expected: string, next: string) {
    try {
      await transitionRiderJob({
        jobId,
        expected,
        next,
        proofNote: proof || undefined,
        cashCollectedPaisa: next === "delivered" ? Math.round(Number(cash) * 100) : null,
      });
      setMessage(`Delivery moved to ${next.replace("_", " ")}.`);
      setProof("");
      setCash("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delivery could not be updated.");
    }
  }

  return (
    <LaunchShell>
      <LaunchHero
        eyebrow="RIDE WITH ONYN"
        title="Clear jobs, safer handovers and accountable COD."
        description="The controlled Lahore rider workflow separates screening, assignment, pickup, delivery proof and cash reconciliation."
      />
      <section className="rider-benefit-grid">
        <article>
          <Navigation />
          <h2>Manual pilot dispatch</h2>
          <p>
            Operations assigns approved riders; there is no hidden race for jobs during the pilot.
          </p>
        </article>
        <article>
          <WalletCards />
          <h2>Exact COD amount</h2>
          <p>The assigned order total is shown and must reconcile before delivery completion.</p>
        </article>
        <article>
          <ShieldCheck />
          <h2>Controlled access</h2>
          <p>Delivery address appears only on jobs assigned to the authenticated rider.</p>
        </article>
      </section>
      {!configured ? (
        <div className="launch-narrow">
          <StatusMessage>
            Rider applications and jobs activate when the deployment backend is configured.
          </StatusMessage>
        </div>
      ) : !signedIn ? (
        <div className="launch-narrow">
          <PilotAuth title="Rider mobile sign in" onVerified={load} />
        </div>
      ) : (
        <section className="rider-workspace">
          {message && (
            <StatusMessage
              tone={
                message.includes("submitted") || message.includes("moved") ? "success" : "error"
              }
            >
              {message}
            </StatusMessage>
          )}
          {!workspace?.application ? (
            <form className="launch-form" onSubmit={apply}>
              <header>
                <Bike />
                <div>
                  <h2>Lahore rider application</h2>
                  <p>
                    Do not upload CNIC or licence images here. Approved secure evidence collection
                    happens during screening.
                  </p>
                </div>
              </header>
              <div className="two-column-fields">
                <label>
                  <span>Full name</span>
                  <input
                    required
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  />
                </label>
                <label>
                  <span>Pakistan mobile</span>
                  <input
                    required
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="0300 1234567"
                  />
                </label>
                <label>
                  <span>Lahore operating area</span>
                  <input
                    required
                    value={form.area}
                    onChange={(event) => setForm({ ...form, area: event.target.value })}
                  />
                </label>
                <label>
                  <span>Vehicle</span>
                  <select
                    value={form.vehicleType}
                    onChange={(event) => setForm({ ...form, vehicleType: event.target.value })}
                  >
                    <option value="motorbike">Motorbike</option>
                    <option value="bicycle">Bicycle</option>
                  </select>
                </label>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={form.hasValidLicence}
                  onChange={(event) => setForm({ ...form, hasValidLicence: event.target.checked })}
                />
                <span>
                  I confirm I hold the licence required for my chosen vehicle. Onyn will verify this
                  before approval.
                </span>
              </label>
              <button type="submit">
                <Send /> Submit for screening
              </button>
            </form>
          ) : (
            <>
              <section className="rider-status-card">
                <span>
                  <CheckCircle2 />
                </span>
                <div>
                  <small>APPLICATION STATUS</small>
                  <h2>{workspace.application.status.replace("_", " ")}</h2>
                  <p>
                    {workspace.application.full_name} · {workspace.application.vehicle_type} ·{" "}
                    {workspace.application.area}
                  </p>
                  {workspace.application.review_note && (
                    <blockquote>{workspace.application.review_note}</blockquote>
                  )}
                </div>
              </section>
              {workspace.application.status === "approved" && (
                <section className="rider-jobs">
                  <div className="section-heading launch-heading">
                    <div>
                      <span className="kicker">ASSIGNED JOBS</span>
                      <h2>Your delivery queue</h2>
                    </div>
                  </div>
                  {workspace.jobs.length ? (
                    workspace.jobs.map((job) => (
                      <article key={job.id}>
                        <header>
                          <span>
                            <strong>{job.reference}</strong>
                            <small>{job.restaurant}</small>
                          </span>
                          <b className={`case-status ${job.status}`}>
                            {job.status.replace("_", " ")}
                          </b>
                        </header>
                        <div className="rider-route">
                          <span>
                            <Store />
                            <small>Pickup</small>
                            <strong>{job.pickup_address}</strong>
                          </span>
                          <i />
                          <span>
                            <MapPin />
                            <small>Deliver</small>
                            <strong>{job.delivery_address}</strong>
                            <em>{job.landmark}</em>
                          </span>
                        </div>
                        <div className="rider-cod">
                          <WalletCards />
                          <span>
                            <small>Collect exact COD</small>
                            <strong>
                              Rs. {(job.cash_to_collect_paisa / 100).toLocaleString("en-PK")}
                            </strong>
                          </span>
                        </div>
                        {job.status === "picked_up" && (
                          <div className="delivery-proof-fields">
                            <label>
                              <span>Handover proof or problem note</span>
                              <textarea
                                value={proof}
                                onChange={(event) => setProof(event.target.value)}
                                rows={3}
                              />
                            </label>
                            <label>
                              <span>Cash collected (Rs.)</span>
                              <input
                                value={cash}
                                onChange={(event) => setCash(event.target.value)}
                                inputMode="decimal"
                                placeholder={(job.cash_to_collect_paisa / 100).toString()}
                              />
                            </label>
                          </div>
                        )}
                        <div className="rider-job-actions">
                          {nextRiderActions(job.status).map((action) => (
                            <button
                              type="button"
                              key={action.next}
                              className={action.next === "failed" ? "danger" : ""}
                              onClick={() => void transition(job.id, job.status, action.next)}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="empty-copy">
                      No delivery is currently assigned. Stay available only during your agreed
                      pilot shift.
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </section>
      )}
    </LaunchShell>
  );
}
