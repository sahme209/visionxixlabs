import "server-only";
import { z } from "zod";

// One platform-owned 3LO app. These helpers do not register it, start consent,
// create a tenant connection or grant ticket-write authority.
// https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
const READ_SCOPE = "read:jira-work";
const CALLBACK_PATH = "/api/integrations/jira/callback";
const unavailable = () => new Error("jira_authorization_unavailable");
const secret = z.string().min(1).max(65536).refine(value => !/[\r\n]/.test(value));
const clientId = z.string().min(1).max(512).refine(value => value.trim() === value && !/[\r\n]/.test(value));
const scopeArray = z.array(z.string().min(1).max(128)).max(100);
const rawSite = z.object({ id: z.string().uuid(), name: z.string().min(1).max(512), url: z.string().max(2048), scopes: scopeArray });
export interface JiraSite { id: string; name: string; url: string; scopes: readonly string[] }
export interface JiraOAuthToken { accessToken: string; refreshToken: string | null; expiresAt: number; scopes: string[] }

function callback(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || url.pathname !== CALLBACK_PATH) throw unavailable();
  return url.toString();
}

function consentScopes(purpose?:"ticket_write_upgrade"|"ticket_reporter_upgrade"):string[]{
 if(purpose===undefined)return [READ_SCOPE,'offline_access'];
 if(purpose==='ticket_write_upgrade')return [READ_SCOPE,'write:jira-work','offline_access'];
 if(purpose==='ticket_reporter_upgrade')return [READ_SCOPE,'write:jira-work','offline_access','read:me'];
 throw unavailable();
}
export function buildJiraConsentUrl(input: { clientId: string; redirectUri: string; state: string; purpose?: "ticket_write_upgrade" | "ticket_reporter_upgrade" }): string {
  try {
    const id = clientId.parse(input.clientId);
    if (!/^[A-Za-z0-9_-]{43,256}$/.test(input.state)) throw unavailable();
    const url = new URL("https://auth.atlassian.com/authorize");
    url.search = new URLSearchParams({ audience: "api.atlassian.com", client_id: id, scope: consentScopes(input.purpose).join(" "),
      redirect_uri: callback(input.redirectUri), state: input.state, response_type: "code", prompt: "consent" }).toString();
    return url.toString();
  } catch { throw unavailable(); }
}

function abortable<T>(work: Promise<T>, signal: AbortSignal, discard?: (value: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => { cleanup(); reject(unavailable()); };
    if (signal.aborted) reject(unavailable());
    else signal.addEventListener("abort", onAbort, { once: true });
    work.then(value => {
      cleanup();
      if (signal.aborted) { discard?.(value); reject(unavailable()); }
      else resolve(value);
    }, () => { cleanup(); reject(unavailable()); });
  });
}

async function providerJson(url: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  if (signal.aborted) throw unavailable();
  const response = await abortable(fetch(url, { ...init, redirect: "error", credentials: "omit", cache: "no-store", signal }), signal,
    late => { void late.body?.cancel().catch(() => undefined); });
  const cancel = () => { void response.body?.cancel().catch(() => undefined); };
  if (!response.ok || response.redirected || !response.body) { cancel(); throw unavailable(); }
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > 256 * 1024)) { cancel(); throw unavailable(); }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const read = await abortable(reader.read(), signal);
      if (read.done) break;
      bytes += read.value.byteLength;
      if (bytes > 256 * 1024) throw unavailable();
      chunks.push(read.value);
    }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } finally { void reader.cancel().catch(() => undefined); }
}

/** Caller must first consume state bound to the current tenant and initiating
 * authorized user. Tokens are internal values for encrypted storage, never DTOs.
 * No automatic retry: an authorization code can be redeemed only once.
 */
export async function exchangeJiraAuthorizationCode(input: {
  clientId: string; clientSecret: string; redirectUri: string; code: string; signal: AbortSignal; now?: () => number; purpose?: "ticket_write_upgrade" | "ticket_reporter_upgrade";
}): Promise<JiraOAuthToken> {
  try {
    const id = clientId.parse(input.clientId), appSecret = secret.parse(input.clientSecret), code = secret.parse(input.code);
    const redirectUri = callback(input.redirectUri), now = input.now ?? Date.now, issuedAt = now();
    if (!Number.isSafeInteger(issuedAt) || issuedAt < 0 || input.signal.aborted) throw unavailable();
    const signal = AbortSignal.any([input.signal, AbortSignal.timeout(15_000)]);
    const raw = await providerJson("https://auth.atlassian.com/oauth/token", { method: "POST", headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", client_id: id, client_secret: appSecret, code, redirect_uri: redirectUri }) }, signal);
    const token = z.object({ access_token: secret, refresh_token: secret.optional(), expires_in: z.number().int().min(1).max(86400), scope: z.string().min(1).max(16384) }).parse(raw);
    const scopes = scopeArray.parse(token.scope.split(/\s+/).filter(Boolean));
    const expiresAt = issuedAt + token.expires_in * 1000;
    const allowed = consentScopes(input.purpose);
    if (!scopes.includes(READ_SCOPE) || input.purpose !== undefined && !scopes.includes("write:jira-work") || input.purpose === "ticket_reporter_upgrade" && !scopes.includes("read:me") || scopes.some(scope => !allowed.includes(scope)) || signal.aborted || !Number.isSafeInteger(expiresAt) || expiresAt <= now()) throw unavailable();
    return { accessToken: token.access_token, refreshToken: token.refresh_token ?? null, expiresAt, scopes: [...new Set(scopes)] };
  } catch { throw unavailable(); }
}

function parseSites(input: unknown): JiraSite[] {
  const resources = z.array(rawSite).max(100).parse(input);
  const sites: JiraSite[] = [], ids = new Set<string>();
  for (const resource of resources) {
    if (!resource.scopes.includes(READ_SCOPE)) continue;
    const url = new URL(resource.url);
    // Initial Jira Cloud host support only. This URL is identity/display data;
    // every API request still goes to the fixed Atlassian API gateway.
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || url.search ||
      (url.pathname !== "/" && url.pathname !== "") || !/^[a-z0-9][a-z0-9-]*\.atlassian\.net$/.test(url.hostname) || ids.has(resource.id)) throw unavailable();
    ids.add(resource.id);
    sites.push({ id: resource.id, name: resource.name, url: url.origin, scopes: [...new Set(resource.scopes)] });
  }
  return sites;
}

export async function readJiraAccessibleSites(input: { accessToken: string; signal: AbortSignal }): Promise<JiraSite[]> {
  try {
    const token = secret.parse(input.accessToken);
    if (input.signal.aborted) throw unavailable();
    const signal = AbortSignal.any([input.signal, AbortSignal.timeout(15_000)]);
    const raw = await providerJson("https://api.atlassian.com/oauth/token/accessible-resources", { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${token}` } }, signal);
    if (signal.aborted) throw unavailable();
    return parseSites(raw);
  } catch { throw unavailable(); }
}

/** Explicit selection from fresh server-discovered resources; never choose the
 * first result or accept a browser-supplied site object as provider evidence. */
export function selectJiraSite(sites: readonly JiraSite[], id: string): JiraSite {
  try {
    const selection = parseSites(sites).find(site => site.id === id);
    if (!selection) throw unavailable();
    return Object.freeze({ ...selection, scopes: Object.freeze([...selection.scopes]) });
  } catch { throw unavailable(); }
}
