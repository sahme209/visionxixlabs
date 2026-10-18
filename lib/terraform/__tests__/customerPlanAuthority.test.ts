import {expect,it} from "vitest";
import {hash} from "./customerPlanFixtures";
import {authorityFixture} from "./customerPlanAuthorityFixtures";
import {inspectCustomerPlanAuthority} from "../customerPlanAuthority";

it("checks independently loaded request/version/repo/environment/connection facts without creating execution authority",()=>{
 const f=authorityFixture(),result=inspectCustomerPlanAuthority(f.profile,f.rows,f.principal,"import",f.now);
 expect(result).toMatchObject({kind:"current_customer_plan_context",requestContentHash:hash(f.rows.request.intakeJson)});expect(result?.targetDigest).toMatch(/^[a-f0-9]{64}$/);expect(result).not.toHaveProperty("executionEnabled");
});
it.each(["owner","admin","operator","security_reviewer","finance_viewer","read_only"])("lets current %s members inspect, without borrowing mutation permission",role=>{
 const f=authorityFixture();f.rows.membership.role=role;expect(inspectCustomerPlanAuthority(f.profile,f.rows,f.principal,"read",f.now)?.kind).toBe("current_customer_plan_context");
 for(const operation of ["profile","import"] as const)expect(inspectCustomerPlanAuthority(f.profile,f.rows,f.principal,operation,f.now)!==null).toBe(role==="owner"||role==="admin");
});
it.each(["expired","revoked","wrongDevice","foreignMember","unaccepted","unknownRole","requestVersion","requestHash","changedIntake","foreignEnvironment","foreignRepository","wrongRepositoryUrl","wrongRequestRepository","wrongRequestEnvironment","foreignInstallation","revokedInstallation","rotatedCredential","revokedCredential","enabledAccount","foreignAccount","liveMode","missingPolicy","foreignPolicy"])("refuses %s before authority or target can be projected",mode=>{
 const f=authorityFixture(),r=f.rows;
 if(mode==="expired")r.device.expiresAt=f.now;if(mode==="revoked")r.device.revokedAt=f.now;if(mode==="wrongDevice")r.device.id="other";if(mode==="foreignMember")r.membership.organizationId="foreign";
 if(mode==="unaccepted")r.membership.acceptedAt=null;if(mode==="unknownRole")r.membership.role="invented";if(mode==="requestVersion")r.request.version++;
 if(mode==="requestHash")r.version.contentHash=hash("other");if(mode==="changedIntake")r.request.intakeJson.title="changed";
 if(mode==="foreignEnvironment")r.environment.organizationId="foreign";if(mode==="foreignRepository")r.repository.organizationId="foreign";if(mode==="wrongRepositoryUrl")r.repository.remoteUrl="https://github.com/foreign/repo";
 if(mode==="wrongRequestRepository"){r.request.intakeJson.repositoryUrls=["https://github.com/foreign/repo"];r.version.intakeJson=structuredClone(r.request.intakeJson);r.version.contentHash=hash(r.version.intakeJson);}
 if(mode==="wrongRequestEnvironment"){r.request.intakeJson.targetEnvironment="Other";r.version.intakeJson=structuredClone(r.request.intakeJson);r.version.contentHash=hash(r.version.intakeJson);}
 if(mode==="foreignInstallation")r.installation.organizationId="foreign";if(mode==="revokedInstallation")r.installation.revokedAt=f.now;
 if(mode==="rotatedCredential")r.credential.version++;if(mode==="revokedCredential")r.credential.revokedAt=f.now;if(mode==="enabledAccount")r.account.enabled=true;if(mode==="foreignAccount")r.account.organizationId="foreign";if(mode==="liveMode")r.account.autopilotMode="live";
 if(mode==="missingPolicy")r.environment.approvalPolicyId="missing";if(mode==="foreignPolicy"){r.environment.approvalPolicyId="policy";r.policy={id:"policy",organizationId:"foreign",enabled:true,blockAction:false,updatedAt:f.now};}
 expect(inspectCustomerPlanAuthority(f.profile,r,f.principal,"import",f.now)).toBeNull();
});
it("includes explicit ISO revision dates and policy facts in the final context digest",()=>{
 const f=authorityFixture(),a=inspectCustomerPlanAuthority(f.profile,f.rows,f.principal,"import",f.now)!;
 f.rows.environment.updatedAt=new Date(f.now);const b=inspectCustomerPlanAuthority(f.profile,f.rows,f.principal,"import",f.now)!;expect(b.contextDigest).not.toBe(a.contextDigest);expect(b.targetDigest).not.toBe(a.targetDigest);
 f.rows.environment.approvalPolicyId="policy";f.rows.policy={id:"policy",organizationId:f.principal.organizationId,enabled:true,blockAction:false,updatedAt:f.now};
 const c=inspectCustomerPlanAuthority(f.profile,f.rows,f.principal,"import",f.now)!;f.rows.policy.blockAction=true;const d=inspectCustomerPlanAuthority(f.profile,f.rows,f.principal,"import",f.now)!;expect(d.contextDigest).not.toBe(c.contextDigest);
});
