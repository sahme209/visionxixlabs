import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshJiraToken, JiraRefreshOutcomeUnknown } from "../jiraRefreshToken";
const NOW = Date.parse("2026-10-24T17:00:00.000Z");
const url = "https://auth.atlassian.com/oauth/token";
const response = (overrides: Record<string, unknown> = {}) => Response.json({ access_token: "NEW_ACCESS", refresh_token: "NEW_REFRESH", expires_in: 3600, scope: "read:jira-work offline_access", ...overrides });
const input = (transport: typeof fetch, overrides = {}) => ({ clientId: "client", clientSecret: "PRIVATE_APP_SECRET", refreshToken: "PRIVATE_OLD_REFRESH", approvedScopes: ["offline_access", "read:jira-work"], signal: new AbortController().signal, transport, now: () => NOW, ...overrides });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("bounded Jira rotating refresh-token exchange", () => {
 it("sends exactly one fixed request and returns internal tokens requiring persistence", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(response()); const result = await refreshJiraToken(input(transport));
  expect(transport).toHaveBeenCalledTimes(1); const [address, init] = transport.mock.calls[0];
  expect(address).toBe(url); expect(init).toMatchObject({ method: "POST", redirect: "error", credentials: "omit", cache: "no-store", headers: { accept: "application/json", "content-type": "application/json" }, signal: expect.any(AbortSignal) });
  expect(JSON.parse(String(init?.body))).toEqual({ grant_type: "refresh_token", client_id: "client", client_secret: "PRIVATE_APP_SECRET", refresh_token: "PRIVATE_OLD_REFRESH" });
  expect(result).toEqual({ accessToken: "NEW_ACCESS", refreshToken: "NEW_REFRESH", expiresAt: NOW + 3600000, scopes: ["read:jira-work", "offline_access"], persistenceRequired: true, connectionReadinessVerified: false });
  expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.scopes)).toBe(true);
 });
 it("retains the exact copied stored scope order if response scope is absent", async () => {
  const original = ["offline_access", "read:jira-work"]; const req = input(vi.fn().mockResolvedValue(response({ scope: undefined })), { approvedScopes: original });
  const result = await refreshJiraToken(req); original.reverse(); expect(result.scopes).toEqual(["offline_access", "read:jira-work"]);
 });
 it("permits a response narrowing to approved Jira read scope", async () => {
  const result = await refreshJiraToken(input(vi.fn().mockResolvedValue(response({ scope: "read:jira-work" })))); expect(result.scopes).toEqual(["read:jira-work"]);
 });
 it.each(["read:jira-work write:jira-work", "offline_access", "", "read:jira-work read:jira-work", "read:jira-work\noffline_access", null, ["read:jira-work"]])("rejects invalid or expanded response scope %j without retry", async scope => {
  const transport = vi.fn().mockResolvedValue(response({ scope })); await expect(refreshJiraToken(input(transport))).rejects.toBeInstanceOf(JiraRefreshOutcomeUnknown); expect(transport).toHaveBeenCalledTimes(1);
 });
 it("rejects an offline scope not present in trusted stored approval", async () => {
  const transport = vi.fn().mockResolvedValue(response()); await expect(refreshJiraToken(input(transport, { approvedScopes: ["read:jira-work"] }))).rejects.toBeInstanceOf(JiraRefreshOutcomeUnknown);
 });
 it.each([{ clientId: "" }, { clientId: "x\nclient" }, { clientSecret: "" }, { clientSecret: "x\rsecret" }, { refreshToken: "" }, { refreshToken: "x\nrefresh" }, { approvedScopes: [] }, { approvedScopes: ["offline_access"] }, { approvedScopes: ["read:jira-work", "manage:jira-project"] }, { approvedScopes: ["read:jira-work", "read:jira-work"] }, { now: () => NaN }])("refuses invalid trusted input before any transport %#", async overrides => {
  const transport = vi.fn(); await expect(refreshJiraToken(input(transport, overrides))).rejects.toThrow(/^jira_refresh_unavailable$/); expect(transport).not.toHaveBeenCalled();
 });
 it("has no ambient fetch fallback", async () => {
  const ambient = vi.spyOn(globalThis, "fetch"); await expect(refreshJiraToken(input(undefined as unknown as typeof fetch))).rejects.toThrow(/^jira_refresh_unavailable$/); expect(ambient).not.toHaveBeenCalled();
 });
 it.each([{ access_token: "" }, { access_token: "TOKEN\nINJECT" }, { refresh_token: undefined }, { refresh_token: null }, { refresh_token: "" }, { refresh_token: "PRIVATE_OLD_REFRESH" }, { expires_in: 0 }, { expires_in: 86401 }, { expires_in: 1.5 }, { expires_in: "3600" }, { token_type: "Basic" }])("refuses unusable or unrotated response %#", async overrides => {
  await expect(refreshJiraToken(input(vi.fn().mockResolvedValue(response(overrides))))).rejects.toMatchObject({ name: "JiraRefreshOutcomeUnknown", message: "jira_refresh_outcome_unknown", retryAllowed: false });
 });
 it.each([204, 302, 400, 401, 403, 429, 500])("never retries HTTP %s or reads raw error bodies", async status => {
  const res = new Response(status === 204 ? null : "PRIVATE_PROVIDER_BODY", { status }); const text = vi.spyOn(res, "text"); const transport = vi.fn().mockResolvedValue(res);
  await expect(refreshJiraToken(input(transport))).rejects.toThrow(/^jira_refresh_outcome_unknown$/); expect(transport).toHaveBeenCalledTimes(1); expect(text).not.toHaveBeenCalled();
 });
 it("sanitizes transport rejection even if it contains token text", async () => {
  const transport = vi.fn().mockRejectedValue(new Error("PRIVATE_APP_SECRET PRIVATE_OLD_REFRESH")); await expect(refreshJiraToken(input(transport))).rejects.toThrow(/^jira_refresh_outcome_unknown$/); expect(transport).toHaveBeenCalledTimes(1);
 });
 it.each([262144, 262145])("enforces exact aggregate UTF8 response bytes at %s", async bytes => {
  const base = JSON.stringify({ access_token: "NEW_ACCESS", refresh_token: "NEW_REFRESH", expires_in: 3600, ignored: "🚦" });
  const body = base.replace('"🚦"', JSON.stringify("🚦" + "x".repeat(bytes - Buffer.byteLength(base, "utf8")))); expect(Buffer.byteLength(body, "utf8")).toBe(bytes);
  const pending = refreshJiraToken(input(vi.fn().mockResolvedValue(new Response(body, { headers: { "content-type": "application/json" } }))));
  if (bytes === 262144) expect((await pending).persistenceRequired).toBe(true); else await expect(pending).rejects.toBeInstanceOf(JiraRefreshOutcomeUnknown);
 });
 it("rejects declared oversize, invalid UTF8 and non-JSON without leaking content", async () => {
  const responses = [new Response("{}", { headers: { "content-length": "262145", "content-type": "application/json" } }), new Response("{}", { headers: { "content-length": "bad", "content-type": "application/json" } }), new Response(new Uint8Array([255]), { headers: { "content-type": "application/json" } }), new Response("PRIVATE_HTML", { headers: { "content-type": "text/html" } })];
  for (const res of responses) await expect(refreshJiraToken(input(vi.fn().mockResolvedValue(res)))).rejects.toThrow(/^jira_refresh_outcome_unknown$/);
 });
 it("rejects redirected and mismatched final URL responses", async () => {
  for (const [property, value] of [["redirected", true], ["url", "https://evil.invalid"]] as const) { const res = response(); Object.defineProperty(res, property, { value }); await expect(refreshJiraToken(input(vi.fn().mockResolvedValue(res)))).rejects.toBeInstanceOf(JiraRefreshOutcomeUnknown); }
 });
 it("does not dispatch for an already aborted signal", async () => {
  const controller = new AbortController(); controller.abort(); const transport = vi.fn(); await expect(refreshJiraToken(input(transport, { signal: controller.signal }))).rejects.toThrow(/^jira_refresh_unavailable$/); expect(transport).not.toHaveBeenCalled();
 });
 it("aborts stalled transport with unknown outcome and cancels a late body", async () => {
  const controller = new AbortController(); let finish!: (res: Response) => void; const transport = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  const pending = refreshJiraToken(input(transport, { signal: controller.signal })); controller.abort(); await expect(pending).rejects.toBeInstanceOf(JiraRefreshOutcomeUnknown);
  const late = response(); const cancel = vi.spyOn(late.body!, "cancel"); finish(late); await Promise.resolve(); expect(cancel).toHaveBeenCalled(); expect(transport).toHaveBeenCalledTimes(1);
 });
 it.each(["headers", "body"])("enforces one total deadline for stalled %s", async stage => {
  vi.useFakeTimers(); const transport = stage === "headers" ? vi.fn(() => new Promise<Response>(() => {})) : vi.fn().mockResolvedValue(new Response(new ReadableStream({ start() {} }), { headers: { "content-type": "application/json" } }));
  const pending = refreshJiraToken(input(transport)); const rejected = expect(pending).rejects.toBeInstanceOf(JiraRefreshOutcomeUnknown);
  await vi.advanceTimersByTimeAsync(15001); await rejected; expect(transport).toHaveBeenCalledTimes(1);
 });
 it.each([NOW - 1, NOW + 3600000])("refuses backwards time or a token expiring during exchange: %s", async later => {
  let calls = 0; const clock = () => ++calls === 1 ? NOW : later;
  await expect(refreshJiraToken(input(vi.fn().mockResolvedValue(response()), { now: clock }))).rejects.toBeInstanceOf(JiraRefreshOutcomeUnknown);
 });
 it("copies caller inputs and authority references before the first await", async () => {
  const transport = vi.fn<typeof fetch>(); const req = input(transport); transport.mockImplementation(async () => { req.clientSecret = "MUTATED"; req.refreshToken = "MUTATED"; req.approvedScopes.push("write:jira-work"); req.now = () => NOW + 9999999; req.signal = new AbortController().signal; return response({ scope: undefined }); });
  const result = await refreshJiraToken(req); expect(result.scopes).toEqual(["offline_access", "read:jira-work"]); expect(result.expiresAt).toBe(NOW + 3600000);
 });
});
it('retains a previously consented ticket-write scope but cannot add it to a read-only grant',async()=>{const scopes=['read:jira-work','write:jira-work','offline_access'];const transport=vi.fn<typeof fetch>().mockResolvedValue(response({scope:scopes.join(' ')}));await expect(refreshJiraToken(input(transport,{approvedScopes:scopes}))).resolves.toMatchObject({scopes});await expect(refreshJiraToken(input(transport))).rejects.toThrow()});

it('preserves previously approved profile scope but never acquires it during refresh',async()=>{const transport=vi.fn<typeof fetch>().mockResolvedValue(response({scope:'read:jira-work write:jira-work offline_access read:me'}));const approvedScopes=['read:jira-work','write:jira-work','offline_access','read:me'];await expect(refreshJiraToken(input(transport,{approvedScopes}))).resolves.toMatchObject({scopes:approvedScopes});transport.mockClear();await expect(refreshJiraToken(input(transport,{approvedScopes:['read:jira-work','write:jira-work','offline_access']}))).rejects.toBeInstanceOf(JiraRefreshOutcomeUnknown);expect(transport).toHaveBeenCalledTimes(1)});
