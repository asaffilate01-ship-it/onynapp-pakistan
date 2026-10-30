const encoder = new TextEncoder();

function fromHex(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
  const bytes = new Uint8Array(new ArrayBuffer(value.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function toHex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export type VerifiedDishbeePlusHandoff = {
  idempotencyKey: string;
  payloadHash: string;
};

export async function verifyDishbeePlusHandoff(
  request: Request,
  rawBody: string,
  secret: string | undefined,
  nowMs = Date.now(),
): Promise<VerifiedDishbeePlusHandoff | null> {
  if (!secret || secret.length < 32) return null;
  const timestamp = request.headers.get("x-dishbee-plus-timestamp") ?? "";
  const digest = (request.headers.get("x-dishbee-plus-payload-sha256") ?? "").toLowerCase();
  const signatureHeader = request.headers.get("x-dishbee-plus-signature") ?? "";
  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  if (!/^\d{10}$/.test(timestamp)) return null;
  if (!/^[0-9a-f]{64}$/.test(digest)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) return null;
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return null;

  const actualDigest = toHex(await crypto.subtle.digest("SHA-256", encoder.encode(rawBody)));
  if (!constantTimeEqual(digest, actualDigest)) return null;

  const suppliedSignature = signatureHeader.startsWith("v1=")
    ? fromHex(signatureHeader.slice(3))
    : null;
  if (!suppliedSignature) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    suppliedSignature,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  return valid ? { idempotencyKey, payloadHash: digest } : null;
}
