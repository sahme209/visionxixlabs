import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const m=vi.hoisted(()=>({context:vi.fn(),admin:vi.fn(),origin:vi.fn(),service:vi.fn()}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:m.context}));
vi.mock("@/lib/auth/platformAdmin",()=>({isAdminOrOwner:m.admin}));
vi.mock("@/lib/auth/requestOrigin",()=>({isSameOriginRequest:m.origin}));
vi.mock("@/lib/db",()=>({prisma:{}}));
const actor={isAuthenticated:true,organizationId:"tenant",userId:"owner",email:"owner@example.test",roles:["owner"]};
const revision="2026-10-24T12:00:00.000Z",siteId="12345678-1234-4234-8234-123456789abc";
beforeEach(()=>{vi.clearAllMocks();m.context.mockResolvedValue(actor);m.admin.mockReturnValue(true);m.origin.mockReturnValue(true);});
vi.mock("@/lib/integrations/jira/jiraReadActivation",async original=>({...await original<typeof import("@/lib/integrations/jira/jiraReadActivation")>(),activateJiraReadConnection:m.service}));
import {JiraReadActivationOutcomeUnknown} from "@/lib/integrations/jira/jiraReadActivation";
const body={connectionId:"connection",revision,siteId};
const request=(value:unknown=body,headers:Record<string,string>={"content-type":"application/json"})=>new NextRequest("https://example.test/api/account/integrations/jira/activate",{method:"POST",headers,body:typeof value==="string"?value:JSON.stringify(value)});
it("activates only explicit selection under fresh server authority",async()=>{m.service.mockImplementation(async(_repo,input)=>{expect(input).toMatchObject({...body,actor:{organizationId:"tenant",userId:"owner",canManageConnections:true}});expect(await input.readCurrentActor()).toEqual(input.actor);m.context.mockResolvedValue({...actor,organizationId:"changed"});expect(await input.readCurrentActor()).toEqual({organizationId:"changed",userId:"owner",canManageConnections:true});return {connectionId:"connection",cloudId:siteId,readValidated:true,issueWritePermissionVerified:false,accessToken:"PRIVATE"};});const {POST}=await import("../route");const response=await POST(request());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");expect(await response.json()).toEqual({ok:true,data:{connectionId:"connection",cloudId:siteId,readValidated:true,issueWritePermissionVerified:false}});expect(m.context).toHaveBeenCalledTimes(3);});
it.each(["origin","anonymous","role"])("refuses %s before service",async kind=>{if(kind==="origin")m.origin.mockReturnValue(false);if(kind==="anonymous")m.context.mockResolvedValue({isAuthenticated:false});if(kind==="role")m.admin.mockReturnValue(false);const {POST}=await import("../route");expect((await POST(request())).status).toBe(kind==="anonymous"?401:403);expect(m.service).not.toHaveBeenCalled();});
it.each([{},[],null,{...body,siteId:"bad"},{...body,revision:"bad"},{...body,connectionId:"x\n"},{...body,connectionId:"x".repeat(513)},{...body,organizationId:"foreign"},{...body,actor:{userId:"foreign"}},{...body,accessToken:"PRIVATE"},{...body,revision:"x".repeat(5000)},"not json"])("rejects invalid bounded body %#",async value=>{const {POST}=await import("../route");expect((await POST(request(value))).status).toBe(400);expect(m.service).not.toHaveBeenCalled();});
it("rejects wrong media type before service",async()=>{const {POST}=await import("../route");expect((await POST(request(body,{"content-type":"text/plain"}))).status).toBe(400);expect(m.service).not.toHaveBeenCalled();});
it.each([false,true])("distinguishes uncertain activation without retry (unknown=%s)",async unknown=>{m.service.mockRejectedValue(unknown?new JiraReadActivationOutcomeUnknown():Error("PRIVATE_PROVIDER"));const {POST}=await import("../route");const response=await POST(request());expect(response.status).toBe(unknown?409:503);expect((await response.json()).error).toBe(unknown?"jira_read_activation_outcome_unknown":"jira_read_activation_unavailable");expect(m.service).toHaveBeenCalledOnce();});

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it("rejects oversized declared bodies without reading or dispatching",async()=>{const {POST}=await import("../route");expect((await POST(request(body,{"content-type":"application/json","content-length":"4097"}))).status).toBe(400);expect(m.service).not.toHaveBeenCalled();});
it("bounds chunked bytes using UTF-8 rather than JavaScript character count",async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify({...body,connectionId:"🙂".repeat(1100)}));
 const req=new NextRequest("https://example.test/api/account/integrations/jira/activate",{method:"POST",headers:{"content-type":"application/json"},body:new ReadableStream({start(controller){controller.enqueue(bytes.slice(0,3000));controller.enqueue(bytes.slice(3000));controller.close();}}),duplex:"half"} as ConstructorParameters<typeof NextRequest>[1]);
 const {POST}=await import("../route");expect((await POST(req)).status).toBe(400);expect(m.service).not.toHaveBeenCalled();
});
it("rejects invalid UTF-8 before the service",async()=>{const req=new NextRequest("https://example.test/api/account/integrations/jira/activate",{method:"POST",headers:{"content-type":"application/json"},body:new Uint8Array([255])});const {POST}=await import("../route");expect((await POST(req)).status).toBe(400);expect(m.service).not.toHaveBeenCalled();});
it("bounds a stalled body without automatic activation",async()=>{
 vi.useFakeTimers();vi.spyOn(AbortSignal,"timeout").mockImplementation(ms=>{const c=new AbortController();setTimeout(()=>c.abort(),ms);return c.signal;});
 const req=new NextRequest("https://example.test/api/account/integrations/jira/activate",{method:"POST",headers:{"content-type":"application/json"},body:new ReadableStream({cancel:()=>new Promise(()=>{})}),duplex:"half"} as ConstructorParameters<typeof NextRequest>[1]);
 const {POST}=await import("../route");const pending=POST(req);await vi.advanceTimersByTimeAsync(5000);expect((await pending).status).toBe(400);expect(m.service).not.toHaveBeenCalled();
});

it("refuses an endless zero-byte chunk source with a bounded number of reads",async()=>{
 const pull=vi.fn((controller:ReadableStreamDefaultController<Uint8Array>)=>controller.enqueue(new Uint8Array()));
 const req=new NextRequest("https://example.test/api/account/integrations/jira/activate",{method:"POST",headers:{"content-type":"application/json"},body:new ReadableStream({pull}),duplex:"half"} as ConstructorParameters<typeof NextRequest>[1]);
 const {POST}=await import("../route");expect((await POST(req)).status).toBe(400);expect(pull.mock.calls.length).toBeLessThanOrEqual(4099);expect(m.service).not.toHaveBeenCalled();
});
