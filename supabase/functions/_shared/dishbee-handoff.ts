export function signatureMessage(timestamp: string, body: string): string {
  return `${timestamp}.${body}`;
}

export function retryDelaySeconds(attempt: number): number {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(3600, 30 * 2 ** (normalizedAttempt - 1));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function providerOrderId(value: unknown): string | null {
  const body = asRecord(value);
  if (!body) return null;
  const result = asRecord(body.result);
  const candidates = [
    body.providerOrderId,
    body.provider_order_id,
    body.orderId,
    body.order_id,
    result?.providerOrderId,
    result?.provider_order_id,
    result?.orderId,
    result?.order_id,
  ];
  const match = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof match === "string" ? match.trim().slice(0, 200) : null;
}

export function isPositiveAcknowledgement(status: number, value: unknown): boolean {
  if (status >= 200 && status < 300) return true;
  if (status !== 409) return false;
  const body = asRecord(value);
  const result = asRecord(body?.result);
  return Boolean(
    providerOrderId(value) ||
    body?.existing === true ||
    body?.duplicate === true ||
    result?.existing === true ||
    result?.duplicate === true,
  );
}

export function responseExcerpt(value: unknown): Record<string, unknown> {
  const body = asRecord(value);
  if (!body) return {};
  const allowed = ["ok", "status", "existing", "duplicate", "providerOrderId", "orderId", "error"];
  return Object.fromEntries(
    allowed
      .filter((key) => key in body)
      .map((key) => [
        key,
        typeof body[key] === "string" ? String(body[key]).slice(0, 300) : body[key],
      ]),
  );
}
