import { CheckCircle2, KeyRound, LoaderCircle, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { requestPakistanOtp, verifyPakistanOtp } from "../lib/supabase";

export function PilotAuth({
  title = "Sign in securely",
  onVerified,
}: {
  title?: string;
  onVerified: () => void | Promise<void>;
}) {
  const [phone, setPhone] = useState("");
  const [sentPhone, setSentPhone] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setMessage("");
    const result = await requestPakistanOtp(phone);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSentPhone(result.phone);
    setCooldown(60);
    setMessage("A six-digit code has been sent to your mobile.");
  }

  async function resendCode() {
    if (cooldown > 0) return;
    setBusy(true);
    const result = await requestPakistanOtp(sentPhone);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setCooldown(60);
    setMessage("A new six-digit code has been sent.");
  }

  async function verifyCode() {
    setBusy(true);
    const result = await verifyPakistanOtp(sentPhone, token);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage("Signed in securely.");
    await onVerified();
  }

  return (
    <section className="pilot-auth-card">
      <span className="auth-icon">
        <KeyRound />
      </span>
      <div>
        <h2>{title}</h2>
        <p>Use a Pakistan mobile number. We never ask for a password in this pilot.</p>
      </div>
      {!sentPhone ? (
        <label>
          <span>Pakistan mobile number</span>
          <div className="phone-field">
            <Smartphone />
            <b>+92</b>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="3XX XXXXXXX"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <button type="button" onClick={sendCode} disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : "Send secure code"}
          </button>
        </label>
      ) : (
        <label>
          <span>Six-digit code</span>
          <input
            className="otp-code-field"
            value={token}
            onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <button type="button" onClick={verifyCode} disabled={busy || token.length !== 6}>
            {busy ? (
              <LoaderCircle className="spin" />
            ) : (
              <>
                <CheckCircle2 /> Verify and continue
              </>
            )}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={resendCode}
            disabled={busy || cooldown > 0}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend secure code"}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setSentPhone("");
              setToken("");
              setMessage("");
              setCooldown(0);
            }}
          >
            Use another number
          </button>
        </label>
      )}
      {message && (
        <p className="auth-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
