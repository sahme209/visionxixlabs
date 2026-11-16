import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("next-auth", () => ({ default: () => m.handler }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
import { GET } from "../[...nextauth]/route";
import { googleLinkContext } from "@/lib/auth/googleLinkContext";
const origin = "https://canonical.invalid";
const context = { params: Promise.resolve({ nextauth: ["callback", "google"] }) };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NEXTAUTH_URL", origin); vi.stubEnv("NEXTAUTH_SECRET", "synthetic-test-secret"); });
function request(callback: string) { return new Request(`${origin}/api/auth/callback/google`, { headers: { host: "canonical.invalid", cookie: `__Secure-next-auth.callback-url=${encodeURIComponent(callback)}` } }); }
it("isolates pending response cookies and original navigation context across interleaved callbacks", async () => {
  let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
  m.handler.mockImplementation(async () => {
    const scope = googleLinkContext.getStore()!;
    if (scope.callbackPath.includes("first")) { scope.pendingCookie = "a".repeat(43); await waiting; }
    else { scope.pendingCookie = "b".repeat(43); release(); }
    return new Response(scope.callbackPath);
  });
  const [a, b] = await Promise.all([GET(request("/desktop/connect?challenge=first"), context), GET(request("/desktop/connect?challenge=second"), context)]);
  expect(await a.text()).toContain("challenge=first"); expect(await b.text()).toContain("challenge=second");
  expect(a.headers.get("set-cookie")).toContain("a".repeat(43)); expect(b.headers.get("set-cookie")).toContain("b".repeat(43));
  expect(a.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Lax"); expect(a.headers.get("set-cookie")).toContain("Secure");
});
it("never forwards external callback hints, and can clear a prior intent on a new attempt", async () => {
  m.handler.mockImplementation(async () => { const scope = googleLinkContext.getStore()!; expect(scope.callbackPath).toBe("/dashboard"); scope.pendingCookie = ""; return new Response("safe"); });
  const response = await GET(request("https://attacker.invalid/?secret=private"), context);
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0"); expect(await response.text()).toBe("safe");
});
it("keeps thrown provider/native errors and cookies out of logs and public responses", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  m.handler.mockRejectedValue(new Error("PRIVATE_TOKEN=profile-cookie-native-password"));
  try {
    const response = await GET(request("/desktop/connect?challenge=original"), context);
    expect(response.status).toBe(503); expect(JSON.stringify(spy.mock.calls)).toBe('[["[NextAuth] request_unavailable"]]');
    expect(await response.text()).not.toContain("PRIVATE_TOKEN");
  } finally { spy.mockRestore(); }
});
