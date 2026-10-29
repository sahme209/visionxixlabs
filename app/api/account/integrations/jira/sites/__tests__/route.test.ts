import {beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const m=vi.hoisted(()=>({context:vi.fn(),admin:vi.fn(),origin:vi.fn(),service:vi.fn()}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:m.context}));
vi.mock("@/lib/auth/platformAdmin",()=>({isAdminOrOwner:m.admin}));
vi.mock("@/lib/auth/requestOrigin",()=>({isSameOriginRequest:m.origin}));
vi.mock("@/lib/db",()=>({prisma:{}}));
const actor={isAuthenticated:true,organizationId:"tenant",userId:"owner",email:"owner@example.test",roles:["owner"]};
const revision="2026-10-24T12:00:00.000Z",siteId="12345678-1234-4234-8234-123456789abc";
beforeEach(()=>{vi.clearAllMocks();m.context.mockResolvedValue(actor);m.admin.mockReturnValue(true);m.origin.mockReturnValue(true);});
vi.mock("@/lib/integrations/jira/jiraSiteSelection",()=>({discoverJiraSites:m.service}));
const request=(query=`connectionId=connection&revision=${encodeURIComponent(revision)}`,headers:Record<string,string>={})=>new NextRequest(`https://example.test/api/account/integrations/jira/sites?${query}`,{headers});
it("returns projected site DTOs with no cache and a fresh server actor resolver",async()=>{
 m.service.mockImplementation(async(_repo,input)=>{expect(input.actor).toEqual({organizationId:"tenant",userId:"owner",canManageConnections:true});expect(await input.readCurrentActor()).toEqual(input.actor);m.context.mockResolvedValue({...actor,roles:[]});m.admin.mockReturnValue(false);expect(await input.readCurrentActor()).toBeNull();return {revision,sites:[{id:siteId,name:"Fixture",url:"https://fixture.atlassian.net",accessToken:"PRIVATE"}]};});
 const {GET}=await import("../route");const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");expect(await response.json()).toEqual({ok:true,data:{revision,sites:[{id:siteId,name:"Fixture",url:"https://fixture.atlassian.net"}]}});expect(m.context).toHaveBeenCalledTimes(3);
});
it.each(["origin","anonymous","role"])("refuses %s without service calls",async kind=>{if(kind==="origin")m.origin.mockReturnValue(false);if(kind==="anonymous")m.context.mockResolvedValue({isAuthenticated:false});if(kind==="role")m.admin.mockReturnValue(false);const {GET}=await import("../route");expect((await GET(request(undefined,kind==="origin"?{origin:"https://foreign.test"}:{}))).status).toBe(kind==="anonymous"?401:403);expect(m.service).not.toHaveBeenCalled();if(kind==="origin")expect(m.context).not.toHaveBeenCalled();});
it.each(["", "connectionId=x",`connectionId=x&revision=bad`,`connectionId=x&revision=${revision}&organizationId=foreign`,`connectionId=x&connectionId=y&revision=${revision}`,`connectionId=${"x".repeat(513)}&revision=${revision}`])("rejects invalid query %s",async query=>{const {GET}=await import("../route");expect((await GET(request(query))).status).toBe(400);expect(m.service).not.toHaveBeenCalled();});
it("redacts service errors and does not automatically activate or retry",async()=>{m.service.mockRejectedValue(Error("PRIVATE_TOKEN"));const {GET}=await import("../route");const response=await GET(request());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain("PRIVATE");expect(m.service).toHaveBeenCalledOnce();});

it("permits an authenticated owner GET without Origin even though the mutation helper would reject it",async()=>{m.origin.mockReturnValue(false);m.service.mockResolvedValue({revision,sites:[]});const {GET}=await import("../route");expect((await GET(request())).status).toBe(200);expect(m.origin).not.toHaveBeenCalled();expect(m.service).toHaveBeenCalledOnce();});
it.each(["cross-site","same-site"])("blocks %s fetch metadata before authority or provider reads",async site=>{const {GET}=await import("../route");expect((await GET(request(undefined,{"sec-fetch-site":site}))).status).toBe(403);expect(m.context).not.toHaveBeenCalled();expect(m.service).not.toHaveBeenCalled();});
it.each(["same-origin","none"])("allows authenticated owner %s fetch metadata without Origin",async site=>{m.origin.mockReturnValue(false);m.service.mockResolvedValue({revision,sites:[]});const {GET}=await import("../route");expect((await GET(request(undefined,{"sec-fetch-site":site}))).status).toBe(200);expect(m.service).toHaveBeenCalledOnce();});
