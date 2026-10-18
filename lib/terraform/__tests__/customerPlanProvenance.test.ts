import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bytesDigest } from "../savedPlanArtifact";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { customerProfile, backendState, hash } from "./customerPlanFixtures";
const m=vi.hoisted(()=>({verify:vi.fn(),authority:vi.fn()}));
// Composition only. This synthetic crypto adapter is never used in a runtime/HTTP fixture.
vi.mock("@/lib/releaseops/ecsReleaseV2/sigstoreBuildVerifier",()=>({verifyBuildProvenance:m.verify}));
import { verifyCustomerPlanProducer, sealVerifiedCustomerPlan } from "../customerPlanProvenance";
const binary=Buffer.from("SYNTHETIC-NOT-A-GENUINE-TERRAFORM-PLAN");
const show=JSON.stringify({format_version:"1.2",terraform_version:"1.9.8",resource_changes:[{address:"terraform_data.synthetic",provider_name:"terraform.io/builtin/terraform",change:{actions:["create"],after:{secret:"DO-NOT-LEAK"}}}]});
function input() {
 const profile=customerProfile();
 const receipt={schema:"axiom.terraform.plan-receipt.v2",profileDigest:sha256ContentHash(profile),requestContentHash:hash("request"),targetDigest:hash("target"),
  producer:{repositoryId:profile.repository.remoteId,repositoryFullName:profile.repository.fullName,sourceRef:profile.repository.sourceRef,sourceSha:profile.repository.sourceSha,workflowPath:profile.producer.workflowPath,workflowSha:profile.producer.workflowSha,runId:"888",runAttempt:1,roleArn:profile.producer.planRoleArn},
  backendIdentityDigest:sha256ContentHash(profile.backend),workspace:"default",stateBefore:backendState(),stateAfter:backendState(),lock:"released",
  configurationDigest:profile.configuration.treeDigest,providerLockDigest:profile.configuration.providerLockDigest,terraformVersion:"1.9.8",executableDigest:hash("cli"),
  binary:{digest:bytesDigest(binary),bytes:binary.length},show:{digest:bytesDigest(show),bytes:Buffer.byteLength(show)},createdAt:"2026-10-18T12:00:00.000Z",expiresAt:"2026-10-18T12:15:00.000Z"};
 return {profile,requestContentHash:hash("request"),targetDigest:hash("target"),run:{id:"888",attempt:1},binary:Buffer.from(binary),show:Buffer.from(show),receipt:Buffer.from(JSON.stringify(receipt)),bundle:Buffer.from("synthetic-provenance-composition-only"),
  trust:{publicProfile:{kind:"synthetic-unit-adapter-only"},digest:hash("trust"),terraformVersion:"1.9.8",executableDigest:hash("cli"),reviewExpiresAt:"2026-10-18T12:20:00.000Z",downloadPolicy:[]},now:new Date("2026-10-18T12:01:00Z"),authorize:m.authority};
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY","synthetic-customer-plan-envelope-key-at-least32");m.authority.mockResolvedValue(true);m.verify.mockImplementation(async({binding}:{binding:unknown})=>({kind:"verified_build_provenance",...(binding as object)}));});
afterEach(()=>vi.unstubAllEnvs());
it("composes exact subject verification and sealing only after a verified internal result (synthetic unit evidence)",async()=>{
 const value=input();const result=await verifyCustomerPlanProducer(value);
 expect(result.kind).toBe("verified_customer_plan");
 if(result.kind!=="verified_customer_plan")throw Error("expected synthetic composition");
 const expected=m.verify.mock.calls[0][0].binding;
 expect(expected.subjects).toEqual([{name:"plan.tfplan",sha256:bytesDigest(binary)},{name:"plan.show.json",sha256:bytesDigest(show)},{name:"plan.receipt.json",sha256:bytesDigest(value.receipt)}]);
 const sealed=sealVerifiedCustomerPlan(result);
 expect(sealed.artifact.bindingJson.schema).toBe("axiom.terraform.saved-plan.v2");
 expect(sealed.artifact.encryptedBinary).toMatch(/^v2\./);
 expect(JSON.stringify(sealed)).not.toContain("DO-NOT-LEAK");
 expect(sealed.provenance.artifactId).toBe(sealed.artifact.id);
 expect(sealVerifiedCustomerPlan(result).artifact.id).toBe(sealed.artifact.id);
});
it.each(["binary","show","receipt"] as const)("refuses changed %s bytes before sealing",async part=>{
 const value=input();if(part==="receipt"){const receipt=JSON.parse(value.receipt.toString());receipt.producer.runAttempt=2;value.receipt=Buffer.from(JSON.stringify(receipt));}else value[part]=Buffer.from("changed");
 expect(await verifyCustomerPlanProducer(value)).toMatchObject({kind:"unavailable"});
 expect(m.verify).not.toHaveBeenCalled();
});
it.each(["state","lock","role","profile","expiry","configuration"])("rejects unsupported receipt %s without crypto or storage",async change=>{
 const value=input(),r=JSON.parse(value.receipt.toString());
 if(change==="state")r.stateAfter.serial++;
 if(change==="lock")r.lock="held";
 if(change==="role")r.producer.roleArn="arn:aws:iam::999999999999:role/foreign";
 if(change==="profile")r.profileDigest=hash("foreign-profile");
 if(change==="expiry")r.expiresAt="2026-10-18T12:15:00.001Z";
 if(change==="configuration")r.configurationDigest=hash("other-tree");
 value.receipt=Buffer.from(JSON.stringify(r));
 expect(await verifyCustomerPlanProducer(value)).toMatchObject({kind:"unavailable"});expect(m.verify).not.toHaveBeenCalled();
});
it("requires exact official-verifier success, current authority and current trust expiry",async()=>{
 m.verify.mockResolvedValue({kind:"unavailable",reason:"invalid_signature"});expect(await verifyCustomerPlanProducer(input())).toMatchObject({kind:"unavailable"});
 m.authority.mockResolvedValue(false);expect(await verifyCustomerPlanProducer(input())).toMatchObject({kind:"unavailable"});
 const value=input();value.trust.reviewExpiresAt="2026-10-18T12:00:00.000Z";expect(await verifyCustomerPlanProducer(value)).toMatchObject({kind:"unavailable"});
});
it("will not seal a caller-forged verified-shaped result",()=>{
 expect(()=>sealVerifiedCustomerPlan({kind:"verified_customer_plan",binding:{}} as never)).toThrow("customer_plan_unverified");
});
it("snapshots caller bytes and context before asynchronous authority checks",async()=>{
 const value=input();let resume!:()=>void;const wait=new Promise<void>(done=>{resume=done;});
 m.authority.mockImplementationOnce(async()=>{await wait;return true;});
 const pending=verifyCustomerPlanProducer(value);value.binary.fill(0);value.profile.connection.version=99;resume();
 expect((await pending).kind).toBe("verified_customer_plan");
});
