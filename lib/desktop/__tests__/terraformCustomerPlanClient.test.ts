import {afterEach,expect,it,vi} from "vitest";
import {DesktopClient} from "../../../desktop/src/lib/desktopClient";
import {customerProfile} from "../../terraform/__tests__/customerPlanFixtures";
const profile=()=>({...customerProfile(),schema:"axiom.terraform.customer-profile.v2" as const,backend:{...customerProfile().backend,workspace:"default" as const,kind:"s3_dynamodb" as const}});
const view=()=>({kind:"customer_plan_profile",profile:profile(),status:"active",currentTarget:"not_observed",approval:"unavailable",executionAllowed:false,permissions:{configure:true,import:true}});
function response(data:unknown,status=200){const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,data}),{status}));vi.stubGlobal("fetch",fetch);return fetch;}
const client=(token="axm.desk.owned.signature")=>new DesktopClient({apiBase:"https://service.example.test",sessionToken:token});
afterEach(()=>vi.unstubAllGlobals());
it("reads only the encoded selected-request profile with paired bearer and no cookie fallback",async()=>{
 const fetch=response(view());expect(await client().getDeploymentTerraformProfile("request-owned")).toMatchObject({ok:true,data:{status:"active"}});expect(fetch).toHaveBeenCalledWith("https://service.example.test/api/desktop/deployments/request-owned/terraform-plan-profile",expect.objectContaining({method:"GET",credentials:"omit",headers:expect.objectContaining({Authorization:"Bearer axm.desk.owned.signature"})}));
});
it("posts only typed profile configuration/CAS fields and derives configure versus revise",async()=>{
 const p=profile(),profileInput={environmentId:p.environmentId,repository:p.repository,producer:p.producer,configuration:p.configuration,backend:{region:p.backend.region,bucket:p.backend.bucket,key:p.backend.key,lockTable:p.backend.lockTable},artifacts:p.artifacts,connection:{id:p.connection.id}};
 const fetch=response(view());expect((await client().configureDeploymentTerraformProfile("request-owned",{requestVersion:1,expectedRevision:0,profileInput})).ok).toBe(true);expect(fetch.mock.calls[0][1]).toMatchObject({method:"POST",credentials:"omit",body:JSON.stringify({operation:"configure",requestVersion:1,expectedRevision:0,profileInput})});
 response({...view(),profile:{...p,revision:2}});expect((await client().configureDeploymentTerraformProfile("request-owned",{requestVersion:1,expectedRevision:1,profileInput})).ok).toBe(true);
});
it("accepts deny-only revoke preserving old configuration version, requiring its exact next profile revision",async()=>{
 const fetch=response({...view(),profile:{...profile(),revision:2,requestVersion:1},status:"revoked",currentTarget:"unavailable"});expect((await client().revokeDeploymentTerraformProfile("request-owned",{requestVersion:2,profileId:"profile-owned",expectedRevision:1})).ok).toBe(true);expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify({operation:"revoke",requestVersion:2,profileId:"profile-owned",expectedRevision:1}));
});
it("imports identifiers only, never a binary/show/upload URL or apply decision",async()=>{
 const value={kind:"customer_plan_imported",artifactId:`tfcp_${"a".repeat(64)}`,reused:false,approval:"unavailable",executionAllowed:false},fetch=response(value),input={requestVersion:1,profileId:"profile-owned",profileRevision:1,runId:"888",runAttempt:1};
 expect(await client().importDeploymentTerraformPlan("request/owned",input)).toEqual({ok:true,data:value});expect(fetch).toHaveBeenCalledWith("https://service.example.test/api/desktop/deployments/request%2Fowned/terraform-plans/import",expect.objectContaining({body:JSON.stringify(input),credentials:"omit"}));
});
it.each(["","vxlk_recovery","unsupported"])("refuses %s credential before customer-plan HTTP",async token=>{
 const fetch=response(view());expect((await client(token).getDeploymentTerraformProfile("request-owned")).ok).toBe(false);expect((await client(token).importDeploymentTerraformPlan("request-owned",{requestVersion:1,profileId:"p",profileRevision:1,runId:"1",runAttempt:1})).ok).toBe(false);expect(fetch).not.toHaveBeenCalled();
});
it.each([{...view(),executionAllowed:true},{...view(),approval:"approved"},{...view(),profile:{...profile(),deploymentRequestId:"foreign"}},{...view(),status:"revoked",currentTarget:"observed_match"}])("refuses malformed/foreign/authority-bearing profile result: %j",async value=>{response(value);expect((await client().getDeploymentTerraformProfile("request-owned")).ok).toBe(false);});
it("does not adopt success-shaped HTTP failure or an import execution authority claim",async()=>{
 response(view(),503);expect((await client().getDeploymentTerraformProfile("request-owned")).ok).toBe(false);response({kind:"customer_plan_imported",artifactId:`tfcp_${"a".repeat(64)}`,reused:false,approval:"approved",executionAllowed:true});expect((await client().importDeploymentTerraformPlan("request-owned",{requestVersion:1,profileId:"p",profileRevision:1,runId:"1",runAttempt:1})).ok).toBe(false);
});
