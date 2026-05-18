/**
 * Request correlation IDs.
 *
 * Every API request gets a stable correlation id so audit events,
 * structured logs, and the response envelope can be threaded together.
 * The id is opaque, URL-safe, and intentionally short — it's not a
 * security boundary, just a join key.
 *
 * If the incoming request already carries `x-correlation-id` or
 * `x-request-id`, that value is preferred so upstream tracing tools
 * stay consistent.
 */

/**
 * Resolve a correlation id from inbound headers, falling back to a
 * freshly-generated one. Pure — never throws.
 */
export function resolveCorrelationId(headers?: Headers | Record<string, string | undefined>): string {
  const inbound = readHeader(headers, "x-correlation-id") ?? readHeader(headers, "x-request-id");
  if (inbound && isValidId(inbound)) return inbound;
  return generateCorrelationId();
}

/**
 * Generate a new correlation id. Uses `crypto.randomUUID()` when
 * available (Node ≥19, modern browsers, edge runtimes) and falls
 * back to a Math.random hex string otherwise. The fallback is *not*
 * cryptographically strong — but correlation ids are not a security
 * boundary, so that's fine.
 */
export function generateCorrelationId(): string {
  const c = globalCrypto();
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return fallbackId();
}

const CORRELATION_HEADER = "x-correlation-id";
export const CORRELATION_ID_HEADER = CORRELATION_HEADER;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readHeader(
  headers: Headers | Record<string, string | undefined> | undefined,
  key: string,
): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(key) ?? undefined;
  }
  const rec = headers as Record<string, string | undefined>;
  return rec[key] ?? rec[key.toLowerCase()];
}

const VALID_ID_RE = /^[A-Za-z0-9._-]{8,80}$/;

function isValidId(value: string): boolean {
  return VALID_ID_RE.test(value);
}

function globalCrypto(): Crypto | undefined {
  if (typeof globalThis !== "undefined" && (globalThis as { crypto?: Crypto }).crypto) {
    return (globalThis as { crypto: Crypto }).crypto;
  }
  return undefined;
}

function fallbackId(): string {
  const part = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `cid-${Date.now().toString(36)}-${part()}${part()}`;
}
