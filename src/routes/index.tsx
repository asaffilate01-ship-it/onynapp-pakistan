import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bike,
  Check,
  ChevronDown,
  Clock3,
  HeartHandshake,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Utensils,
} from "lucide-react";
import { LaunchShell } from "../components/launch-shell";
import { DishbeePlusBrand } from "../components/dishbee-plus-brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dishbee+ Pakistan — Local food, delivered fairly" },
      {
        name: "description",
        content:
          "Discover Lahore restaurants and home chefs with clear fees, protected COD ordering and a fair zero-sales-commission model for partners.",
      },
      { property: "og:title", content: "Dishbee+ Pakistan — Delivery done fairly" },
      {
        property: "og:description",
        content: "A safer, fairer local food marketplace launching in selected Lahore zones.",
      },
    ],
  }),
  component: PakistanLandingPage,
});

const platformCards = [
  {
    image: "/brand/dishbee-order.png",
    label: "LAUNCH",
    title: "Dishbee+ Food",
    copy: "Browse verified local kitchens, customise meals and track every COD order from one clear journey.",
    href: "/order",
  },
  {
    image: "/brand/dishbee-partner.png",
    label: "ONBOARDING",
    title: "Dishbee+ One",
    copy: "Restaurants and home chefs get menu, order, KDS and opening-hours tools without a percentage sales cut.",
    href: "/for-business",
  },
  {
    image: "/brand/dishbee-rider.png",
    label: "CONTROLLED PILOT",
    title: "Dishbee+ Rider",
    copy: "Verified riders, accountable handovers and exact COD reconciliation designed for local operations.",
    href: "/rider",
  },
  {
    image: "/brand/dishbee-counter.png",
    label: "NEXT RELEASE",
    title: "Dishbee+ Counter",
    copy: "A connected counter, kitchen and online ordering system—being validated before commercial release.",
    href: "/vendor",
  },
];

const faqs = [
  [
    "Where is Dishbee+ launching?",
    "The controlled launch begins in selected Gulberg III and DHA Phase 5 areas of Lahore. More areas open only after service and support checks pass.",
  ],
  [
    "How do customers pay?",
    "The initial pilot uses cash on delivery. Online payments will be enabled only after a Pakistan payment provider, signed webhooks and refund operations pass testing.",
  ],
  [
    "Does Dishbee+ charge restaurant commission?",
    "Dishbee+'s intended model is 0% sales commission with a predictable subscription. Delivery, payment processing and agreed hardware costs remain separate and must be disclosed.",
  ],
  [
    "Can home chefs apply?",
    "Yes. Home chefs can apply, but food-safety, identity, operating-area and menu checks must be completed before activation.",
  ],
];

function PakistanLandingPage() {
  return (
    <LaunchShell variant="marketing">
      <section className="pk-brand-hero">
        <div className="pk-hero-overlay" />
        <div className="pk-hero-content">
          <span className="pk-hero-eyebrow">
            <MapPin /> SELECTED LAHORE ZONES · CONTROLLED LAUNCH
          </span>
          <DishbeePlusBrand inverse className="pk-hero-wordmark" />
          <h1>
            Delivery <span>done fairly.</span>
          </h1>
          <p>
            Local restaurants and home chefs, clear fees, protected cash-on-delivery ordering and
            more value staying in Pakistan's neighbourhood food economy.
          </p>
          <div className="pk-hero-actions">
            <a href="/order">
              Start ordering <ArrowRight />
            </a>
            <a className="secondary" href="/for-business">
              <Store /> Partner with Dishbee+
            </a>
          </div>
          <div className="pk-launch-trust">
            <span>
              <ShieldCheck /> Verified partner onboarding
            </span>
            <span>
              <Banknote /> Exact COD controls
            </span>
            <span>
              <HeartHandshake /> Local support
            </span>
          </div>
        </div>
        <a className="pk-scroll-cue" href="#platform">
          Explore Dishbee+ <ChevronDown />
        </a>
      </section>

      <section className="pk-proof-strip" aria-label="Dishbee Plus launch commitments">
        <article>
          <strong>0%</strong>
          <span>Dishbee+ sales commission*</span>
        </article>
        <article>
          <strong>PKR</strong>
          <span>Clear local pricing</span>
        </article>
        <article>
          <strong>2</strong>
          <span>Initial Lahore zones</span>
        </article>
        <article>
          <strong>COD</strong>
          <span>Controlled launch payment</span>
        </article>
      </section>

      <section id="platform" className="pk-platform-section">
        <div className="pk-section-heading">
          <span>THE PAKISTAN PLATFORM</span>
          <h2>One connected experience. Built around trust.</h2>
          <p>
            Proven marketplace workflows, rebuilt for Dishbee+ customers, kitchens, riders and cash
            operations in Pakistan.
          </p>
        </div>
        <div className="pk-platform-grid">
          {platformCards.map((card) => (
            <a href={card.href} key={card.title} className="pk-platform-card">
              <img src={card.image} alt="" />
              <span>{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
              <b>
                Explore <ArrowRight />
              </b>
            </a>
          ))}
        </div>
      </section>

      <section className="pk-customer-story">
        <div>
          <span className="pk-kicker">CUSTOMER EXPERIENCE</span>
          <h2>From craving to doorstep, without the confusion.</h2>
          <p>
            The Pakistan journey prioritises quick discovery, honest availability and a clear
            handover instead of filling the screen with unready services.
          </p>
          <ul>
            <li>
              <Check /> Delivery and collection shown before browsing
            </li>
            <li>
              <Check /> Live opening hours, modifiers and sold-out status
            </li>
            <li>
              <Check /> Saved addresses, favourites and verified-order ratings
            </li>
            <li>
              <Check /> Protected tracking, support and cancellation review
            </li>
          </ul>
          <a href="/order">
            Browse Lahore food <ArrowRight />
          </a>
        </div>
        <div className="pk-journey-board">
          <article>
            <Utensils />
            <span>
              <small>1 · DISCOVER</small>
              <strong>Local food you actually want</strong>
            </span>
          </article>
          <i />
          <article>
            <Clock3 />
            <span>
              <small>2 · PREPARE</small>
              <strong>Live kitchen status updates</strong>
            </span>
          </article>
          <i />
          <article>
            <Bike />
            <span>
              <small>3 · DELIVER</small>
              <strong>Verified rider and proof</strong>
            </span>
          </article>
          <i />
          <article>
            <PackageCheck />
            <span>
              <small>4 · COMPLETE</small>
              <strong>Support and order history</strong>
            </span>
          </article>
        </div>
      </section>

      <section className="pk-fair-section">
        <div>
          <span>
            <Sparkles /> BUILT FOR INDEPENDENT FOOD BUSINESSES
          </span>
          <h2>Keep the sale. Grow the relationship.</h2>
          <p>
            Dishbee+ is designed around predictable software costs rather than taking a large cut
            from every customer order. Partners keep control of their menu, availability and
            operations.
          </p>
          <div>
            <a href="/for-business">
              See the partner model <ArrowRight />
            </a>
            <a className="secondary" href="/partners">
              Apply for the Lahore pilot
            </a>
          </div>
        </div>
        <aside>
          <BadgeCheck />
          <strong>No percentage sales commission</strong>
          <p>
            Subscription, delivery, payments and hardware are disclosed separately before agreement.
          </p>
        </aside>
      </section>

      <section className="pk-faq-section">
        <div className="pk-section-heading">
          <span>LAUNCH QUESTIONS</span>
          <h2>Clear answers before you order or join.</h2>
        </div>
        <div className="pk-faq-grid">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="pk-final-cta">
        <DishbeePlusBrand inverse className="pk-final-wordmark" />
        <span>LAHORE CONTROLLED LAUNCH</span>
        <h2>Ready to discover a fairer local food marketplace?</h2>
        <div>
          <a href="/order">
            Order food <ArrowRight />
          </a>
          <a className="secondary" href="/partners">
            Join as a partner
          </a>
        </div>
      </section>
    </LaunchShell>
  );
}
