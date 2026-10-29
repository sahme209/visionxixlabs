import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
const m=vi.hoisted(()=>({session:vi.fn(),entitlements:vi.fn(),membership:vi.fn(),account:vi.fn(),existing:vi.fn(),schedule:vi.fn(),create:vi.fn(),update:vi.fn(),remove:vi.fn(),list:vi.fn()}));
vi.mock("next-auth",()=>({getServerSession:m.session}));
vi.mock("@/lib/auth",()=>({authOptions:{}}));
vi.mock("@/lib/entitlements",()=>({getEntitlementsFromPlan:m.entitlements}));
vi.mock("@/lib/db",()=>({prisma:{user:{findUnique:async()=>({plan:"pro"})},orgMembership:{findUnique:m.membership},cloudAccount:{findUnique:m.account},axiomScheduledRun:{findFirst:m.existing,findUnique:m.schedule}}}));
vi.mock("@/lib/axiom/scheduler",()=>({createSchedule:m.create,updateSchedule:m.update,deleteSchedule:m.remove,listSchedules:m.list}));
import {GET,POST,PUT,DELETE} from "../route";
function request(method:string,body?:unknown,query="") {return new NextRequest("https://axiom.test/api/axiom/scheduler"+query,{method,...(body===undefined?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})});}
beforeEach(()=>{
 vi.resetAllMocks();m.session.mockResolvedValue({user:{id:"member"}});m.entitlements.mockReturnValue({axiomExecution:true});m.membership.mockResolvedValue({role:"owner",acceptedAt:new Date(0)});m.account.mockResolvedValue({id:"cloud",organizationId:"org"});m.existing.mockResolvedValue(null);m.schedule.mockResolvedValue({organizationId:"org"});m.create.mockResolvedValue("schedule");m.update.mockResolvedValue(true);m.remove.mockResolvedValue(true);m.list.mockResolvedValue([]);
});
describe("scheduler tenant and role authorization",()=>{
 it.each([null,{role:"owner",acceptedAt:null}])("denies absent or pending membership before listing (%j)",async membership=>{
  m.membership.mockResolvedValue(membership);expect((await GET(request("GET",undefined,"?organizationId=foreign"))).status).toBe(403);expect(m.list).not.toHaveBeenCalled();
 });
 it("reads accepted membership for the authenticated user and requested organization",async()=>{
  m.membership.mockResolvedValue({role:"read_only",acceptedAt:new Date(0)});expect((await GET(request("GET",undefined,"?organizationId=org"))).status).toBe(200);
  expect(m.membership).toHaveBeenCalledWith(expect.objectContaining({where:{userId_organizationId:{userId:"member",organizationId:"org"}}}));expect(m.list).toHaveBeenCalledWith("org");
 });
 it.each([null,{role:"owner",acceptedAt:null},{role:"read_only",acceptedAt:new Date(0)}])("denies unauthorized creation before account reads and writes (%j)",async membership=>{
  m.membership.mockResolvedValue(membership);expect((await POST(request("POST",{organizationId:"org",cloudAccountId:"cloud",frequency:"daily"}))).status).toBe(403);expect(m.account).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled();
 });
 it.each(["PUT","DELETE"])("denies a nonmember mutating a stored schedule with %s",async method=>{
  m.membership.mockResolvedValue(null);const response=method==="PUT"?await PUT(request("PUT",{scheduleId:"schedule",organizationId:"forged",enabled:false})):await DELETE(request("DELETE",undefined,"?scheduleId=schedule&organizationId=forged"));expect(response.status).toBe(403);expect(m.update).not.toHaveBeenCalled();expect(m.remove).not.toHaveBeenCalled();
  expect(m.membership).toHaveBeenCalledWith(expect.objectContaining({where:{userId_organizationId:{userId:"member",organizationId:"org"}}}));
 });
 it.each(["PUT","DELETE"])("denies accepted read-only schedule mutation with %s",async method=>{
  m.membership.mockResolvedValue({role:"read_only",acceptedAt:new Date(0)});const response=method==="PUT"?await PUT(request("PUT",{scheduleId:"schedule",enabled:false})):await DELETE(request("DELETE",undefined,"?scheduleId=schedule"));expect(response.status).toBe(403);expect(m.update).not.toHaveBeenCalled();expect(m.remove).not.toHaveBeenCalled();
 });
 it("preserves owner creation only for the selected organization's cloud account",async()=>{
  expect((await POST(request("POST",{organizationId:"org",cloudAccountId:"cloud",frequency:"daily"}))).status).toBe(201);expect(m.create).toHaveBeenCalledWith(expect.objectContaining({organizationId:"org",cloudAccountId:"cloud"}));
  m.create.mockClear();m.account.mockResolvedValue({id:"cloud",organizationId:"other"});expect((await POST(request("POST",{organizationId:"org",cloudAccountId:"cloud",frequency:"daily"}))).status).toBe(404);expect(m.create).not.toHaveBeenCalled();
 });
 it("binds authorized updates and deletion to the stored organization",async()=>{
  m.membership.mockResolvedValue({role:"admin",acceptedAt:new Date(0)});expect((await PUT(request("PUT",{scheduleId:"schedule",enabled:false}))).status).toBe(200);expect(m.update).toHaveBeenCalledWith("schedule","org",{frequency:undefined,enabled:false,timezone:undefined});
  expect((await DELETE(request("DELETE",undefined,"?scheduleId=schedule"))).status).toBe(200);expect(m.remove).toHaveBeenCalledWith("schedule","org");
 });
 it.each(["PUT","DELETE"])("refuses missing schedules for %s",async method=>{
  m.schedule.mockResolvedValue(null);const r=method==="PUT"?await PUT(request("PUT",{scheduleId:"missing",enabled:false})):await DELETE(request("DELETE",undefined,"?scheduleId=missing"));expect(r.status).toBe(404);expect(m.update).not.toHaveBeenCalled();expect(m.remove).not.toHaveBeenCalled();
 });
 it("retains sign-in and commercial-access gates",async()=>{
  m.entitlements.mockReturnValue({axiomExecution:false});expect((await GET(request("GET",undefined,"?organizationId=org"))).status).toBe(401);expect(m.membership).not.toHaveBeenCalled();
  m.entitlements.mockReturnValue({axiomExecution:true});m.session.mockResolvedValue(null);expect((await GET(request("GET",undefined,"?organizationId=org"))).status).toBe(401);
 });
 it.each(["GET","POST","PUT","DELETE"])("fails closed on membership-storage failure for %s",async method=>{
  m.membership.mockRejectedValue(new Error("private storage failure"));
  const response=method==="GET"?await GET(request("GET",undefined,"?organizationId=org")):method==="POST"?await POST(request("POST",{organizationId:"org",cloudAccountId:"cloud",frequency:"daily"})):method==="PUT"?await PUT(request("PUT",{scheduleId:"schedule",enabled:false})):await DELETE(request("DELETE",undefined,"?scheduleId=schedule"));
  expect(response.status).toBe(403);expect(await response.text()).not.toContain("private storage failure");expect(m.list).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();expect(m.remove).not.toHaveBeenCalled();
 });
 it.each(["POST","PUT"])("rejects malformed JSON for %s without a data operation",async method=>{
  const req=new NextRequest("https://axiom.test/api/axiom/scheduler",{method,headers:{"content-type":"application/json"},body:"{"});const response=method==="POST"?await POST(req):await PUT(req);expect(response.status).toBe(400);expect(m.membership).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
 });
 it("checks fresh membership again after it is revoked",async()=>{
  expect((await GET(request("GET",undefined,"?organizationId=org"))).status).toBe(200);m.membership.mockResolvedValue(null);expect((await GET(request("GET",undefined,"?organizationId=org"))).status).toBe(403);expect(m.list).toHaveBeenCalledOnce();
 });
 it("does not report success after a scoped storage race loses the row",async()=>{
  m.update.mockResolvedValue(false);m.remove.mockResolvedValue(false);expect((await PUT(request("PUT",{scheduleId:"schedule",enabled:false}))).status).toBe(404);expect((await DELETE(request("DELETE",undefined,"?scheduleId=schedule"))).status).toBe(404);
 });

 it.each([{scheduleId:5},{scheduleId:"schedule",enabled:"true"},{scheduleId:"schedule",timezone:[]},{scheduleId:"schedule",frequency:[]}])("rejects malformed update fields before schedule reads (%j)",async body=>{
  expect((await PUT(request("PUT",body))).status).toBe(400);expect(m.schedule).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
 });

});
