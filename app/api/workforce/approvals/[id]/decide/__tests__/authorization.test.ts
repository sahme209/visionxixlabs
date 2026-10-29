import {beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const m=vi.hoisted(()=>({session:vi.fn(),persist:vi.fn()}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:m.session}));
vi.mock("@/lib/workforce/persistApprovalVote",()=>({persistApprovalVote:m.persist}));
vi.mock("@/lib/approvals/approvalEngine",()=>({getApproval:()=>null,decideApproval:vi.fn()}));
import {POST} from "../route";
beforeEach(()=>{vi.clearAllMocks();m.session.mockResolvedValue({isAuthenticated:true,organizationId:'owned_org',userId:'owned_user',roles:['security_reviewer']});m.persist.mockResolvedValue({kind:'reject',reason:'approval_not_found'});});
function request(origin='https://example.invalid'){return new NextRequest('https://example.invalid/api/workforce/approvals/approval_owned/decide',{method:'POST',headers:{origin},body:JSON.stringify({decision:'approved'})});}
it.each(['read_only','finance_viewer'])('refuses votes from %s before touching approval storage',async role=>{m.session.mockResolvedValue({isAuthenticated:true,organizationId:'owned_org',userId:'owned_user',roles:[role]});expect((await POST(request(),{params:Promise.resolve({id:'approval_owned'})})).status).toBe(403);expect(m.persist).not.toHaveBeenCalled();});
it('refuses cross-origin session votes',async()=>{expect((await POST(request('https://untrusted.invalid'),{params:Promise.resolve({id:'approval_owned'})})).status).toBe(403);expect(m.persist).not.toHaveBeenCalled();});
it('allows the existing security reviewer approval role to reach the scoped persistence boundary',async()=>{expect((await POST(request(),{params:Promise.resolve({id:'approval_owned'})})).status).toBe(404);expect(m.persist).toHaveBeenCalledWith(expect.objectContaining({organizationId:'owned_org',principal:{kind:'user',id:'owned_user'}}));});
