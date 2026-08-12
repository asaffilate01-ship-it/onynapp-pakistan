// @ts-nocheck
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("PUBLIC_APP_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function cors(origin: string | null) {
  const approved =
    origin && allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] ?? "null");
  return {
    "access-control-allow-origin": approved,
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
}

function json(status: number, body: Record<string, unknown>, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "content-type": "application/json", "cache-control": "no-store" },
  });
}

function normalisePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const local = digits.startsWith("92")
    ? digits.slice(2)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return /^3\d{9}$/.test(local) ? `+92${local}` : null;
}

async function digest(secret: string, value: string) {
  const bytes = new TextEncoder().encode(`${secret}:${value}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const headers = cors(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateSecret = Deno.env.get("OTP_RATE_LIMIT_SECRET");
  if (!supabaseUrl || !anonKey || !serviceKey || !rateSecret || !allowedOrigins.length) {
    return json(503, { error: "OTP service is not configured" }, headers);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid request" }, headers);
  }
  const phone = normalisePhone(body.phone);
  if (!phone) return json(400, { error: "Enter a valid Pakistan mobile number" }, headers);

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("cf-connecting-ip") || "unknown";
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: reserved, error: reserveError } = await admin.rpc("service_reserve_otp_send", {
    p_phone_hash: await digest(rateSecret, phone),
    p_ip_hash: await digest(rateSecret, ip),
  });
  if (reserveError) return json(503, { error: "OTP protection is unavailable" }, headers);
  if (!reserved)
    return json(
      429,
      { error: "Too many codes requested. Please wait before trying again" },
      headers,
    );

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error } = await auth.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
  if (error) return json(502, { error: "The SMS provider could not send a code" }, headers);
  return json(200, { ok: true }, headers);
});
