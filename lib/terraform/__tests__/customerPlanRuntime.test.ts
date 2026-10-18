import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {customerProfile} from "./customerPlanFixtures";
import {encryptScopedCredential} from "@/lib/security/credentialVault";
import {cloudCredentialContext} from "@/lib/cloud/aws/enrollment/policy";
const m=vi.hoisted(()=>({repo:{} as Record<string,unknown>,read:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:new Proxy({},{get:(_target,key)=>m.repo[String(key)]})}));
vi.mock("@/lib/cloud/aws/enrollment/stsValidation",()=>({readVerifiedTerraformBackend:m.read}));
import {readCustomerPlanConnectionBinding,readCustomerBackendForPrincipal} from "../customerPlanRuntime";
function fixture(){
 const profile=customerProfile(),principal={organizationId:profile.organizationId,userId:"user-owned",sessionId:"session-owned"},roleArn="arn:aws:iam::123456789012:role/observation",privateConfig={expectedAccountId:"123456789012",roleArn,externalId:`axiom-${"a".repeat(32)}`,region:"us-east-1"};
 const account={id:profile.connection.id,organizationId:principal.organizationId,provider:"aws",externalAccountId:"123456789012",credentialRef:`cloud-v2:${profile.connection.id}`,regions:["us-east-1"],autopilotMode:"observe_only",enabled:false,updatedAt:new Date("2026-10-18T00:00:00Z")};
 const credential={id:account.id,organizationId:principal.organizationId,version:3,revokedAt:null as Date|null,encryptedConfiguration:encryptScopedCredential(JSON.stringify(privateConfig),cloudCredentialContext({organizationId:principal.organizationId,accountId:account.id,version:3}))};
 const repo={desktopSessionRecord:{findUnique:vi.fn(async()=>({id:principal.sessionId,organizationId:principal.organizationId,userId:principal.userId,revokedAt:null,expiresAt:new Date("2099-01-01")}))},orgMembership:{findUnique:vi.fn(async()=>({organizationId:principal.organizationId,userId:principal.userId,acceptedAt:new Date(),role:"admin"}))},cloudAccount:{findMany:vi.fn(async()=>[structuredClone(account)])},cloudAccountCredential:{findUnique:vi.fn(async()=>structuredClone(credential))}};m.repo=repo;return {profile,principal,roleArn,credential,repo};
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY","synthetic-owned-customer-runtime-key-at-least32");});afterEach(()=>vi.unstubAllEnvs());
it("confirms distinct CI/read role against the actual scoped vault locally without any STS/provider call",async()=>{
 const f=fixture();expect(await readCustomerPlanConnectionBinding(f.principal,f.profile)).toBe(true);expect(m.read).not.toHaveBeenCalled();expect(f.repo.cloudAccountCredential.findUnique).toHaveBeenCalledTimes(2);
});
it.each(["sameRole","versionChanged","disconnected","ciphertextWrong","roleLost","foreign"])("refuses %s local binding without provider IO",async mode=>{
 const f=fixture();if(mode==="sameRole")f.profile.producer.planRoleArn=f.roleArn;if(mode==="versionChanged")f.profile.connection.version=2;if(mode==="disconnected")f.credential.revokedAt=new Date();if(mode==="ciphertextWrong")f.credential.encryptedConfiguration="invalid";if(mode==="roleLost")f.repo.orgMembership.findUnique.mockResolvedValue({...await f.repo.orgMembership.findUnique(),role:"operator"});if(mode==="foreign")f.profile.organizationId="foreign";
 expect(await readCustomerPlanConnectionBinding(f.principal,f.profile)).toBe(false);expect(m.read).not.toHaveBeenCalled();
});
it("refuses a shared CI/read role before invoking the private STS read adapter",async()=>{
 const f=fixture();f.profile.producer.planRoleArn=f.roleArn;await expect(readCustomerBackendForPrincipal(f.principal,f.profile,new AbortController().signal,{remaining:96*1024*1024})).rejects.toThrow();expect(m.read).not.toHaveBeenCalled();
});
