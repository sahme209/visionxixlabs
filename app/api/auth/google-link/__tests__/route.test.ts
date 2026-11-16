import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ active: vi.fn(), csrf: vi.fn(), send: vi.fn(), confirm: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth/googleIdentity", () => ({ activeGoogleLink: m.active, validGoogleLinkCsrf: m.csrf, sendGoogleLinkCode: m.send, confirmGoogleLink: m.confirm }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: m.rate }));
import { GET, POST } from "../route";
const nonce = "n".repeat(43);
const origin = "https://canonical.invalid";
function request(body: object = { action: "confirm", csrf: "csrf", code: "code" }, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/auth/google-link`, { method: "POST", headers: { host: "canonical.invalid", origin, cookie: `__Host-axiom.google_identity_link.v1=${nonce}`, "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NEXTAUTH_URL", origin);
  m.active.mockResolvedValue({ id: "intent", email: "owner@example.test", callbackPath: "/desktop/connect?challenge=original" });
  m.csrf.mockReturnValue(true); m.rate.mockReturnValue(true); m.confirm.mockResolvedValue("linked"); m.send.mockResolvedValue("code_sent");
});
it("GET rederives same-origin form proof without an identity mutation", async () => {
  const response = await GET(new Request(`${origin}/api/auth/google-link`, { headers: { host: "canonical.invalid", cookie: `__Host-axiom.google_identity_link.v1=${nonce}` } }));
  expect(response.status).toBe(200); expect((await response.json()).csrf).toMatch(/^[\w-]{43}$/);
  expect(response.headers.get("cache-control")).toBe("no-store"); expect(m.send).not.toHaveBeenCalled(); expect(m.confirm).not.toHaveBeenCalled();
});
it.each<Record<string, string>>([{ origin: "https://attacker.invalid" }, { origin: "null" }, { host: "alias.invalid" }, { cookie: "" }])("rejects wrong origin/host/browser before proof work %j", async headers => {
  expect((await POST(request(undefined, headers))).status).toBeGreaterThanOrEqual(400);
  expect(m.confirm).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled();
});
it("refuses missing CSRF, expired intents and over-limit requests", async () => {
  m.csrf.mockReturnValue(false); expect((await POST(request())).status).toBe(409);
  m.csrf.mockReturnValue(true); m.active.mockResolvedValue(null); expect((await POST(request())).status).toBe(409);
  m.rate.mockReturnValue(false); expect((await POST(request())).status).toBe(429); expect(m.confirm).not.toHaveBeenCalled();
});
it("rejects oversized/unknown action bodies without database/proof work", async () => {
  expect((await POST(request({ action: "confirm", csrf: "x".repeat(5000) }))).status).toBe(400);
  expect((await POST(request({ action: "invented" }))).status).toBe(400); expect(m.active).not.toHaveBeenCalled();
});
it("returns original callback only after atomic linking and clears browser capability; never mints a session", async () => {
  const response = await POST(request()); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ result: "linked", callbackUrl: "/desktop/connect?challenge=original" });
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0"); expect(response.headers.get("set-cookie")).toContain("HttpOnly"); expect(response.headers.get("set-cookie")).not.toContain("next-auth");
});
it("mail absence and native failure return only fixed metadata", async () => {
  m.send.mockResolvedValue("delivery_unavailable"); const absent = await POST(request({ action: "send_code", csrf: "csrf" }));
  expect(absent.status).toBe(503); expect(await absent.json()).toEqual({ result: "delivery_unavailable" });
  m.confirm.mockRejectedValue(new Error("SECRET=raw-cookie-private-sql")); const failed = await POST(request());
  expect(failed.status).toBe(503); expect(await failed.json()).toEqual({ error: "google_link_unavailable" });
});
