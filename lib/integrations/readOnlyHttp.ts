import "server-only";

/**
 * Shared GET-only JSON fetch for fixed-host, read-only provider clients (PagerDuty, Opsgenie,
 * LaunchDarkly). The host is fixed in code, redirects are refused, responses are size-bounded and
 * nothing but GET is ever sent. Callers parse defensively; this helper never returns raw bodies to users.
 */
export const READ_ONLY_MAX_BYTES = 2 * 1024 * 1024;

export async function getJson(url: string, headers: Record<string, string>, errorPrefix: string): Promise<unknown> {
  const response = await fetch(url, { method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { accept: "application/json", ...headers } });
  if (!response.ok) throw new Error(`${errorPrefix}_api_failed:${response.status}`);
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > READ_ONLY_MAX_BYTES) throw new Error(`${errorPrefix}_response_too_large`);
  const text = await response.text();
  if (text.length > READ_ONLY_MAX_BYTES) throw new Error(`${errorPrefix}_response_too_large`);
  try { return JSON.parse(text) as unknown; } catch { throw new Error(`${errorPrefix}_response_invalid`); }
}

export const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export const boundedText = (v: unknown, max = 256): string | null => (typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v) ? v : null);
export const isoTime = (v: unknown): string | null => (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
/** An https link on one of the provider's own hosts, else null (never echo arbitrary URLs). */
export function providerLink(v: unknown, hostSuffix: string): string | null {
  if (typeof v !== "string" || v.length > 512) return null;
  try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password && (u.hostname === hostSuffix || u.hostname.endsWith(`.${hostSuffix}`)) ? u.toString() : null; } catch { return null; }
}
