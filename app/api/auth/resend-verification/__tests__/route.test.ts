import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ findUser: vi.fn(), deleteTokens: vi.fn(), createToken: vi.fn(), transaction: vi.fn(), send: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUser }, emailVerificationToken: { deleteMany: mocks.deleteTokens, create: mocks.createToken }, $transaction: mocks.transaction } }));
vi.mock("@/lib/auth/emailVerification", () => ({ issueEmailVerificationToken: () => ({ token: "private-proof", tokenHash: "hash", expiresAt: new Date("2030-01-01") }), sendEmailVerification: mocks.send }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.rate }));
import { POST } from "../route";
const request = (callbackUrl: unknown = "/desktop/connect?challenge=pair_123") => new NextRequest("https://example.test/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email: " Person@Example.Test ", callbackUrl }) });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.findUser.mockResolvedValue({ id: "user-1", email: "person@example.test", passwordHash: "hash", emailVerifiedAt: null });
  mocks.rate.mockReturnValue(true); mocks.transaction.mockResolvedValue([]); mocks.send.mockResolvedValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("account-neutral verification recovery", () => {
  it("reuses the existing unused-token replacement and carries only sanitized navigation", async () => {
    const response = await POST(request());
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.findUser).toHaveBeenCalledWith({ where: { email: "person@example.test" } });
    expect(mocks.deleteTokens).toHaveBeenCalledWith({ where: { userId: "user-1", usedAt: null } });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledWith({ to: "person@example.test", token: "private-proof", callbackUrl: "/desktop/connect?challenge=pair_123" });
  });
  it.each([null, { passwordHash: null }, { passwordHash: "hash", emailVerifiedAt: new Date() }])("does not disclose or mutate a non-pending account", async (user) => {
    mocks.findUser.mockResolvedValue(user);
    expect(await (await POST(request())).json()).toEqual({ ok: true });
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each(["rejected", "throws", "store"])("keeps account-specific %s failure neutral without logging secrets", async (failure) => {
    if (failure === "rejected") mocks.send.mockResolvedValue(false);
    if (failure === "throws") mocks.send.mockRejectedValue(new Error("private-proof person@example.test secret"));
    if (failure === "store") mocks.findUser.mockRejectedValue(new Error("private user details"));
    const response = await POST(request());
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private-proof|person@example|secret|private user/);
  });
  it("drops external callback without changing delivery eligibility", async () => {
    await POST(request("https://evil.test"));
    expect(mocks.send).toHaveBeenCalledWith({ to: "person@example.test", token: "private-proof" });
  });
  it("reports globally missing delivery configuration without inspecting any account", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await POST(request())).status).toBe(503); expect(mocks.findUser).not.toHaveBeenCalled();
  });
  it("retains neutral rate-limit denial without account access", async () => {
    mocks.rate.mockReturnValue(false);
    expect(await (await POST(request())).json()).toEqual({ ok: true }); expect(mocks.findUser).not.toHaveBeenCalled();
  });
});
