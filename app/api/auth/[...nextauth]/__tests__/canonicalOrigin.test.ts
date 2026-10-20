import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("next-auth", () => ({ default: () => mocks.handler }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
import { GET, POST } from "../route";
const context = { params: Promise.resolve({ nextauth: ["signin", "google"] }) };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NEXTAUTH_SECRET", "synthetic-test-secret"); vi.stubEnv("NEXTAUTH_URL", "https://visionxixlabs.com");
  mocks.handler.mockResolvedValue(Response.json({ ok: true }));
});
afterEach(() => vi.unstubAllEnvs());
it.each(["csrf", "signin/google", "callback/google?code=private-code&state=private-state", "session", "signout"])("rejects noncanonical GET %s before cookies or callback processing", async (path) => {
  const response = await GET(new Request(`https://preview.vercel.app/api/auth/${path}`, { headers: { host: "preview.vercel.app" } }), context);
  expect(response.status).toBe(409);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("location")).toBeNull();
  expect(await response.text()).not.toMatch(/private-code|private-state/);
  expect(mocks.handler).not.toHaveBeenCalled();
});
it("never replays or reads a noncanonical credential POST", async () => {
  const request = new Request("https://preview.vercel.app/api/auth/callback/credentials", { method: "POST", headers: { host: "preview.vercel.app" }, body: "password=private-password" });
  const response = await POST(request, context);
  expect(response.status).toBe(409);
  expect(request.bodyUsed).toBe(false);
  expect(await response.text()).not.toContain("private-password");
  expect(mocks.handler).not.toHaveBeenCalled();
});
it("preserves canonical NextAuth processing and ignores hostile forwarded headers", async () => {
  const request = new Request("https://visionxixlabs.com/api/auth/callback/google", { headers: { host: "visionxixlabs.com", "x-forwarded-host": "evil.test" } });
  expect((await GET(request, context)).status).toBe(200);
  expect(mocks.handler).toHaveBeenCalledWith(request, context);
});
it("supports explicitly isolated loopback authentication", async () => {
  vi.stubEnv("NEXTAUTH_URL", "http://127.0.0.1:3000");
  expect((await GET(new Request("http://127.0.0.1:3000/api/auth/session", { headers: { host: "127.0.0.1:3000" } }), context)).status).toBe(200);
});
it("fails closed for invalid configuration", async () => {
  vi.stubEnv("NEXTAUTH_URL", "http://evil.test");
  expect((await GET(new Request("https://visionxixlabs.com/api/auth/session"), context)).status).toBe(503);
  expect(mocks.handler).not.toHaveBeenCalled();
});

it("allows canonical Host when Next reconstructs an internal listener URL", async () => {
  const request = new Request("http://127.0.0.1:8080/api/auth/session", { headers: { host: "visionxixlabs.com" } });
  expect((await GET(request, context)).status).toBe(200);
  expect(mocks.handler).toHaveBeenCalledWith(request, context);
});
it("rejects preview Host even if the adapter URL looks canonical", async () => {
  const request = new Request("https://visionxixlabs.com/api/auth/csrf", { headers: { host: "preview.vercel.app" } });
  expect((await GET(request, context)).status).toBe(409);
  expect(mocks.handler).not.toHaveBeenCalled();
});
it("rejects missing Host instead of inferring authority from the internal URL", async () => {
  expect((await GET(new Request("https://visionxixlabs.com/api/auth/session"), context)).status).toBe(409);
  expect(mocks.handler).not.toHaveBeenCalled();
});
