// @ts-nocheck
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  isPositiveAcknowledgement,
  providerOrderId,
  responseExcerpt,
  signatureMessage,
} from "../_shared/dishbee-handoff.ts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return json(401, { error: "Unauthorised" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const handoffUrl = Deno.env.get("DISHBEE_ONE_HANDOFF_URL");
  const connectorToken = Deno.env.get("DISHBEE_ONE_CONNECTOR_TOKEN");
  const signingSecret = Deno.env.get("DISHBEE_ONE_HANDOFF_SECRET");
  if (!supabaseUrl || !serviceKey || !handoffUrl || !connectorToken || !signingSecret) {
    return json(503, { error: "Dishbee One handoff worker is not configured" });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: jobs, error } = await supabase.rpc("service_claim_dishbee_one_handoffs", {
    p_limit: 20,
  });
  if (error) return json(503, { error: "Handoff outbox claim failed" });

  let acknowledged = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    const body = JSON.stringify(job.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const digest = await sha256(body);
    const signature = await hmac(signingSecret, signatureMessage(timestamp, body));
    try {
      const response = await fetch(handoffUrl, {
        method: "POST",
        signal: AbortSignal.timeout(12_000),
        headers: {
          authorization: `Bearer ${connectorToken}`,
          "content-type": "application/json",
          "idempotency-key": job.idempotency_key,
          "x-dishbee-plus-product": "dishbee-plus-pakistan",
          "x-dishbee-plus-schema": "1",
          "x-dishbee-plus-timestamp": timestamp,
          "x-dishbee-plus-payload-sha256": digest,
          "x-dishbee-plus-signature": `v1=${signature}`,
        },
        body,
      });
      const raw = await response.text();
      let parsed: unknown = {};
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = { error: raw.slice(0, 300) };
      }
      const accepted = isPositiveAcknowledgement(response.status, parsed);
      await supabase.rpc("service_complete_dishbee_one_handoff", {
        p_id: job.id,
        p_acknowledged: accepted,
        p_http_status: response.status,
        p_provider_order_id: providerOrderId(parsed),
        p_response: responseExcerpt(parsed),
        p_error: accepted ? null : `Dishbee One HTTP ${response.status}`,
      });
      if (accepted) acknowledged += 1;
      else failed += 1;
    } catch (handoffError) {
      await supabase.rpc("service_complete_dishbee_one_handoff", {
        p_id: job.id,
        p_acknowledged: false,
        p_http_status: null,
        p_provider_order_id: null,
        p_response: {},
        p_error: handoffError instanceof Error ? handoffError.message : "Handoff request failed",
      });
      failed += 1;
    }
  }

  return json(200, { claimed: jobs?.length ?? 0, acknowledged, failed });
});
