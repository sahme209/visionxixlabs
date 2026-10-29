"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ProviderLogo } from "../cockpit/ProviderLogo";

const identifier = z.string().min(1).max(512).refine(value => value.trim() === value && !/[\x00-\x1f\x7f-\x9f]/.test(value) && new TextEncoder().encode(value).length <= 512);
const instant = z.string().max(32).refine(value => { try { return new Date(value).toISOString() === value; } catch { return false; } });
const connectionSchema = z.object({ connectionId: identifier, revision: instant, recordedState: z.enum(["consent_recorded", "read_validation_recorded"]), lastValidatedAt: instant.nullable() }).strict()
 .refine(row => row.recordedState !== "read_validation_recorded" || row.lastValidatedAt !== null);
const summarySchema = z.object({ ok: z.literal(true), data: z.object({ serverConfigured: z.boolean(), canStartConsent: z.boolean(), scope: z.literal("current_consenting_user"), connections: z.array(connectionSchema).max(20), hasMore: z.boolean(), nextAfterId: identifier.nullable(), currentHealth: z.literal("not_checked"), issueWritePermissionVerified: z.literal(false) }).strict() }).strict()
 .refine(({data}) => new Set(data.connections.map(row => row.connectionId)).size === data.connections.length && (data.hasMore ? data.connections.length > 0 && data.nextAfterId === data.connections[data.connections.length - 1].connectionId : data.nextAfterId === null));
const siteSchema = z.object({ id: z.string().uuid(), name: z.string().min(1).max(512), url: z.string().max(2048).refine(value => { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === "/" && /^[a-z0-9][a-z0-9-]*\.atlassian\.net$/.test(url.hostname); } catch { return false; } }) }).strict();
const sitesSchema = z.object({ ok: z.literal(true), data: z.object({ revision: instant, sites: z.array(siteSchema).max(100) }).strict() }).strict()
 .refine(({data}) => new Set(data.sites.map(site => site.id)).size === data.sites.length);
const activationSchema = z.object({ ok: z.literal(true), data: z.object({ connectionId: identifier, cloudId: z.string().uuid(), readValidated: z.literal(true), issueWritePermissionVerified: z.literal(false) }).strict() }).strict();
type Summary = z.infer<typeof summarySchema>["data"];
type SitePage = { connectionId: string; revision: string; sites: z.infer<typeof siteSchema>[] };
type Work = "summary" | "sites" | "activate" | "consent";

export function trustedJiraConsentDestination(value: string): string | null {
 try {
  if (value.length > 8192) return null;
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname === "auth.atlassian.com" && url.pathname === "/authorize" && !url.username && !url.password && !url.port && !url.hash ? url.toString() : null;
 } catch { return null; }
}
function bounded<T>(work: Promise<T>, signal: AbortSignal, discard?: (value: T) => void): Promise<T> {
 return new Promise((resolve, reject) => {
  const abort = () => { signal.removeEventListener("abort", abort); reject(Error("request_unavailable")); };
  if (signal.aborted) reject(Error("request_unavailable")); else signal.addEventListener("abort", abort, { once: true });
  work.then(value => { signal.removeEventListener("abort", abort); if (signal.aborted) { discard?.(value); reject(Error("request_unavailable")); } else resolve(value); }, () => { signal.removeEventListener("abort", abort); reject(Error("request_unavailable")); });
 });
}
async function requestJson(url: string, signal: AbortSignal, maxBytes = 16_384, body?: unknown) {
 signal.throwIfAborted();
 const response = await bounded(fetch(url, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
  ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) }), signal, late => { void late.body?.cancel().catch(() => undefined); });
 const length = response.headers.get("content-length");
 if (!response.body || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" || length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) { void response.body?.cancel().catch(() => undefined); throw Error("response_unavailable"); }
 const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0, reads = 0;
 try {
  while (true) {
   if (++reads > maxBytes + 1) throw Error("response_unavailable");
   const next = await bounded(reader.read(), signal); if (next.done) break;
   bytes += next.value.byteLength; if (bytes > maxBytes) throw Error("response_unavailable");
   if (next.value.byteLength) chunks.push(next.value);
  }
  const result = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  signal.throwIfAborted();
  return { ok: response.ok, status: response.status, body: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(result)) as unknown };
 } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
async function savedSummary(signal: AbortSignal, afterId = ""): Promise<Summary> {
 const response = await requestJson(`/api/account/integrations/jira/connections${afterId ? `?afterId=${encodeURIComponent(afterId)}` : ""}`, signal);
 if (!response.ok) throw Error("summary_unavailable");
 const value = summarySchema.parse(response.body).data;
 if (afterId && value.nextAfterId === afterId) throw Error("summary_unavailable");
 return value;
}
function readableTime(value: string): string {
 return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
const buttonClass = "min-h-8 rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";
const selectClass = "mt-1 w-full min-w-0 rounded-lg border border-white/10 bg-[#191a1c] px-2 py-2 text-xs text-zinc-200";

/** scopeKey comes from the server-rendered organization/user, never grants authority. */
export function JiraSetupCard({ scopeKey, canManage }: { scopeKey: string; canManage: boolean }) {
 const [summary, setSummary] = useState<Summary | null>(null), [afterId, setAfterId] = useState("");
 const [connectionId, setConnectionId] = useState(""), [siteId, setSiteId] = useState("");
 const [sitePage, setSitePage] = useState<SitePage | null>(null);
 const [busy, setBusy] = useState<Work | null>(null), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
 const alive = useRef(false), generation = useRef(0), busyRef = useRef(false), controller = useRef<AbortController | null>(null);
 const clearSelection = useCallback(() => { setConnectionId(""); setSiteId(""); setSitePage(null); }, []);
 const run = useCallback(async (kind: Work, work: (signal: AbortSignal, current: () => boolean) => Promise<void>) => {
  if (!alive.current || busyRef.current) return;
  const id = ++generation.current, abort = new AbortController(); controller.current = abort; busyRef.current = true;
  const current = () => alive.current && generation.current === id;
  setBusy(kind); setError(null); setNotice(null);
  const timer = setTimeout(() => abort.abort(), 20_000);
  try { await work(abort.signal, current); }
  catch { if (current()) { if (kind === "activate") { setSummary(null); setConnectionId(""); setSiteId(""); setSitePage(null); } setError(kind === "activate" ? "Read validation was not confirmed. Reload saved status before trying again; it may have completed." : kind === "sites" ? "Jira sites could not be loaded. Reload saved status before trying again." : kind === "consent" ? "Jira consent could not be started. Reload saved status before trying again." : "Jira connection records are unavailable. Reload saved status."); } }
  finally { clearTimeout(timer); abort.abort(); if (current()) { busyRef.current = false; controller.current = null; setBusy(null); } }
 }, []);
 const reload = useCallback((cursor = "") => {
  if (busyRef.current) return;
  clearSelection(); setSummary(null);
  return run("summary", async (signal, current) => { const value = await savedSummary(signal, cursor); if (current()) { setSummary(value); setAfterId(cursor); } });
 }, [clearSelection, run]);
 useEffect(() => {
  alive.current = true; generation.current++; controller.current?.abort(); busyRef.current = false; controller.current = null;
  setSummary(null); setAfterId(""); clearSelection(); setBusy(null); setError(null); setNotice(null);
  if (canManage) void reload();
  return () => { alive.current = false; generation.current++; controller.current?.abort(); controller.current = null; busyRef.current = false; };
 }, [scopeKey, canManage, clearSelection, reload]);
 const selected = summary?.connections.find(row => row.connectionId === connectionId);
 const selectedSite = sitePage?.connectionId === selected?.connectionId && sitePage?.revision === selected?.revision ? sitePage?.sites.find(site => site.id === siteId) : undefined;
 function loadSites() {
  if (!selected || selected.recordedState !== "consent_recorded" || !summary?.serverConfigured || busyRef.current) return;
  const connection = selected; setSitePage(null); setSiteId("");
  void run("sites", async (signal, current) => {
   const response = await requestJson(`/api/account/integrations/jira/sites?connectionId=${encodeURIComponent(connection.connectionId)}&revision=${encodeURIComponent(connection.revision)}`, signal, 262_144);
   if (!response.ok) throw Error("sites_unavailable");
   const value = sitesSchema.parse(response.body).data;
   if (value.revision !== connection.revision) throw Error("sites_unavailable");
   if (current()) setSitePage({ connectionId: connection.connectionId, ...value });
  });
 }
 function activate() {
  if (!selected || !selectedSite || selected.recordedState !== "consent_recorded" || !summary?.serverConfigured || busyRef.current) return;
  const connection = selected, site = selectedSite;
  void run("activate", async (signal, current) => {
   const response = await requestJson("/api/account/integrations/jira/activate", signal, 16_384, { connectionId: connection.connectionId, revision: connection.revision, siteId: site.id });
   const unknown = response.status === 409 && typeof response.body === "object" && response.body !== null && (response.body as {error?: unknown}).error === "jira_read_activation_outcome_unknown";
   if (!response.ok && !unknown) throw Error("activation_unconfirmed");
   if (!unknown) { const result = activationSchema.parse(response.body).data; if (result.connectionId !== connection.connectionId || result.cloudId !== site.id) throw Error("activation_unconfirmed"); }
   if (!current()) return;
   clearSelection(); setSummary(null);
   setNotice(unknown ? "The read-validation outcome is not confirmed. Saved status is being reloaded; no request will be repeated." : "Read validation was recorded. Reloading saved status.");
   const value = await savedSummary(signal);
   if (current()) { setSummary(value); setAfterId(""); setNotice(unknown ? "The read-validation outcome is not confirmed. Saved status was reloaded; no request was repeated." : "Read validation recorded. Current health is not checked."); }
  });
 }
 function connect() {
  if (!summary?.serverConfigured || !summary.canStartConsent || busyRef.current) return;
  void run("consent", async (signal, current) => {
   const response = await requestJson("/api/account/integrations/jira/start", signal, 16_384, {});
   if (!response.ok) throw Error("consent_unavailable");
   const result = z.object({ok:z.literal(true),data:z.object({consentUrl:z.string().max(8192),expiresAt:instant}).strict()}).strict().parse(response.body);
   const destination = trustedJiraConsentDestination(result.data.consentUrl);
   if (!destination) throw Error("consent_unavailable");
   if (current()) window.location.assign(destination);
  });
 }
 return <article aria-labelledby="jira-setup-title" className="relative min-h-[118px] min-w-0 rounded-2xl bg-[#111111] p-3.5">
  <div className="flex items-center gap-2.5"><ProviderLogo provider="jira" /><h2 id="jira-setup-title" className="text-[13px] font-medium text-zinc-100">Jira</h2></div>
  <p className="mt-1 text-xs leading-5 text-zinc-500">Choose a Jira Cloud site and record a read-only validation.</p>
  <p className="mt-1 text-[11px] leading-5 text-zinc-500">Current health is not checked. Issue creation, updates and closing are unavailable.</p>
  {!canManage ? <p className="mt-3 text-xs text-zinc-400">A workspace owner or administrator must continue Jira setup.</p> : <div className="mt-3 space-y-3">
   {busy && <p role="status" className="text-xs text-zinc-400">{busy === "summary" ? "Loading saved Jira records…" : busy === "sites" ? "Loading Jira sites…" : busy === "activate" ? "Recording read validation…" : "Starting Jira consent…"}</p>}
   {summary && <>
    {!summary.serverConfigured && <p className="text-xs text-zinc-400">Jira service setup is required before connection setup can continue.</p>}
    {summary.connections.length === 0 ? <>
     <p className="text-xs leading-5 text-zinc-400">No connection records are shown for your account on this page. Another administrator may own the workspace connection.</p>
     {summary.serverConfigured && !summary.canStartConsent && <p className="text-xs leading-5 text-zinc-400">An existing workspace Jira record requires its consenting administrator. Recovery and reconnect are unavailable here.</p>}
    </> : <>
     <label className="block text-xs text-zinc-400">Jira connection<select aria-label="Jira connection" className={selectClass} value={connectionId} disabled={busy !== null} onChange={event => { setConnectionId(event.target.value); setSitePage(null); setSiteId(""); }}><option value="">Choose a connection</option>{summary.connections.map((row, index) => <option key={row.connectionId} value={row.connectionId}>Connection {index + 1} · {row.recordedState === "consent_recorded" ? "Consent recorded" : "Read validation recorded"} · {readableTime(row.revision)}</option>)}</select></label>
     {summary.connections.filter(row => row.recordedState === "read_validation_recorded").map(row => <p key={row.connectionId} className="break-all text-xs leading-5 text-zinc-400"><span>Read validation recorded</span> · <time dateTime={row.lastValidatedAt!}>{readableTime(row.lastValidatedAt!)}</time></p>)}
     {summary.connections.some(row => row.recordedState === "consent_recorded") && <button type="button" className={buttonClass} disabled={busy !== null || !summary.serverConfigured || selected?.recordedState !== "consent_recorded"} onClick={loadSites}>Load Jira sites</button>}
    </>}
    {summary.serverConfigured && summary.canStartConsent && <button type="button" className={buttonClass} disabled={busy !== null} onClick={connect}>Connect Jira</button>}
    {summary.hasMore && <div className="space-y-2"><p className="text-xs text-zinc-500">More of your connection records are available. This page is not a complete workspace inventory.</p><button type="button" className={buttonClass} disabled={busy !== null} onClick={() => void reload(summary.nextAfterId!)}>Next connection page</button></div>}
    {afterId && <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => void reload()}>First connection page</button>}
   </>}
   {sitePage && (sitePage.sites.length ? <>
    <label className="block text-xs text-zinc-400">Jira site<select aria-label="Jira site" className={selectClass} value={siteId} disabled={busy !== null} onChange={event => setSiteId(event.target.value)}><option value="">Choose a site</option>{sitePage.sites.map(site => <option key={site.id} value={site.id}>{site.name} — {site.url}</option>)}</select></label>
    <button type="button" className={buttonClass} disabled={busy !== null || !selectedSite || !summary?.serverConfigured} onClick={activate}>Record read validation</button>
   </> : <p className="text-xs text-zinc-400">No readable Jira sites were returned for this consent. Reload saved status to review setup.</p>)}
   {notice && <p role="status" className="text-xs leading-5 text-zinc-400">{notice}</p>}
   {error && <p role="alert" className="text-xs leading-5 text-rose-300">{error}</p>}
   <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => void reload()}>Reload saved status</button>
  </div>}
 </article>;
}
