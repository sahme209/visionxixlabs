/** @vitest-environment node */
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const m=vi.hoisted(()=>({find:vi.fn(),verify:vi.fn(),limit:vi.fn(),generate:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{lead:{findUnique:m.find}}}));
vi.mock("@/lib/starterToken",()=>({verifyStarterToken:m.verify}));
vi.mock("@/lib/rateLimit",()=>({checkRateLimit:m.limit}));
vi.mock("@/lib/terraform/generator",()=>({generateTerraform:m.generate}));
import {POST} from "../route";
const secret="PRIVATE_FIXTURE_postgres_password_and_provider_token";
let log:ReturnType<typeof vi.spyOn>;
beforeEach(()=>{vi.resetAllMocks();m.verify.mockReturnValue({leadId:"fixture-lead"});m.limit.mockReturnValue(true);m.find.mockResolvedValue({id:"fixture-lead",userId:"fixture-user",source:"cloud-operator"});m.generate.mockResolvedValue({jobId:"fixture-job",files:{"main.tf":"fixture"}});log=vi.spyOn(console,"error").mockImplementation(()=>{});});
afterEach(()=>vi.restoreAllMocks());
function request(body:unknown={readinessReportId:"fixture-report"},token=true){return new NextRequest("http://localhost/api/terraform/generate"+(token?"?token=fixture-token":""),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});}
for(const phase of ["database","generator"])it(`does not reflect ${phase} diagnostics in the public response`,async()=>{
 (phase==="database"?m.find:m.generate).mockRejectedValueOnce(new Error(secret));const response=await POST(request());const body=await response.json();expect(response.status).toBe(500);expect(body).toEqual({error:"Terraform generation could not be completed."});expect(JSON.stringify(body)).not.toContain(secret);expect(log).toHaveBeenCalledWith("[terraform/generate]",secret);if(phase==="database")expect(m.generate).not.toHaveBeenCalled();
});
it("keeps successful generation response and exact arguments",async()=>{const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({success:true,jobId:"fixture-job",files:["main.tf"]});expect(m.generate).toHaveBeenCalledOnce();expect(m.generate).toHaveBeenCalledWith({leadId:"fixture-lead",userId:"fixture-user",readinessReportId:"fixture-report",mode:"active_passive",secondaryCloud:"azure"});});
it("keeps expired-token rejection before storage or generation",async()=>{m.verify.mockReturnValue({error:"expired"});const response=await POST(request());expect(response.status).toBe(401);expect(await response.json()).toEqual({error:"Token expired"});expect(m.find).not.toHaveBeenCalled();expect(m.generate).not.toHaveBeenCalled();});
it("keeps rate-limit rejection before storage or generation",async()=>{m.limit.mockReturnValue(false);const response=await POST(request());expect(response.status).toBe(429);expect(m.find).not.toHaveBeenCalled();expect(m.generate).not.toHaveBeenCalled();});
it("keeps required-report validation without generation",async()=>{const response=await POST(request({}));expect(response.status).toBe(400);expect(await response.json()).toEqual({error:"readinessReportId required"});expect(m.generate).not.toHaveBeenCalled();});
