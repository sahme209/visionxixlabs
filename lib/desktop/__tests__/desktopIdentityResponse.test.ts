import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopClient } from "../../../desktop/src/lib/desktopClient";

const identity = { kind: "desktop_session", organizationId: "org-1", role: "operator", capabilities: ["pipeline:read"] };
const access = { allowed: true, code: "active", title: "Access active", message: "Workspace connected", planTier: "pilot", billingStatus: "active", accessRequestPath: "/contact", pricingPath: "/plans" };
const client = () => new DesktopClient({ apiBase: "https://service.example.test", sessionToken: "axm.desk.fixture" });
function respond(data: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data }), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => vi.unstubAllGlobals());

describe("desktop startup identity response boundary", () => {
  it("rejects a non-success HTTP response even when its body claims success", async () => {
    respond({ identity, access }, 503);
    expect(await client().verifyCurrentCredential()).toEqual({ ok: false, error: "HTTP 503" });
  });

  it.each([
    {}, { identity: null, access }, { identity, access: null },
    { identity: { ...identity, organizationId: "" }, access },
    { identity: { ...identity, kind: "browser" }, access },
    { identity: { ...identity, role: "superuser" }, access },
    { identity: { ...identity, capabilities: "pipeline:read" }, access },
    { identity: { ...identity, capabilities: [3] }, access },
    { identity, access: { ...access, allowed: "false" } },
    { identity, access: { ...access, code: "unknown" } },
    { identity, access: { ...access, title: null } },
    { identity: { ...identity, organizationId: "  " }, access },
    { identity: { ...identity, kind: ["desktop_session"] }, access },
    { identity: { ...identity, role: ["operator"] }, access },
    { identity: { ...identity, email: 5 }, access },
    { identity, access: { ...access, code: ["active"] } },
    { identity, access: { ...access, allowed: 1 } },
    { identity, access: { ...access, cancelAtPeriodEnd: "false" } },
  ])("returns an actionable failure for malformed identity/access %#", async (data) => {
    respond(data);
    await expect(client().verifyCurrentCredential()).resolves.toEqual({ ok: false, error: "The service returned an invalid workspace identity. Sign in again or contact support." });
  });

  it("preserves a verified identity with denied access as a separate state", async () => {
    respond({ identity, access: { ...access, allowed: false, code: "production_access_required" } });
    expect(await client().verifyCurrentCredential()).toMatchObject({ ok: true, data: { organizationId: "org-1", capabilities: ["pipeline:read"], access: { allowed: false } } });
  });

  it("preserves compatibility for absent optional capabilities", async () => {
    respond({ identity: { kind: "desktop_session", organizationId: "org-1" }, access });
    expect(await client().verifyCurrentCredential()).toMatchObject({ ok: true, data: { capabilities: [], access: { allowed: true } } });
  });

  it("does not accept a different credential kind from the service", async () => {
    respond({ identity: { ...identity, kind: "api_key" }, access });
    expect(await client().verifyCurrentCredential()).toMatchObject({ ok: false });
  });

  it("accepts the verified API-key identity only for an API-key credential", async () => {
    respond({ identity: { ...identity, kind: "api_key" }, access });
    const apiKeyClient = new DesktopClient({ apiBase: "https://service.example.test", sessionToken: "vxlk_fixture" });
    expect(await apiKeyClient.verifyCurrentCredential()).toMatchObject({ ok: true, data: { kind: "api_key" } });
  });
});
