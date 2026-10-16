import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { rehearseLocalDesktopPairingHttp } from "../../scripts/rehearse-local-desktop-pairing-http.mjs";
const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });
const challenge = `pair_${"a".repeat(43)}`;
const identity = { kind: "desktop_session", organizationId: `ws_${"b".repeat(16)}`, email: "fixture-customer@example.test", role: "owner" };
async function fixture(mode = "normal") {
  let approved = false, consumed = false, revoked = false;
  const requests: Array<{ path: string; cookie?: string; authorization?: string }> = [];
  const token = "axm.desk.synthetic-session.synthetic-signature";
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://127.0.0.1");
    requests.push({ path: url.pathname, cookie: req.headers.cookie, authorization: req.headers.authorization });
    const reply = (status: number, body = {}) => { res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body)); };
    let text = ""; for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : {};
    if (url.pathname === "/api/desktop/pair/status") {
      if (!body.deviceFingerprint) return reply(426);
      if (body.deviceFingerprint !== "isolated-http-fixture") return reply(403);
      if (!approved) return reply(202);
      if (consumed && mode !== "replay") return reply(409);
      consumed = true; return reply(200, { status: "approved", token, session: { id: "synthetic-session", status: "active" } });
    }
    if (url.pathname === "/api/desktop/pair/approve") {
      if (req.headers.cookie !== "fixture-web-session=accepted") return reply(401);
      if (req.method === "GET") return reply(200, { workspace: { email: identity.email }, request: { status: "pending" } });
      approved = true; return reply(200, { status: "approved" });
    }
    if (url.pathname === "/api/desktop/access") {
      if (req.headers.authorization !== `Bearer ${token}` || (revoked && mode !== "revoked")) return reply(401);
      return reply(200, { data: { identity: { ...identity, organizationId: mode === "workspace" ? "other-workspace" : identity.organizationId }, access: { allowed: true, code: "active", billingStatus: "no_plan" } } });
    }
    if (url.pathname === "/api/desktop/session") {
      if (req.headers.cookie !== "fixture-web-session=accepted") return reply(401);
      if (req.method === "DELETE") { revoked = true; return reply(200, { data: { revoked: "synthetic-session" } }); }
      return reply(200, { data: { sessions: [{ id: "synthetic-session", status: "active" }] } });
    }
    reply(404);
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const appOrigin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const webRequest = (path: string, options: RequestInit = {}) => fetch(new URL(path, appOrigin), { ...options, headers: { ...options.headers, cookie: "fixture-web-session=accepted" }, redirect: "manual" });
  return { input: { appOrigin, webRequest, challenge, deviceFingerprint: "isolated-http-fixture", expectedWorkspace: identity.organizationId, email: identity.email }, requests, token };
}
describe("local pairing HTTP harness protocol and safety", () => {
  it("uses real loopback HTTP with separate web-cookie and bearer channels and reports observations honestly", async () => {
    const { input, requests, token } = await fixture();
    const result = await rehearseLocalDesktopPairingHttp(input);
    expect(result.verified).toContain("owner_revocation_invalidates_bearer");
    expect(result.commercialAccessObservation).toEqual({ allowed: true, code: "active", billingStatus: "no_plan", enforcement: "not_verified_policy_decision_required" });
    expect(result.notVerified).toContain("billing_enforcement");
    for (const request of requests.filter(entry => ["/api/desktop/pair/status", "/api/desktop/access"].includes(entry.path))) expect(request.cookie).toBeUndefined();
    expect(requests.some(entry => entry.path.includes("cloud") || entry.path.includes("deploy"))).toBe(false);
    expect(JSON.stringify(result)).not.toContain(token); expect(JSON.stringify(result)).not.toContain(challenge); expect(JSON.stringify(result)).not.toContain("synthetic-session");
  });
  it.each([["workspace", "paired_workspace_mismatch"], ["replay", "pairing_replay_must_fail"], ["revoked", "revoked_pairing_must_fail"]])("detects protocol failure %s rather than reporting acceptance", async (mode, label) => {
    const { input } = await fixture(mode); await expect(rehearseLocalDesktopPairingHttp(input)).rejects.toThrow(label);
  });
  it.each(["https://production.invalid", "http://localhost:3000", "http://127.0.0.1:3000/path", "http://user:password@127.0.0.1:3000"])("refuses non-isolated origin %s before requests", async appOrigin => {
    let called = false;
    await expect(rehearseLocalDesktopPairingHttp({ appOrigin, webRequest: async () => { called = true; return new Response(); }, challenge, deviceFingerprint: "isolated-http-fixture", expectedWorkspace: identity.organizationId, email: identity.email })).rejects.toThrow("pairing_loopback_origin_required");
    expect(called).toBe(false);
  });
});
it("runs an explicit lifecycle callback while bearer is active, then retains original revocation checks", async () => {
  const { input, token } = await fixture();
  let called = false;
  const result = await rehearseLocalDesktopPairingHttp({ ...input, onPaired: async ({ token: actual, deviceRequest }: { token: string; deviceRequest: (path: string, options: { token: string }) => Promise<Response> }) => {
    expect(actual).toBe(token); called = true;
    expect((await deviceRequest("/api/desktop/access", { token: actual })).status).toBe(200);
    return { verified: ["synthetic_callback"] };
  } });
  expect(called).toBe(true); expect(result.cloudLifecycle).toEqual({ verified: ["synthetic_callback"] });
  expect(result.verified).toContain("owner_revocation_invalidates_bearer");
  expect(JSON.stringify(result)).not.toContain(token);
});
