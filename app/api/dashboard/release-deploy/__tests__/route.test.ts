import {beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({context:vi.fn(),request:vi.fn()}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:mocks.context}));
vi.mock("@/lib/db",()=>({prisma:{}}));
vi.mock("@/lib/releaseops/dashboardRestart",()=>({requestDashboardRestart:mocks.request}));
import {POST} from "../route";
beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue({isAuthenticated:true,organizationId:"org",userId:"user"});mocks.request.mockResolvedValue({status:409,body:{ok:false,error:"restart_readiness_unverified"}});});
const req=(body:unknown)=>new NextRequest("https://example.test/api/dashboard/release-deploy",{method:"POST",headers:{origin:"https://example.test"},body:JSON.stringify(body)});
it("requires authentication before service work",async()=>{mocks.context.mockResolvedValue({isAuthenticated:false});expect((await POST(req({releaseId:"release"}))).status).toBe(401);expect(mocks.request).not.toHaveBeenCalled();});
it.each([{releaseId:"release",organizationId:"foreign"},{releaseId:"release",emergencyBypass:true},{}])("rejects caller authority overrides",async body=>{expect((await POST(req(body))).status).toBe(400);expect(mocks.request).not.toHaveBeenCalled();});
it("uses only current server tenant/user and preserves safe service failure",async()=>{expect((await POST(req({releaseId:"release"}))).status).toBe(409);expect(mocks.request).toHaveBeenCalledWith({}, {organizationId:"org",userId:"user",releaseId:"release"});});

it("denies cross-origin cookie writes before session or service IO",async()=>{const request=new NextRequest("https://example.test/api/dashboard/release-deploy",{method:"POST",headers:{origin:"https://foreign.test","content-type":"text/plain"},body:JSON.stringify({releaseId:"release"})});expect((await POST(request)).status).toBe(403);expect(mocks.context).not.toHaveBeenCalled();expect(mocks.request).not.toHaveBeenCalled();});
