import {NextRequest} from "next/server";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({member:vi.fn(),session:vi.fn(),touch:vi.fn(),apiKey:vi.fn(),read:vi.fn(),configure:vi.fn(),revoke:vi.fn(),importPlan:vi.fn(),access:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{orgMembership:{findUnique:m.member},user:{findUnique:vi.fn(async()=>null)}}}));
vi.mock("@/lib/desktop/desktopSession",()=>({resolveActiveSession:m.session,touchDesktopSession:m.touch}));
vi.mock("@/lib/security/authenticateApiKey",()=>({authenticateApiKey:m.apiKey}));
vi.mock("@/lib/desktop/desktopCommercialAccess",()=>({readDesktopCommercialAccess:m.access}));
vi.mock("@/lib/auth/ensurePersonalWorkspaceMembership",()=>({ensurePersonalWorkspaceMembership:vi.fn()}));
vi.mock("@/lib/terraform/customerPlanService",()=>({readCustomerPlanProfile:m.read,configureCustomerPlanProfile:m.configure,revokeCustomerPlanProfile:m.revoke,importCustomerSavedPlan:m.importPlan}));
import {mintDesktopToken} from "@/lib/desktop/desktopToken";
import {GET,POST} from "../route";
import {POST as importPlan} from "../../terraform-plans/import/route";
const context={params:Promise.resolve({id:"request-owned"})};
function request(method="GET",body?:unknown,token=mintDesktopToken("session-owned"),suffix="terraform-plan-profile"){
 return new NextRequest(`https://example.test/api/desktop/deployments/request-owned/${suffix}`,{method,headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv("DESKTOP_SESSION_SIGNING_KEY","owned-customer-plan-route-signing-key32");m.member.mockResolvedValue({role:"admin",acceptedAt:new Date()});m.session.mockResolvedValue({id:"session-owned",userId:"user-owned",organizationId:"org-owned"});m.access.mockResolvedValue({allowed:true});
 m.read.mockResolvedValue({kind:"customer_plan_profile",profile:null,status:"unconfigured",approval:"unavailable",executionAllowed:false});m.configure.mockResolvedValue({kind:"customer_plan_profile",status:"active",approval:"unavailable",executionAllowed:false});m.revoke.mockResolvedValue({kind:"customer_plan_profile",status:"revoked",approval:"unavailable",executionAllowed:false});m.importPlan.mockResolvedValue({kind:"customer_plan_imported",artifactId:"owned",approval:"unavailable",executionAllowed:false});
});
afterEach(()=>vi.unstubAllEnvs());
it("uses actual signed paired-token resolver, current role/capabilities and separate read/write handlers",async()=>{
 expect((await GET(request(),context)).status).toBe(200);expect(m.read).toHaveBeenCalledWith(expect.objectContaining({db:expect.anything()}),{organizationId:"org-owned",userId:"user-owned",sessionId:"session-owned"},"request-owned");
 expect((await POST(request("POST",{operation:"configure",requestVersion:1,expectedRevision:0,profileInput:{}}),context)).status).toBe(200);expect(m.configure).toHaveBeenCalledWith(expect.anything(),expect.anything(),"request-owned",{requestVersion:1,expectedRevision:0,profileInput:{}});
 expect((await POST(request("POST",{operation:"revoke",requestVersion:2,profileId:"p",expectedRevision:1}),context)).status).toBe(200);expect(m.revoke).toHaveBeenCalledOnce();
 expect((await importPlan(request("POST",{requestVersion:1,profileId:"p",profileRevision:1,runId:"888",runAttempt:1},undefined,"terraform-plans/import"),context)).status).toBe(200);expect(m.importPlan).toHaveBeenCalledOnce();
});
it.each(["pipeline:read","pipeline:trigger","*"])("refuses API key with %s scope at all actual handlers before feature IO",async scope=>{
 m.apiKey.mockResolvedValue({ok:true,organizationId:"org-owned",scopes:[scope]});const token=`vxlk_owned_${scope}`;
 expect((await GET(request("GET",undefined,token),context)).status).toBe(401);expect((await POST(request("POST",{operation:"revoke"},token),context)).status).toBe(401);expect((await importPlan(request("POST",{},token,"terraform-plans/import"),context)).status).toBe(401);
 expect(m.apiKey).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();expect(m.configure).not.toHaveBeenCalled();expect(m.revoke).not.toHaveBeenCalled();expect(m.importPlan).not.toHaveBeenCalled();
});
it.each(["operator","read_only","security_reviewer","finance_viewer"])("allows %s current read but refuses all mutations through actual current-role resolver",async role=>{
 m.member.mockResolvedValue({role,acceptedAt:new Date()});expect((await GET(request(),context)).status).toBe(200);expect((await POST(request("POST",{operation:"configure"}),context)).status).toBe(401);expect((await importPlan(request("POST",{}),context)).status).toBe(401);expect(m.configure).not.toHaveBeenCalled();expect(m.importPlan).not.toHaveBeenCalled();
});
it.each(["missingSession","missingMembership","unacceptedMembership"])("refuses %s actual resolver state before feature calls",async mode=>{
 if(mode==="missingSession")m.session.mockResolvedValue(undefined);if(mode==="missingMembership")m.member.mockResolvedValue(null);if(mode==="unacceptedMembership")m.member.mockResolvedValue({role:"admin",acceptedAt:null});
 expect((await GET(request(),context)).status).toBe(401);expect((await POST(request("POST",{operation:"revoke"}),context)).status).toBe(401);expect((await importPlan(request("POST",{}),context)).status).toBe(401);expect(m.read).not.toHaveBeenCalled();expect(m.revoke).not.toHaveBeenCalled();expect(m.importPlan).not.toHaveBeenCalled();
});
it("rejects unknown/mixed operation and query/body authority overrides without calling mutation services",async()=>{
 for(const body of [{operation:"apply"},{operation:"configure",requestVersion:1,expectedRevision:0,profileInput:{},organizationId:"foreign"},{operation:"revoke",requestVersion:1,profileId:"p",expectedRevision:1,url:"https://evil.test"}])expect((await POST(request("POST",body),context)).status).toBe(400);
 const query=new NextRequest("https://example.test/api/desktop/deployments/request-owned/terraform-plan-profile?organizationId=foreign",{headers:{authorization:`Bearer ${mintDesktopToken("session-owned")}`}});expect((await GET(query,context)).status).toBe(400);expect(m.configure).not.toHaveBeenCalled();expect(m.revoke).not.toHaveBeenCalled();
});
it("returns bounded no-store storage/conflict/re-review failures without private diagnostics",async()=>{
 m.read.mockResolvedValue({kind:"unavailable",reason:"customer_plan_storage_unavailable"});const response=await GET(request(),context);expect(response.status).toBe(503);expect(response.headers.get("cache-control")).toBe("no-store");expect(await response.json()).toMatchObject({ok:false,error:"customer_plan_storage_unavailable"});
 m.revoke.mockResolvedValue({kind:"conflict",reason:"customer_plan_profile_revision_conflict"});expect((await POST(request("POST",{operation:"revoke",requestVersion:1,profileId:"p",expectedRevision:1}),context)).status).toBe(409);
});
it("rejects import body authority/artifact overrides at the handler before its service",async()=>{
 const response=await importPlan(request("POST",{requestVersion:1,profileId:"p",profileRevision:1,runId:"888",runAttempt:1,binary:"untrusted"},undefined,"terraform-plans/import"),context);expect(response.status).toBe(400);expect(m.importPlan).not.toHaveBeenCalled();
});
it("refuses actual oversized/malformed JSON bodies before profile writes",async()=>{
 for(const declared of ["-1","NaN","16385"]){const value=request("POST",{operation:"revoke",requestVersion:1,profileId:"p",expectedRevision:1});value.headers.set("content-length",declared);expect((await POST(value,context)).status).toBe(400);}
 expect((await POST(request("POST",{operation:"configure",requestVersion:1,expectedRevision:0,profileInput:{padding:"x".repeat(17000)}}),context)).status).toBe(400);expect(m.configure).not.toHaveBeenCalled();expect(m.revoke).not.toHaveBeenCalled();
});
it("bounds a stalled body deadline, cancels its owned stream and performs no feature mutation",async()=>{
 vi.useFakeTimers();let started!:()=>void,cancelled=false;const reading=new Promise<void>(resolve=>{started=resolve;}),stream=new ReadableStream<Uint8Array>({pull(){started();},cancel(){cancelled=true;}});
 try{const value=new NextRequest("https://example.test/api/desktop/deployments/request-owned/terraform-plan-profile",{method:"POST",headers:{authorization:`Bearer ${mintDesktopToken("session-owned")}`,"content-type":"application/json"},body:stream,duplex:"half"} as RequestInit&{duplex:"half"});const pending=POST(value,context);await reading;await vi.advanceTimersByTimeAsync(5001);expect((await pending).status).toBe(400);expect(cancelled).toBe(true);expect(m.configure).not.toHaveBeenCalled();expect(m.revoke).not.toHaveBeenCalled();}finally{vi.useRealTimers();}
});
