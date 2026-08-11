import { createFileRoute } from "@tanstack/react-router";
import { Bike, CircleHelp, MapPin, MessageCircle, ReceiptText, Store } from "lucide-react";
import { LaunchCta, LaunchHero, LaunchShell } from "../components/launch-shell";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Centre | Onyn Pakistan" },
      {
        name: "description",
        content: "Help with Onyn Pakistan orders, accounts, partners and rider applications.",
      },
    ],
  }),
  component: HelpPage,
});

const faqs = [
  [
    "Where can I order?",
    "The controlled launch area is Gulberg III and DHA Phase 5, Lahore. The app checks the selected restaurant's current service zone again at checkout.",
  ],
  [
    "How do I pay?",
    "The pilot uses cash on delivery only. Cards, JazzCash, Easypaisa and Raast remain disabled until provider, webhook, refund and reconciliation controls are approved.",
  ],
  [
    "Can I cancel?",
    "A newly placed order can be cancelled immediately. After restaurant acceptance, submit a support review because preparation may have started.",
  ],
  [
    "What if a restaurant is closed?",
    "Pakistan-time opening hours, temporary closures, capacity and sold-out items are checked by the server when you order.",
  ],
  [
    "How do I become a partner?",
    "Use the partner application page and verify a Pakistan mobile number. Applying does not activate a store; Onyn operations must review it.",
  ],
  [
    "How do riders join?",
    "The rider route accepts Lahore screening applications. Identity, licence and vehicle evidence is collected later through an approved secure verification process, not a public form.",
  ],
];

function HelpPage() {
  return (
    <LaunchShell>
      <LaunchHero
        eyebrow="HELP CENTRE"
        title="What do you need help with?"
        description="Start with the right protected route so customer, restaurant and rider information stays separated."
        actions={
          <>
            <LaunchCta href="/support">Submit a support request</LaunchCta>
            <LaunchCta href="/account" secondary>
              View account
            </LaunchCta>
          </>
        }
      />
      <section className="launch-card-grid help-cards">
        <a href="/support">
          <MessageCircle />
          <strong>Order and account help</strong>
          <span>Protected customer support requests</span>
        </a>
        <a href="/refunds">
          <ReceiptText />
          <strong>Cancellations and refunds</strong>
          <span>COD pilot rules and evidence</span>
        </a>
        <a href="/partners">
          <Store />
          <strong>Restaurant and partner help</strong>
          <span>Apply and check application status</span>
        </a>
        <a href="/rider">
          <Bike />
          <strong>Rider help</strong>
          <span>Application and assigned deliveries</span>
        </a>
        <a href="/">
          <MapPin />
          <strong>Service areas</strong>
          <span>Check Lahore delivery coverage</span>
        </a>
        <a href="/safety">
          <CircleHelp />
          <strong>Safety</strong>
          <span>Food, delivery and urgent guidance</span>
        </a>
      </section>
      <section className="faq-section">
        <div className="section-heading launch-heading">
          <div>
            <span className="kicker">COMMON QUESTIONS</span>
            <h2>Answers before you contact us</h2>
          </div>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </LaunchShell>
  );
}
