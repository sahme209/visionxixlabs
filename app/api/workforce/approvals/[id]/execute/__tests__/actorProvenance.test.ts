import {beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const m=vi.hoisted(()=>({snapshot:vi.fn(),claim:vi.fn(),update:vi.fn(),executor:vi.fn(),session:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{engineerApprovalSnapshot:{findUnique:m.snapshot,updateMany:m.claim,update:m.update}}}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:m.session}));
vi.mock("@/lib/audit/secureAudit",()=>({record:vi.fn()}));
vi.mock("@/lib/workforce/executors/executorRegistry",()=>({bootstrapExecutorRegistry:vi.fn(),hasExecutor:()=>true,getExecutor:()=>m.executor}));
import {POST} from "../route";
beforeEach(()=>{vi.clearAllMocks();m.session.mockResolvedValue({isAuthenticated:true,organizationId:'owned_org',userId:'owned_user',roles:['operator']});m.claim.mockResolvedValue({count:1});m.executor.mockResolvedValue({ok:true,summary:'fixture only',detail:{dryRun:true}});});
const base={id:'snap_owned',approvalRequestId:'approval_owned',organizationId:'owned_org',engineerId:'owned_engineer',action:'owned_action',status:'approved',executionStatus:'not_started',requiredApprovers:2,correlationId:'owned_correlation'};
function run(){return POST(new NextRequest('https://example.invalid/api/workforce/approvals/approval_owned/execute',{method:'POST',headers:{origin:'https://example.invalid'}}),{params:Promise.resolve({id:'approval_owned'})});}
it('refuses an unexecuted historical approval whose quorum contains legacy actors',async()=>{
 m.snapshot.mockResolvedValue({...base,decisions:[{id:'clegacyone',approverUserId:'claimed_one',decision:'approved'},{id:'clegacytwo',approverUserId:'claimed_two',decision:'approved'}]});
 const result=await run();expect(result.status).toBe(409);expect(await result.json()).toMatchObject({reason:'approval_actor_provenance_required'});expect(m.claim).not.toHaveBeenCalled();expect(m.executor).not.toHaveBeenCalled();
});
it('refuses a claimed terminal approval without its required durable votes',async()=>{
 m.snapshot.mockResolvedValue({...base,decisions:[]});expect((await run()).status).toBe(409);expect(m.executor).not.toHaveBeenCalled();
});
it('preserves execution from a complete bound quorum',async()=>{
 m.snapshot.mockResolvedValue({...base,decisions:[{id:'boundvote_v1_00000000-0000-4000-8000-000000000001',approverUserId:'api_key:one',decision:'approved'},{id:'boundvote_v1_00000000-0000-4000-8000-000000000002',approverUserId:'api_key:two',decision:'approved'}]});
 expect((await run()).status).toBe(200);expect(m.executor).toHaveBeenCalledOnce();
});

it.each(['read_only','finance_viewer','security_reviewer'])('refuses execution by %s before reading or claiming an approval',async role=>{
 m.session.mockResolvedValue({isAuthenticated:true,organizationId:'owned_org',userId:'owned_user',roles:[role]});expect((await run()).status).toBe(403);expect(m.snapshot).not.toHaveBeenCalled();expect(m.executor).not.toHaveBeenCalled();
});
it('refuses cross-origin session execution before touching storage',async()=>{
 const result=await POST(new NextRequest('https://example.invalid/api/workforce/approvals/approval_owned/execute',{method:'POST',headers:{origin:'https://untrusted.invalid'}}),{params:Promise.resolve({id:'approval_owned'})});expect(result.status).toBe(403);expect(m.snapshot).not.toHaveBeenCalled();
});
