import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyDishbeePlusHandoff } from "../server/dishbee-plus-handoff-auth";
import { verifyBearer } from "../server/runtime-auth";
import { requireSupabaseAdmin } from "../server/supabase-admin";

const line = z.object({
  externalItemId: z.string().min(1),
  sku: z.string().optional(),
  name: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPricePence: z.number().int().nonnegative().optional(),
  modifiers: z.array(z.unknown()).optional(),
  notes: z.string().optional(),
});

const dishbeePlusModifier = z.object({
  dishbeeOptionId: z.string().uuid(),
  groupName: z.string().min(1),
  optionName: z.string().min(1),
  priceDeltaPence: z.number().int(),
});

const dishbeePlusLine = z.object({
  dishbeeItemId: z.string().uuid(),
  name: z.string().optional(),
  quantity: z.number().int().min(1).max(100),
  unitPricePence: z.number().int().nonnegative(),
  modifiers: z.array(dishbeePlusModifier).default([]),
  notes: z.string().optional(),
});

const dishbeePlusOrder = z.object({
  action: z.literal("dishbee_plus_order"),
  schemaVersion: z.literal(1),
  source: z.literal("dishbee-plus-pakistan"),
  linkId: z.string().uuid(),
  externalOrderId: z.string().uuid(),
  externalReference: z.string().min(1),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(30).optional(),
  fulfilment: z.enum(["pickup", "curbside", "delivery"]),
  currency: z.literal("PKR"),
  monetaryUnit: z.literal("paisa"),
  lines: z.array(dishbeePlusLine).min(1).max(250),
  subtotalPence: z.number().int().nonnegative(),
  deliveryPence: z.number().int().nonnegative(),
  totalPence: z.number().int().nonnegative(),
  paymentReference: z.string().max(200).optional(),
  deliveryAddress: z.record(z.unknown()).nullable().optional(),
  vehicle: z.record(z.unknown()).nullable().optional(),
  raw: z
    .object({
      paymentState: z.enum(["cash_due", "provider_verified"]),
      serviceFeePaisa: z.number().int().nonnegative().default(0),
    })
    .passthrough(),
});

const order = z.object({
  action: z.literal("order"),
  connectionId: z.string().uuid(),
  externalId: z.string().min(1),
  customerName: z.string().optional(),
  fulfilment: z.enum(["pickup", "delivery"]),
  lines: z.array(line).min(1),
  providerSubtotalPence: z.number().int().nonnegative().optional(),
  providerTotalPence: z.number().int().nonnegative().optional(),
  raw: z.record(z.unknown()).optional(),
});

const posOrder = z.object({
  action: z.literal("pos_order"),
  connectionId: z.string().uuid(),
  externalId: z.string().min(1),
  customerName: z.string().optional(),
  fulfilment: z.enum(["pickup", "curbside", "delivery", "dine_in"]),
  lines: z.array(line).min(1),
  paymentState: z.enum(["paid", "authorised_tab"]).default("paid"),
  providerTotalPence: z.number().int().nonnegative().optional(),
  raw: z.record(z.unknown()).optional(),
});

const status = z.object({
  action: z.literal("status"),
  connectionId: z.string().uuid(),
  externalId: z.string().min(1),
  externalStatus: z.string().min(1),
  riderStatus: z.string().optional(),
  riderEtaAt: z.string().datetime().optional(),
  customerEtaAt: z.string().datetime().optional(),
  raw: z.record(z.unknown()).optional(),
});

const cancel = z.object({
  action: z.literal("cancel"),
  connectionId: z.string().uuid(),
  externalId: z.string().min(1),
  reason: z.string().optional(),
  raw: z.record(z.unknown()).optional(),
});

const schema = z.discriminatedUnion("action", [order, status, cancel, dishbeePlusOrder, posOrder]);

export const Route = createFileRoute("/api/connectors/marketplace")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorised =
          verifyBearer(request, process.env["DISHBEE_CONNECTOR_WEBHOOK_TOKEN"]) ||
          verifyBearer(request, process.env["DISHBEE_PLUS_CONNECTOR_TOKEN"]);
        if (!authorised) return new Response("unauthorized", { status: 401 });

        const rawBody = await request.text();
        if (rawBody.length > 1_000_000) return new Response("payload too large", { status: 413 });
        try {
          const input = schema.parse(JSON.parse(rawBody));
          const sb = requireSupabaseAdmin();

          if (input.action === "dishbee_plus_order") {
            const verified = await verifyDishbeePlusHandoff(
              request,
              rawBody,
              process.env["DISHBEE_PLUS_HANDOFF_SECRET"],
            );
            if (!verified) return new Response("invalid signature", { status: 401 });
            const { data, error } = await sb.rpc("server_ingest_dishbee_plus_order_v2", {
              p_link: input.linkId,
              p_idempotency_key: verified.idempotencyKey,
              p_payload_hash: verified.payloadHash,
              p_external_order_id: input.externalOrderId,
              p_customer_name: input.customerName ?? "",
              p_customer_phone: input.customerPhone ?? "",
              p_fulfilment: input.fulfilment,
              p_lines: input.lines,
              p_subtotal_pence: input.subtotalPence,
              p_delivery_pence: input.deliveryPence,
              p_total_pence: input.totalPence,
              p_currency: input.currency,
              p_monetary_unit: input.monetaryUnit,
              p_payment_state: input.raw.paymentState,
              p_payment_reference: input.paymentReference ?? null,
              p_delivery_address: input.deliveryAddress ?? null,
              p_vehicle: input.vehicle ?? null,
              p_raw: input.raw,
            });
            if (error) throw new Error(error.message);
            return Response.json({ ok: true, ...data });
          }

          if (input.action === "pos_order") {
            const { data, error } = await sb.rpc("server_ingest_pos_order", {
              p_connection: input.connectionId,
              p_external_id: input.externalId,
              p_customer_name: input.customerName ?? "",
              p_fulfilment: input.fulfilment,
              p_lines: input.lines,
              p_payment_state: input.paymentState,
              p_provider_total_pence: input.providerTotalPence ?? null,
              p_raw: input.raw ?? {},
            });
            if (error) throw new Error(error.message);
            return Response.json({ ok: true, orderId: data });
          }

          if (input.action === "order") {
            const { data, error } = await sb.rpc("server_ingest_marketplace_order", {
              p_connection: input.connectionId,
              p_external_id: input.externalId,
              p_customer_name: input.customerName ?? "",
              p_fulfilment: input.fulfilment,
              p_lines: input.lines,
              p_provider_subtotal_pence: input.providerSubtotalPence ?? null,
              p_provider_total_pence: input.providerTotalPence ?? null,
              p_raw: input.raw ?? {},
            });
            if (error) throw new Error(error.message);
            return Response.json({ ok: true, orderId: data });
          }

          if (input.action === "status") {
            const { error } = await sb.rpc("server_update_marketplace_order_state", {
              p_connection: input.connectionId,
              p_external_id: input.externalId,
              p_external_status: input.externalStatus,
              p_rider_status: input.riderStatus ?? null,
              p_rider_eta_at: input.riderEtaAt ?? null,
              p_customer_eta_at: input.customerEtaAt ?? null,
              p_payload: input.raw ?? {},
            });
            if (error) throw new Error(error.message);
            return Response.json({ ok: true });
          }

          const { error } = await sb.rpc("server_cancel_marketplace_order", {
            p_connection: input.connectionId,
            p_external_id: input.externalId,
            p_reason: input.reason ?? null,
            p_payload: input.raw ?? {},
          });
          if (error) throw new Error(error.message);
          return Response.json({ ok: true });
        } catch (error) {
          console.error(
            "[marketplace-connector]",
            error instanceof Error ? error.message : "marketplace_connector_failed",
          );
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "marketplace_connector_failed",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});
