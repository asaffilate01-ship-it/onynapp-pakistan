import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Bike, ChefHat, PackageCheck, Send, Store, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LaunchCta, LaunchHero, LaunchShell, StatusMessage } from "../components/launch-shell";
import { PilotAuth } from "../components/pilot-auth";
import { normalizePakistanPhone } from "../lib/pilot";
import {
  validatePartnerApplication,
  type PartnerApplicationInput,
  type PartnerApplicationType,
} from "../lib/launch";
import {
  getCurrentCustomer,
  isPilotBackendConfigured,
  listOwnPartnerApplications,
  submitPartnerApplication,
  type PartnerApplication,
} from "../lib/supabase";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Partner with Onyn Pakistan" },
      {
        name: "description",
        content: "Apply as a Pakistan restaurant, home chef, sales agent or supplier.",
      },
    ],
  }),
  component: PartnersPage,
});

const partnerTypes = [
  {
    id: "restaurant",
    icon: Store,
    title: "Restaurant",
    text: "Menu, orders, KDS, hours and transparent operating controls.",
  },
  {
    id: "home_chef",
    icon: ChefHat,
    title: "Home chef",
    text: "A reviewed route for local cooks with appropriate food compliance.",
  },
  {
    id: "sales_agent",
    icon: Users,
    title: "Sales partner",
    text: "Bring verified local businesses through auditable attribution.",
  },
  {
    id: "supplier",
    icon: PackageCheck,
    title: "Supplier",
    text: "Register interest for the later restaurant procurement phase.",
  },
] as const;

function PartnersPage() {
  const configured = isPilotBackendConfigured();
  const [signedIn, setSignedIn] = useState(false);
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [form, setForm] = useState<PartnerApplicationInput>({
    applicationType: "restaurant",
    tradingName: "",
    city: "Lahore",
    area: "",
    contactName: "",
    phone: "",
    email: "",
    details: "",
  });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!configured) return;
    const user = await getCurrentCustomer();
    setSignedIn(Boolean(user));
    if (user) {
      try {
        setApplications(await listOwnPartnerApplications());
      } catch {
        setMessage("Application history could not be loaded.");
      }
    }
  }, [configured]);
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validatePartnerApplication(form);
    if (validation) {
      setMessage(validation);
      return;
    }
    const phone = normalizePakistanPhone(form.phone);
    if (!phone) return;
    try {
      await submitPartnerApplication({
        applicationType: form.applicationType,
        tradingName: form.tradingName,
        city: form.city,
        area: form.area,
        contactName: form.contactName,
        phoneE164: phone,
        email: form.email,
        details: form.details,
      });
      setMessage("Application submitted. Onyn operations must review it before activation.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Application could not be submitted.");
    }
  }

  return (
    <LaunchShell>
      <LaunchHero
        eyebrow="PARTNER WITH ONYN"
        title="Grow without losing a large cut of every order."
        description="A Pakistan-first partner model with predictable subscription pricing, clear delivery/payment charges and restaurant-owned operating tools."
        actions={
          <>
            <a className="launch-cta" href="#apply">
              Start an application <Send />
            </a>
            <LaunchCta href="/vendor" secondary>
              Restaurant sign in
            </LaunchCta>
          </>
        }
      />
      <section className="partner-value-grid">
        <article>
          <BadgeCheck />
          <h2>Predictable model</h2>
          <p>
            No Onyn percentage sales commission. Final subscription, payment and delivery charges
            are disclosed before agreement.
          </p>
        </article>
        <article>
          <Store />
          <h2>Operational control</h2>
          <p>
            Protected order board, KDS, menu availability, opening hours, closures and preparation
            capacity.
          </p>
        </article>
        <article>
          <Bike />
          <h2>Controlled launch</h2>
          <p>
            Verified Lahore partners first, with measured support and dispatch instead of
            uncontrolled city expansion.
          </p>
        </article>
      </section>
      <section className="partner-type-grid">
        {partnerTypes.map(({ id, icon: Icon, title, text }) => (
          <button
            key={id}
            type="button"
            className={form.applicationType === id ? "active" : ""}
            onClick={() => setForm({ ...form, applicationType: id as PartnerApplicationType })}
          >
            <Icon />
            <strong>{title}</strong>
            <span>{text}</span>
          </button>
        ))}
      </section>
      <section id="apply" className="application-section">
        <div>
          <span className="kicker">APPLICATION</span>
          <h2>Tell us where you want to operate</h2>
          <p>
            Application does not create a live listing or platform role. Operations checks the
            business, area, compliance and pilot capacity first.
          </p>
        </div>
        {!configured ? (
          <StatusMessage>
            Partner applications activate when the deployment backend is configured.
          </StatusMessage>
        ) : !signedIn ? (
          <PilotAuth title="Verify your mobile before applying" onVerified={load} />
        ) : (
          <div>
            <form className="launch-form" onSubmit={submit}>
              <div className="two-column-fields">
                <label>
                  <span>Application type</span>
                  <select
                    value={form.applicationType}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        applicationType: event.target.value as PartnerApplicationType,
                      })
                    }
                  >
                    {partnerTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Trading/applicant name</span>
                  <input
                    required
                    value={form.tradingName}
                    onChange={(event) => setForm({ ...form, tradingName: event.target.value })}
                  />
                </label>
                <label>
                  <span>City</span>
                  <select
                    value={form.city}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        city: event.target.value as PartnerApplicationInput["city"],
                      })
                    }
                  >
                    <option>Lahore</option>
                    <option>Karachi</option>
                    <option>Islamabad</option>
                    <option>Rawalpindi</option>
                  </select>
                </label>
                <label>
                  <span>Area</span>
                  <input
                    required
                    value={form.area}
                    onChange={(event) => setForm({ ...form, area: event.target.value })}
                    placeholder="For example, Gulberg III"
                  />
                </label>
                <label>
                  <span>Contact name</span>
                  <input
                    required
                    value={form.contactName}
                    onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                  />
                </label>
                <label>
                  <span>Pakistan mobile</span>
                  <input
                    required
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="0300 1234567"
                    inputMode="tel"
                  />
                </label>
                <label>
                  <span>Email (optional)</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </label>
              </div>
              <label>
                <span>Anything operations should know?</span>
                <textarea
                  rows={5}
                  maxLength={1000}
                  value={form.details}
                  onChange={(event) => setForm({ ...form, details: event.target.value })}
                />
              </label>
              <button type="submit">
                <Send /> Submit for review
              </button>
              {message && (
                <StatusMessage tone={message.includes("submitted") ? "success" : "error"}>
                  {message}
                </StatusMessage>
              )}
            </form>
            {applications.length > 0 && (
              <section className="application-history">
                <h2>Your applications</h2>
                {applications.map((item) => (
                  <article key={item.id}>
                    <span>
                      <strong>{item.trading_name}</strong>
                      <small>
                        {item.application_type.replace("_", " ")} · {item.city}
                      </small>
                    </span>
                    <b className={`case-status ${item.status}`}>{item.status.replace("_", " ")}</b>
                    {item.review_note && <p>{item.review_note}</p>}
                  </article>
                ))}
              </section>
            )}
          </div>
        )}
      </section>
    </LaunchShell>
  );
}
