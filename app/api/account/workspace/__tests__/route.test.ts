import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ session: vi.fn(), member: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: m.member } } }));
import { POST } from "../route";
function request(origin = "https://axiom.invalid", organizationId = "shared") { return new NextRequest("https://axiom.invalid/api/account/workspace", { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ organizationId }) }); }
beforeEach(() => { vi.resetAllMocks(); m.session.mockResolvedValue({ user: { id: "member", email: "member@example.test" } }); m.member.mockResolvedValue({ acceptedAt: new Date() }); });
it("selects only an accepted membership and binds a secure preference to the signed-in identity", async () => {
 const response = await POST(request()); expect(response.status).toBe(303);
 expect(response.headers.get("location")).toBe("https://axiom.invalid/control");
 const cookie = response.cookies.get("axiom.workspace.v1")!;
 expect(JSON.parse(cookie.value)).toEqual({ userId: "member", organizationId: "shared" });
 expect(response.headers.get("set-cookie")).toContain("HttpOnly"); expect(response.headers.get("set-cookie")).toContain("Secure"); expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
 expect(m.member).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_organizationId: { userId: "member", organizationId: "shared" } } }));
});
it.each([null, { acceptedAt: null }])("refuses missing or pending membership %j", async membership => { m.member.mockResolvedValue(membership); const response = await POST(request()); expect(response.status).toBe(403); expect(response.headers.get("set-cookie")).toBeNull(); });
it("fails closed when membership cannot be verified", async () => { m.member.mockRejectedValue(new Error("unavailable")); const response = await POST(request()); expect(response.status).toBe(503); expect(response.headers.get("set-cookie")).toBeNull(); });
it("rejects cross-origin selection before querying the identity", async () => { expect((await POST(request("https://other.invalid"))).status).toBe(403); expect(m.session).not.toHaveBeenCalled(); });
it("requires a stable authenticated user ID rather than an email fallback", async () => { m.session.mockResolvedValue({ user: { email: "member@example.test" } }); expect((await POST(request())).status).toBe(401); expect(m.member).not.toHaveBeenCalled(); });
it("rejects malformed workspace IDs", async () => { expect((await POST(request("https://axiom.invalid", "../other"))).status).toBe(400); expect(m.member).not.toHaveBeenCalled(); });
