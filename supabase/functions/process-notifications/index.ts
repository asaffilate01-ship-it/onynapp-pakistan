// @ts-nocheck
import { createClient } from "jsr:@supabase/supabase-js@2";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
    return json(401, { error: "Unauthorised" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const gatewayUrl = Deno.env.get("SMS_GATEWAY_URL");
  const gatewayToken = Deno.env.get("SMS_GATEWAY_TOKEN");
  const senderId = Deno.env.get("SMS_SENDER_ID");
  if (!supabaseUrl || !serviceKey || !gatewayUrl || !gatewayToken || !senderId) {
    return json(503, { error: "Notification worker is not configured" });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: jobs, error } = await supabase.rpc("service_claim_notification_batch", {
    p_limit: 25,
  });
  if (error) return json(503, { error: "Outbox claim failed" });

  let sent = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    const message = `${job.payload?.title ?? "Order update"} · ${job.payload?.reference ?? "Onyn Pakistan"}`;
    try {
      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: { authorization: `Bearer ${gatewayToken}`, "content-type": "application/json" },
        body: JSON.stringify({ to: job.phone_e164, message, sender_id: senderId }),
      });
      const provider = await response.json().catch(() => ({}));
      await supabase.rpc("service_complete_notification", {
        p_id: job.id,
        p_sent: response.ok,
        p_provider_message_id: provider.message_id ?? provider.id ?? null,
        p_error: response.ok ? null : `Gateway HTTP ${response.status}`,
      });
      if (response.ok) sent += 1;
      else failed += 1;
    } catch (providerError) {
      await supabase.rpc("service_complete_notification", {
        p_id: job.id,
        p_sent: false,
        p_provider_message_id: null,
        p_error: providerError instanceof Error ? providerError.message : "Gateway request failed",
      });
      failed += 1;
    }
  }
  return json(200, { claimed: jobs?.length ?? 0, sent, failed });
});
