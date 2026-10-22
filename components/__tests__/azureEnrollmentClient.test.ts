import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ config: { apiBase: "https://visionxixlabs.com", sessionToken: "axm.desk.fixture" as string | undefined } }));
vi.mock("@/desktop/src/lib/desktopClient", () => ({ desktopClient: mocks }));
import { azureEnrollmentClient } from "@/desktop/src/lib/azureEnrollmentClient";
const account = { id: "azure-account", provider: "azure", subscriptionId: "22222222-2222-4222-8222-222222222222", connected: true, status: "connected", connectionVersion: 1, lastValidatedAt: "2026-10-16T12:00:00Z", revokedAt: null, enabled: false, agentScanAvailable: false, inventoryAvailability: "not_checked" };
afterEach(() => { vi.unstubAllGlobals(); mocks.config.sessionToken = "axm.desk.fixture"; });
it("uses paired bearer and omits cookies on the Azure-specific native API", async () => { const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { accounts: [account] } }))); vi.stubGlobal("fetch", fetch); expect(await azureEnrollmentClient.list()).toMatchObject({ ok: true, data: { accounts: [account] } }); expect(fetch).toHaveBeenCalledWith("https://visionxixlabs.com/api/desktop/cloud/azure/accounts", expect.objectContaining({ credentials: "omit", headers: expect.objectContaining({ Authorization: "Bearer axm.desk.fixture" }) })); });
it("rejects API keys without sending credentials", async () => { mocks.config.sessionToken = "vxlk_fixture"; const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); expect((await azureEnrollmentClient.list()).ok).toBe(false); expect(fetch).not.toHaveBeenCalled(); });
it("rejects malformed account data and secret-echo error text", async () => { const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { accounts: [{ ...account, clientSecret: "malicious" }] } }))).mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, message: "secret-echo-value", error: "secret-echo-value" }), { status: 503 })); vi.stubGlobal("fetch", fetch); expect((await azureEnrollmentClient.list()).ok).toBe(false); const r = await azureEnrollmentClient.list(); expect(r.ok).toBe(false); expect(JSON.stringify(r)).not.toContain("secret-echo-value"); });
it("refuses mismatched enrollment and disconnect receipts without automatic replay", async () => { const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { account } }))); vi.stubGlobal("fetch", fetch); const r = await azureEnrollmentClient.enroll({ tenantId: "11111111-1111-4111-8111-111111111111", subscriptionId: account.subscriptionId, clientId: "33333333-3333-4333-8333-333333333333", clientSecret: "fixture", expectedVersion: 2 }); expect(r.ok).toBe(false); expect(fetch).toHaveBeenCalledTimes(1); expect((await azureEnrollmentClient.disconnect(account.id, 1)).ok).toBe(false); });

it.each([
  { status: 401, body: JSON.stringify({ ok: false, error: "desktop_session_required", message: "private server detail" }) },
  { status: 401, body: "private non-JSON gateway body" },
  { status: 401, body: JSON.stringify({ ok: true, data: { accounts: [account] } }) },
  { status: 403, body: JSON.stringify({ ok: false, error: "desktop_session_required" }) },
])("identifies expired/unavailable pairing safely without replay: %j", async ({status, body}) => {
  const fetch = vi.fn().mockResolvedValue(new Response(body, { status }));
  vi.stubGlobal("fetch", fetch);
  const result = await azureEnrollmentClient.list();
  expect(result).toEqual({ ok: false, error: "Your paired desktop session could not be authorized. Sign in again to refresh workspace access, then refresh Azure connection state." });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).not.toContain("private");
});
it("distinguishes the known unavailable service/storage code without claiming a missing migration", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "enrollment_unavailable", message: "private database exception" }), { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  const result = await azureEnrollmentClient.list();
  expect(result).toEqual({ ok: false, error: "The Azure connection service or its required storage is unavailable. Refresh connection state before trying again; contact your workspace administrator if this continues." });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).not.toContain("private");
});

it.each(["__proto__", "constructor", "toString", "unknown_code"])("keeps unknown or inherited error codes bounded: %s", async error => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error, message: "private provider detail" }), { status: 503 })));
  expect(await azureEnrollmentClient.list()).toEqual({ ok: false, error: "Azure connection service is unavailable. Refresh connection state before trying again." });
});
