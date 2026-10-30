import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Calculator, Check, CircleDollarSign, Store, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { LaunchShell } from "../components/launch-shell";

export const Route = createFileRoute("/for-business")({
  head: () => ({
    meta: [
      { title: "For Restaurants and Home Chefs | Dishbee+ Pakistan" },
      {
        name: "description",
        content:
          "Apply for Dishbee+ Pakistan's Lahore partner pilot: predictable subscription, 0% sales commission and connected ordering operations.",
      },
    ],
  }),
  component: ForBusinessPage,
});

function ForBusinessPage() {
  const [monthlySales, setMonthlySales] = useState("500000");
  const [commission, setCommission] = useState("25");
  const estimatedCommission = useMemo(() => {
    const sales = Math.max(0, Number(monthlySales) || 0);
    const rate = Math.min(50, Math.max(0, Number(commission) || 0));
    return Math.round((sales * rate) / 100);
  }, [commission, monthlySales]);

  return (
    <LaunchShell variant="marketing">
      <section className="business-hero">
        <span>FOR PAKISTAN RESTAURANTS & HOME CHEFS</span>
        <h1>Stop giving away every sale. Start building your own business.</h1>
        <p>
          Dishbee+ combines marketplace ordering, menu control, KDS and local delivery operations
          with no Dishbee+ percentage commission on your food sales.
        </p>
        <div>
          <a href="/partners">
            Apply for the Lahore pilot <ArrowRight />
          </a>
          <a className="secondary" href="#savings">
            Estimate commission leakage
          </a>
        </div>
        <small>No card required to apply. Commercial terms are reviewed before activation.</small>
      </section>

      <section className="business-proof-grid">
        <article>
          <strong>0%</strong>
          <span>Dishbee+ sales commission</span>
        </article>
        <article>
          <strong>1</strong>
          <span>Connected order workspace</span>
        </article>
        <article>
          <strong>PKR</strong>
          <span>Transparent local charges</span>
        </article>
        <article>
          <strong>COD</strong>
          <span>Reconciled delivery pilot</span>
        </article>
      </section>

      <section className="business-value-section">
        <div className="pk-section-heading">
          <span>WHAT PARTNERS RECEIVE</span>
          <h2>Practical tools before inflated promises.</h2>
        </div>
        <div className="business-value-grid">
          {[
            [
              Store,
              "Marketplace ordering",
              "Live availability, delivery/collection, clear fees and protected customer checkout.",
            ],
            [
              Utensils,
              "Menu and KDS control",
              "Menu import, modifiers, sold-out controls, kitchen states and preparation settings.",
            ],
            [
              CircleDollarSign,
              "Predictable commercial model",
              "No sales percentage taken by Dishbee+; agreed subscription and operating costs shown separately.",
            ],
            [
              Calculator,
              "Operational evidence",
              "Order events, role controls, dispatch, proof and exact COD handover records.",
            ],
          ].map(([Icon, title, copy]) => {
            const ValueIcon = Icon as typeof Store;
            return (
              <article key={String(title)}>
                <ValueIcon />
                <h3>{String(title)}</h3>
                <p>{String(copy)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="savings" className="business-calculator">
        <div>
          <span>COMMISSION SAVINGS ESTIMATE</span>
          <h2>See what percentage commission may be costing.</h2>
          <p>
            This illustrates marketplace commission leakage only. It is not a quotation and does not
            deduct Dishbee+ subscription, delivery, payment-processing or hardware charges.
          </p>
        </div>
        <form onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Monthly marketplace sales (PKR)</span>
            <input
              inputMode="numeric"
              value={monthlySales}
              onChange={(event) => setMonthlySales(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label>
            <span>Current commission rate</span>
            <div>
              <input
                inputMode="decimal"
                value={commission}
                onChange={(event) => setCommission(event.target.value)}
              />
              <b>%</b>
            </div>
          </label>
          <output>
            <small>ESTIMATED MONTHLY COMMISSION</small>
            <strong>Rs. {estimatedCommission.toLocaleString("en-PK")}</strong>
            <span>Rs. {(estimatedCommission * 12).toLocaleString("en-PK")} per year</span>
          </output>
          <a href="/partners">
            Discuss your partner plan <ArrowRight />
          </a>
        </form>
      </section>

      <section className="business-steps">
        <div className="pk-section-heading">
          <span>CONTROLLED ONBOARDING</span>
          <h2>Four steps from application to first order.</h2>
        </div>
        <div>
          {[
            ["01", "Apply", "Tell us about the business, Lahore area and main contact."],
            ["02", "Verify", "Complete identity, food-business and operating checks."],
            ["03", "Set up", "Import the menu, modifiers, hours, zones and staff access."],
            ["04", "Pilot", "Run end-to-end test orders before customer activation."],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <b>{number}</b>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="business-included">
        <h2>Included in the controlled launch workspace</h2>
        <div>
          {[
            "Order acceptance and rejection reasons",
            "Kitchen preparation and ready states",
            "Menu CSV import and availability",
            "Opening hours and temporary closures",
            "Customer address and handover notes",
            "Manual verified-rider dispatch",
            "Support and cancellation cases",
            "Exact COD collection and reconciliation",
          ].map((item) => (
            <span key={item}>
              <Check />
              {item}
            </span>
          ))}
        </div>
        <a href="/partners">
          Apply now <ArrowRight />
        </a>
      </section>
    </LaunchShell>
  );
}
