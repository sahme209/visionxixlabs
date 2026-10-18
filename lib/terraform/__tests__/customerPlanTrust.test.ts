import { expect, it, vi, afterEach } from "vitest";
import { resolveCustomerPlanTrust, readConfiguredCustomerPlanTrust } from "../customerPlanTrust";
import { customerProfile, hash } from "./customerPlanFixtures";
import { directBinding, directProfile, directNow } from "@/lib/releaseops/ecsReleaseV2/__tests__/fixtures/directWorkflowFixture";
function fixture(){const profile=customerProfile();profile.repository.fullName=directBinding.repositoryFullName;profile.repository.sourceSha=directBinding.sourceSha;profile.repository.sourceRef=directBinding.sourceRef;profile.producer.workflowPath=directBinding.workflowPath;profile.producer.workflowSha=directBinding.workflowSha;
 return {profile,config:{schema:"axiom.terraform.producer-trust-registry.v2",profiles:[{id:profile.producer.trustProfileId,toolchainId:profile.producer.toolchainProfileId,publicProfile:directProfile,terraformVersion:"1.9.8",executableDigest:hash("cli"),providerLockDigest:profile.configuration.providerLockDigest,workflowDigest:profile.producer.workflowDigest,scriptDigest:profile.producer.scriptDigest,downloadPolicy:[{origin:"https://reviewed.blob.core.windows.net",pathPrefix:`/attestations/${profile.repository.remoteId}/`}]}]}};}
afterEach(()=>vi.unstubAllEnvs());
it("requires independently configured reviewed trust and never adopts a caller profile as roots",()=>{
 const {profile}=fixture();expect(resolveCustomerPlanTrust(profile,directNow,null)).toBeNull();
 vi.stubEnv("AXIOM_TERRAFORM_CUSTOMER_PLAN_TRUST","");expect(readConfiguredCustomerPlanTrust(profile,directNow)).toBeNull();
});
it("selects exact server-owned code/toolchain/trust IDs for one reviewed public workflow",()=>{
 const {profile,config}=fixture();const trust=resolveCustomerPlanTrust(profile,directNow,config);
 expect(trust).toMatchObject({terraformVersion:"1.9.8",executableDigest:hash("cli")});
 expect(trust?.digest).toMatch(/^[a-f0-9]{64}$/);
 expect(trust).not.toHaveProperty("planAvailable");
});
it.each(["toolchain","code","lock","signer","expired","duplicates","unknown"])("fails closed for server registry drift %s",change=>{
 const {profile,config}=fixture();
 if(change==="toolchain")config.profiles[0].toolchainId="other";
 if(change==="code")config.profiles[0].scriptDigest=hash("other");
 if(change==="lock")config.profiles[0].providerLockDigest=hash("other");
 if(change==="signer")config.profiles[0].publicProfile={...directProfile,signerWorkflowSha:"b".repeat(40)};
 if(change==="expired")config.profiles[0].publicProfile={...directProfile,reviewExpiresAt:new Date(directNow.getTime()-1).toISOString()};
 if(change==="duplicates")config.profiles.push(config.profiles[0]);
 const supplied=change==="unknown"?{...config,bypass:true}:config;
 expect(resolveCustomerPlanTrust(profile,directNow,supplied)).toBeNull();
});

it.each(["missing","foreignPrefix","http","credentials"])("requires server-reviewed bundle egress policy %s",change=>{
 const {profile,config}=fixture();
 if(change==="missing")config.profiles[0].downloadPolicy=[];
 if(change==="foreignPrefix")config.profiles[0].downloadPolicy[0].pathPrefix="/attestations/999/";
 if(change==="http")config.profiles[0].downloadPolicy[0].origin="http://reviewed.blob.core.windows.net";
 if(change==="credentials")config.profiles[0].downloadPolicy[0].origin="https://user:password@reviewed.blob.core.windows.net";
 expect(resolveCustomerPlanTrust(profile,directNow,config)).toBeNull();
});
