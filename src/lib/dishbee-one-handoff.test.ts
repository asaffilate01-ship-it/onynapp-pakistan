import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isPositiveAcknowledgement,
  providerOrderId,
  responseExcerpt,
  retryDelaySeconds,
  signatureMessage,
} from "../../supabase/functions/_shared/dishbee-handoff";
import { verifyDishbeePlusHandoff } from "../../integrations/dishbee-one-receiver/src/server/dishbee-plus-handoff-auth";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261030120000_dishbee_one_order_handoff.sql",
    import.meta.url,
  ),
  "utf8",
);
const worker = readFileSync(
  new URL("../../supabase/functions/dispatch-dishbee-one-orders/index.ts", import.meta.url),
  "utf8",
);
const receiverMigration = readFileSync(
  new URL(
    "../../integrations/dishbee-one-receiver/supabase/migrations/20261030123000_dishbee_plus_signed_pakistan_handoff.sql",
    import.meta.url,
  ),
  "utf8",
);
const receiverRoute = readFileSync(
  new URL(
    "../../integrations/dishbee-one-receiver/src/routes/api.connectors.marketplace.ts",
    import.meta.url,
  ),
  "utf8",
);

async function signedRequest(body: string, secret: string, timestamp: string) {
  const bytes = new TextEncoder();
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.encode(body)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const key = await crypto.subtle.importKey(
    "raw",
    bytes.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = [
    ...new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes.encode(`${timestamp}.${body}`))),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return new Request("https://one.dishbee.example/api/connectors/marketplace", {
    method: "POST",
    body,
    headers: {
      "idempotency-key": "b476a432-f499-4a15-8a1a-69165ab5151f",
      "x-dishbee-plus-timestamp": timestamp,
      "x-dishbee-plus-payload-sha256": digest,
      "x-dishbee-plus-signature": `v1=${signature}`,
    },
  });
}

describe("Dishbee One handoff protocol", () => {
  it("signs the timestamp and exact transmitted bytes", () => {
    expect(signatureMessage("1793376000", '{"order":"abc"}')).toBe('1793376000.{"order":"abc"}');
  });

  it("uses bounded exponential retry delays", () => {
    expect(retryDelaySeconds(1)).toBe(30);
    expect(retryDelaySeconds(2)).toBe(60);
    expect(retryDelaySeconds(8)).toBe(3600);
    expect(retryDelaySeconds(20)).toBe(3600);
  });

  it("only treats a conflict as success when the receiver confirms the duplicate", () => {
    expect(isPositiveAcknowledgement(201, {})).toBe(true);
    expect(isPositiveAcknowledgement(409, { error: "Conflict" })).toBe(false);
    expect(isPositiveAcknowledgement(409, { duplicate: true, orderId: "EPOS-42" })).toBe(true);
    expect(providerOrderId({ result: { provider_order_id: "EPOS-42" } })).toBe("EPOS-42");
  });

  it("does not persist an unrestricted provider response", () => {
    expect(responseExcerpt({ ok: true, orderId: "1", customerPhone: "+923001234567" })).toEqual({
      ok: true,
      orderId: "1",
    });
  });

  it("enforces an idempotent, private, leased outbox", () => {
    expect(migration).toContain("unique (order_id, integration)");
    expect(migration).toContain("unique (idempotency_key)");
    expect(migration).toContain("dishbee_one_menu_option_links");
    expect(migration).toContain("dishbeeOptionId");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("lease_until = now() + interval '3 minutes'");
    expect(migration).toContain("Acknowledged handoffs cannot be retried");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("to service_role");
  });

  it("keeps connector credentials server-only and sends all integrity headers", () => {
    expect(worker).toContain('Deno.env.get("DISHBEE_ONE_HANDOFF_SECRET")');
    expect(worker).toContain('"idempotency-key": job.idempotency_key');
    expect(worker).toContain('"x-dishbee-plus-payload-sha256"');
    expect(worker).toContain('"x-dishbee-plus-signature": `v1=${signature}`');
    expect(worker).not.toContain("VITE_DISHBEE_ONE_HANDOFF_SECRET");
  });

  it("lets Dishbee One verify exact request bytes and reject replay or tampering", async () => {
    const secret = "0123456789abcdef0123456789abcdef";
    const now = 1_793_376_000_000;
    const body = '{"action":"dishbee_plus_order"}';
    const request = await signedRequest(body, secret, String(now / 1000));
    await expect(verifyDishbeePlusHandoff(request, body, secret, now)).resolves.toEqual({
      idempotencyKey: "b476a432-f499-4a15-8a1a-69165ab5151f",
      payloadHash: request.headers.get("x-dishbee-plus-payload-sha256"),
    });
    await expect(verifyDishbeePlusHandoff(request, `${body} `, secret, now)).resolves.toBeNull();
    await expect(
      verifyDishbeePlusHandoff(request, body, secret, now + 301_000),
    ).resolves.toBeNull();
  });

  it("keeps Pakistan COD unpaid while releasing it through the authorised-tab KDS gate", () => {
    expect(receiverMigration).toContain("then 'authorised_tab'::public.order_status");
    expect(receiverMigration).toContain("then now() else null end");
    expect(receiverMigration).toContain("perform public.release_order_to_kds(v_order)");
    expect(receiverMigration).toContain("dishbee_plus_handoff_receipts");
    expect(receiverMigration).toContain("pg_advisory_xact_lock");
  });

  it("makes Dishbee authoritative for items, modifiers and PKR amount parity", () => {
    expect(receiverMigration).toContain("public.channel_price(v_item.id, 'dishbee-plus')");
    expect(receiverMigration).toContain("dishbee_plus_modifier_price_parity_failed");
    expect(receiverMigration).toContain("dishbee_plus_total_parity_failed");
    expect(receiverMigration).toContain("dishbee_plus_currency_not_supported");
    expect(receiverRoute).toContain("verifyDishbeePlusHandoff");
    expect(receiverRoute).toContain('currency: z.literal("PKR")');
    expect(receiverRoute).toContain("server_ingest_dishbee_plus_order_v2");
  });
});
