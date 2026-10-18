import "server-only";
import {prisma} from "@/lib/db";
import {withTenantAwsConnection} from "@/lib/cloud/aws/enrollment/scopedConnection";
import {readVerifiedTerraformBackend} from "@/lib/cloud/aws/enrollment/stsValidation";
import type {EnrollmentRepo} from "@/lib/cloud/aws/enrollment/service";
import type {InstallationRepo} from "@/lib/connectors/github/resolveTenantScopedToken";
import type {AwsResponseBudget} from "@/lib/cloud/aws/ecsObservation/boundedAwsHandler";
import {parseCustomerPlanProfile} from "./customerPlanContract";
import type {TargetSnapshotRows} from "@/lib/releaseops/ecsReleaseV2/targetSnapshot";
import type {CustomerPlanProfile} from "./customerPlanTypes";
import type {CustomerPlanPrincipal} from "./customerPlanAuthority";
export const customerPlanGithubRepository=prisma as unknown as InstallationRepo;
function matchesConnection(profile:CustomerPlanProfile,input:Parameters<typeof readVerifiedTerraformBackend>[0],connection:{id:string;version:number},snapshot:Pick<TargetSnapshotRows,"account"|"credential">){
 return connection.id===profile.connection.id&&connection.version===profile.connection.version&&snapshot.account.organizationId===profile.organizationId&&!snapshot.account.enabled&&snapshot.account.externalAccountId===profile.backend.accountId&&snapshot.account.credentialRef===`cloud-v2:${profile.connection.id}`&&snapshot.account.regions.includes(profile.backend.region)&&input.region===profile.backend.region&&input.roleArn!==profile.producer.planRoleArn;
}
/** Credential decryption and temporary role credentials remain confined to the
 * existing enrollment broker. No route/body can supply either credential set. */
export async function readCustomerBackendForPrincipal(principal:CustomerPlanPrincipal,profileInput:unknown,signal:AbortSignal,budget:AwsResponseBudget,run?:{id:string;attempt:number},operation:"read"|"import"="import"){
 const profile=parseCustomerPlanProfile(profileInput);
 if(profile.organizationId!==principal.organizationId||signal.aborted)throw Error("customer_plan_backend_unavailable");
 return withTenantAwsConnection(prisma as unknown as EnrollmentRepo,principal,profile.connection.id,async(input,connection,snapshot)=>{
  if(signal.aborted||!matchesConnection(profile,input,connection,snapshot))throw Error("customer_plan_backend_unavailable");
  return readVerifiedTerraformBackend(input,profile,signal,run,budget);
 },{managementOnly:operation==="import"});
}
/** Local vault/identity comparison only. No STS, provider read or grant. */
export async function readCustomerPlanConnectionBinding(principal:CustomerPlanPrincipal,profileInput:unknown,operation:"read"|"profile"="profile"):Promise<boolean>{
 try{const profile=parseCustomerPlanProfile(profileInput);if(profile.organizationId!==principal.organizationId)return false;
  return await withTenantAwsConnection(prisma as unknown as EnrollmentRepo,principal,profile.connection.id,async(input,connection,snapshot)=>matchesConnection(profile,input,connection,snapshot),{managementOnly:operation!=="read"});
 }catch{return false;}
}
