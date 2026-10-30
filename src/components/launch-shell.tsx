import {
  ArrowRight,
  Bike,
  CircleHelp,
  Home,
  LogIn,
  Menu,
  ShieldCheck,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { DishbeePlusBrand } from "./dishbee-plus-brand";

export function LaunchShell({
  children,
  variant = "standard",
}: {
  children: ReactNode;
  variant?: "standard" | "marketing";
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`launch-shell ${variant === "marketing" ? "marketing" : ""}`}>
      <a className="skip-link" href="#launch-main">
        Skip to content
      </a>
      <header className="launch-header">
        <a className="launch-brand" href="/" aria-label="Dishbee Plus Pakistan home">
          <DishbeePlusBrand context="PAKISTAN" inverse={variant === "marketing"} />
        </a>
        <nav className={menuOpen ? "open" : ""} aria-label="Launch navigation">
          <a href="/order">Order food</a>
          <a href="/for-business">For business</a>
          <a href="/partners">Partners</a>
          <a href="/rider">Riders</a>
          <a href="/help">Help</a>
          <a className="launch-account-link" href="/account">
            <UserRound size={17} /> Account
          </a>
        </nav>
        <button
          className="launch-menu-button"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>
      <main id="launch-main">{children}</main>
      <footer className="launch-footer">
        <div className="launch-footer-grid">
          <div>
            <a className="launch-brand footer" href="/">
              <DishbeePlusBrand context="PAKISTAN" inverse />
            </a>
            <p>Pakistan-only local food ordering, beginning with a controlled Lahore COD pilot.</p>
          </div>
          <div>
            <strong>Customers</strong>
            <a href="/order">Browse food</a>
            <a href="/account">Account and orders</a>
            <a href="/support">Contact support</a>
            <a href="/safety">Safety</a>
          </div>
          <div>
            <strong>Partners</strong>
            <a href="/partners">Restaurant and home-chef applications</a>
            <a href="/for-business">Business benefits and savings</a>
            <a href="/rider">Rider applications</a>
            <a href="/vendor">Restaurant workspace</a>
          </div>
          <div>
            <strong>Legal</strong>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/refunds">Cancellation and refunds</a>
            <a href="/about">About Dishbee+</a>
          </div>
        </div>
        <div className="launch-footer-bottom">
          <span>© 2026 Dishbee+ Pakistan. Controlled pilot candidate.</span>
          <span>English · Urdu localisation in validation</span>
        </div>
      </footer>
      <nav className="launch-mobile-nav" aria-label="Mobile launch navigation">
        <a href="/order">
          <Home /> <span>Food</span>
        </a>
        <a href="/partners">
          <Store /> <span>Partners</span>
        </a>
        <a href="/rider">
          <Bike /> <span>Riders</span>
        </a>
        <a href="/account">
          <UserRound /> <span>Account</span>
        </a>
      </nav>
    </div>
  );
}

export function LaunchHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="launch-hero">
      <span>
        <ShieldCheck size={16} /> {eyebrow}
      </span>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions && <div className="launch-hero-actions">{actions}</div>}
    </section>
  );
}

export function LaunchCta({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <a className={secondary ? "launch-cta secondary" : "launch-cta"} href={href}>
      {children} <ArrowRight size={17} />
    </a>
  );
}

export function StatusMessage({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
}) {
  return (
    <p className={`launch-message ${tone}`} role="status" aria-live="polite">
      {tone === "success" ? <ShieldCheck /> : tone === "error" ? <CircleHelp /> : <LogIn />}
      {children}
    </p>
  );
}
