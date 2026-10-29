import {jiraRecordedScopesSchema} from '@/lib/integrations/jira/jiraRecordedScopes';
import "server-only";
import { Buffer } from "node:buffer";
import { z } from "zod";

/** Internal exchange only. Never reads environment/vault credentials or touches
 * connection storage. A future caller must authorize/fence current actor and
 * connection, serialize rotation BEFORE this POST, and CAS the exact old row
 * before using the pair. Success is not persisted readiness or a write grant.
 * https://developer.atlassian.com/cloud/oauth/getting-started/refresh-tokens/
 */
const TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const MAX_BYTES = 256 * 1024;
const secret = z.string().min(1).max(65536).refine(value => value.trim().length > 0 &&
 !/[\x00-\x1f\x7f-\x9f]/.test(value) && Buffer.byteLength(value, "utf8") <= 65536 && Buffer.from(value, "utf8").toString("utf8") === value);
const clientIdSchema = z.string().min(1).max(512).refine(value => value === value.trim() && !/[\x00-\x1f\x7f-\x9f]/.test(value));
const scopesSchema = jiraRecordedScopesSchema
 .refine(value => value.includes("read:jira-work") && new Set(value).size === value.length);
const tokenSchema = z.object({ access_token: secret, refresh_token: secret,
 expires_in: z.number().int().min(1).max(86400),
 scope: z.string().min(1).max(16384).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)).optional(),
 token_type: z.string().max(32).refine(value => value.toLowerCase() === "bearer").optional(),
});
const unavailable = () => new Error("jira_refresh_unavailable");
/** Once transport was invoked, loss/abort/invalid response may hide rotation.
 * Never automatically reuse the previous refresh token or repeat the POST.
 * This class contains no provider diagnostics or credential material. */
export class JiraRefreshOutcomeUnknown extends Error {
 readonly retryAllowed = false;
 constructor() { super("jira_refresh_outcome_unknown"); this.name = "JiraRefreshOutcomeUnknown"; }
}
async function bounded<T>(work: Promise<T>, signal: AbortSignal, discard?: (value: T) => void): Promise<T> {
 return new Promise((resolve, reject) => {
  const abort = () => { signal.removeEventListener("abort", abort); reject(unavailable()); };
  if (signal.aborted) { work.then(value => discard?.(value), () => undefined); abort(); return; }
  signal.addEventListener("abort", abort, { once: true });
  work.then(value => { signal.removeEventListener("abort", abort); if (signal.aborted) { discard?.(value); reject(unavailable()); } else resolve(value); },
   () => { signal.removeEventListener("abort", abort); reject(unavailable()); });
 });
}
export async function refreshJiraToken(input: {
 clientId: string; clientSecret: string; refreshToken: string;
 /** Exact currently approved scope facts from trusted server-owned storage. */
 approvedScopes: readonly string[];
 signal: AbortSignal;
 /** Mandatory trusted single-attempt transport, never a client or global fallback. */
 transport: typeof fetch;
 now?: () => number;
}): Promise<Readonly<{ accessToken: string; refreshToken: string; expiresAt: number; scopes: readonly string[];
 persistenceRequired: true; connectionReadinessVerified: false }>> {
 let dispatched = false;
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  // Snapshot all values/references before an asynchronous boundary.
  const { signal: callerSignal, transport, now: suppliedClock } = input;
  const clientId = clientIdSchema.parse(input.clientId), clientSecret = secret.parse(input.clientSecret), refreshToken = secret.parse(input.refreshToken);
  const approvedScopes = scopesSchema.parse(input.approvedScopes);
  const clock = suppliedClock ?? Date.now, issuedAt = clock();
  if (typeof transport !== "function" || !(callerSignal instanceof AbortSignal) || callerSignal.aborted ||
   !Number.isSafeInteger(issuedAt) || issuedAt < 0) throw unavailable();
  const deadline = new AbortController(); timer = setTimeout(() => deadline.abort(), 15000);
  const signal = AbortSignal.any([callerSignal, deadline.signal]);
  const init: RequestInit = { method: "POST", redirect: "error", credentials: "omit", cache: "no-store", signal,
   headers: { accept: "application/json", "content-type": "application/json" },
   body: JSON.stringify({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }) };
  signal.throwIfAborted();
  dispatched = true;
  const response = await bounded(transport(TOKEN_URL, init), signal, late => { void late.body?.cancel().catch(() => undefined); });
  const cancel = () => { void response.body?.cancel().catch(() => undefined); };
  const length = response.headers.get("content-length");
  if (response.status !== 200 || response.redirected || response.url && response.url !== TOKEN_URL || !response.body ||
   response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
   length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) { cancel(); throw unavailable(); }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0, reads = 0;
  try {
   while (true) {
    if (++reads > MAX_BYTES + 1) throw unavailable();
    const part = await bounded(reader.read(), signal);
    if (part.done) break;
    bytes += part.value.byteLength; if (bytes > MAX_BYTES) throw unavailable();
    if (part.value.byteLength) chunks.push(part.value);
   }
  } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
  signal.throwIfAborted();
  const data = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  const token = tokenSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data)));
  if (token.refresh_token === refreshToken) throw unavailable();
  // OAuth 2.0 permits scope omission when unchanged (RFC6749 §5.1/§6).
  // The request deliberately omits scope, so absence retains EXACT stored facts.
  // https://www.rfc-editor.org/rfc/rfc6749#section-5.1
  const scopes = token.scope === undefined ? [...approvedScopes] : scopesSchema.parse(token.scope.split(" ").filter(Boolean));
  if (scopes.some(scope => !approvedScopes.includes(scope))) throw unavailable();
  const expiresAt = issuedAt + token.expires_in * 1000, completedAt = clock();
  if (signal.aborted || !Number.isSafeInteger(completedAt) || completedAt < issuedAt ||
   !Number.isSafeInteger(expiresAt) || expiresAt <= completedAt) throw unavailable();
  return Object.freeze({ accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt,
   scopes: Object.freeze([...scopes]), persistenceRequired: true, connectionReadinessVerified: false });
 } catch { if (dispatched) throw new JiraRefreshOutcomeUnknown(); throw unavailable(); }
 finally { if (timer !== undefined) clearTimeout(timer); }
}
