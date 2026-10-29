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
const issued=Date.parse('2026-10-24T12:00:00.000Z');
const handoff=()=>({organizationId:'shared',returnIntent:'members_handoff',destination:'members',expectedUserId:'member',membershipAcceptedAt:'2026-10-20T12:00:00.000Z',membershipUpdatedAt:'2026-10-21T12:00:00.000Z',issuedAt:new Date(issued).toISOString(),expiresAt:new Date(issued+300000).toISOString()});
function handoffRequest(extra:Record<string,string>={}){return new NextRequest('https://axiom.invalid/api/account/workspace',{method:'POST',headers:{origin:'https://axiom.invalid','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...handoff(),...extra})});}
it('returns an explicit advisory selection only to revalidated control/open and never an arbitrary URL',async()=>{vi.spyOn(Date,'now').mockReturnValue(issued);m.member.mockResolvedValue({acceptedAt:new Date(handoff().membershipAcceptedAt),updatedAt:new Date(handoff().membershipUpdatedAt)});try{const response=await POST(handoffRequest());expect(response.headers.get('location')).toMatch(/^https:\/\/axiom.invalid\/workspace-handoff\?/);expect(response.headers.get('set-cookie')).toContain('axiom.workspace.v1');expect((await POST(handoffRequest({destination:'https://evil.test'}))).headers.get('set-cookie')).toBeNull();}finally{vi.restoreAllMocks();}});
it('rejects changed browser identity before target membership reads and any cookie mutation',async()=>{vi.spyOn(Date,'now').mockReturnValue(issued);try{const response=await POST(handoffRequest({expectedUserId:'other'}));expect(response.status).toBe(403);expect(m.member).not.toHaveBeenCalled();expect(response.headers.get('set-cookie')).toBeNull();}finally{vi.restoreAllMocks();}});
it('rechecks current session, membership revision and deadline at the cookie-write boundary',async()=>{vi.spyOn(Date,'now').mockReturnValue(issued);const good={acceptedAt:new Date(handoff().membershipAcceptedAt),updatedAt:new Date(handoff().membershipUpdatedAt)};try{m.member.mockImplementation(async()=>{vi.mocked(Date.now).mockReturnValue(issued+300000);return good;});expect((await POST(handoffRequest())).headers.get('set-cookie')).toBeNull();vi.mocked(Date.now).mockReturnValue(issued);m.member.mockResolvedValue(good);m.session.mockResolvedValueOnce({user:{id:'member',email:'m@e.test'}}).mockResolvedValue({user:{id:'other',email:'o@e.test'}});expect((await POST(handoffRequest())).headers.get('set-cookie')).toBeNull();m.session.mockResolvedValue({user:{id:'member',email:'m@e.test'}});m.member.mockResolvedValueOnce(good).mockResolvedValue({...good,updatedAt:new Date(issued)});expect((await POST(handoffRequest())).headers.get('set-cookie')).toBeNull();}finally{vi.restoreAllMocks();}});
