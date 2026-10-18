import type {SavedPlanDatabase} from "./savedPlanStore";
import {inspectCustomerPlanActor,type CustomerPlanAuthorityRows,type CustomerPlanOperation,type CustomerPlanPrincipal} from "./customerPlanAuthority";
import {parseCustomerPlanProfile} from "./customerPlanContract";
export type CustomerPlanActorRows=Pick<CustomerPlanAuthorityRows,"device"|"membership">;
export type CustomerPlanRequestRows=Pick<CustomerPlanAuthorityRows,"request"|"version">;
async function single<T>(db:SavedPlanDatabase,sql:string,values:unknown[],lock:boolean):Promise<T|null>{
 const rows=await db.$queryRawUnsafe<T[]>(sql+(lock?" FOR UPDATE":""),...values);
 if(!Array.isArray(rows)||rows.length>1)throw Error("customer_plan_context_unavailable");
 return rows.length===1?structuredClone(rows[0]):null;
}
/** Canonical columns only: neither optional feature schema nor credentials. */
export async function loadCustomerPlanActorRows(db:SavedPlanDatabase,principal:CustomerPlanPrincipal,lock=false):Promise<CustomerPlanActorRows|null>{
 const p={...principal};
 const device=await single<CustomerPlanAuthorityRows["device"]>(db,'SELECT "id","organizationId","userId","deviceFingerprint","expiresAt","revokedAt" FROM public."DesktopSessionRecord" WHERE "organizationId"=$1 AND "id"=$2 AND "userId"=$3',[p.organizationId,p.sessionId,p.userId],lock);
 const membership=await single<CustomerPlanAuthorityRows["membership"]>(db,'SELECT "userId","organizationId","role","acceptedAt","updatedAt" FROM public."OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2',[p.organizationId,p.userId],lock);
 return device&&membership?{device,membership}:null;
}
export function loadCustomerPlanRequestVersion(db:SavedPlanDatabase,scope:{organizationId:string;requestId:string;version:number},lock=false){
 return single<CustomerPlanAuthorityRows["version"]>(db,'SELECT "organizationId","deploymentRequestId","version","intakeJson","contentHash" FROM public."TauriDeploymentRequestVersion" WHERE "organizationId"=$1 AND "deploymentRequestId"=$2 AND "version"=$3',[scope.organizationId,scope.requestId,scope.version],lock);
}
export async function loadCustomerPlanRequestRows(db:SavedPlanDatabase,scope:{organizationId:string;requestId:string},lock=false):Promise<CustomerPlanRequestRows|null>{
 const p={...scope};
 const request=await single<CustomerPlanAuthorityRows["request"]>(db,'SELECT "id","organizationId","version","intakeJson" FROM public."TauriDeploymentRequest" WHERE "organizationId"=$1 AND "id"=$2',[p.organizationId,p.requestId],lock);
 if(!request||request.id!==p.requestId||request.organizationId!==p.organizationId)return null;
 const version=await loadCustomerPlanRequestVersion(db,{organizationId:p.organizationId,requestId:p.requestId,version:request.version},lock);
 return version?{request,version}:null;
}
export async function loadCustomerPlanConnectionRows(db:SavedPlanDatabase,scope:{organizationId:string;connectionId:string},lock=false):Promise<Pick<CustomerPlanAuthorityRows,"account"|"credential">|null>{
 const account=await single<CustomerPlanAuthorityRows["account"]>(db,'SELECT "id","organizationId","provider","externalAccountId","credentialRef","regions","enabled","autopilotMode","updatedAt" FROM public."CloudAccount" WHERE "organizationId"=$1 AND "id"=$2 AND "provider"=\'aws\'',[scope.organizationId,scope.connectionId],lock);
 const credential=await single<CustomerPlanAuthorityRows["credential"]>(db,'SELECT "id","organizationId","version","revokedAt" FROM public."CloudAccountCredential" WHERE "organizationId"=$1 AND "id"=$2',[scope.organizationId,scope.connectionId],lock);
 return account&&credential?{account,credential}:null;
}
/** Admission reads are unlocked. Final writes call the same loader INSIDE a
 * Serializable transaction with lock=true, then compare the current decision.
 * No provider IO occurs here or while those final locks are held. */
export async function loadCustomerPlanAuthorityRows(db:SavedPlanDatabase,principal:CustomerPlanPrincipal,profileInput:unknown,options:{operation:CustomerPlanOperation;now:Date;lock?:boolean}):Promise<CustomerPlanAuthorityRows|null>{
 const p={...principal},profile=parseCustomerPlanProfile(profileInput),lock=options.lock===true,operation=options.operation,now=new Date(options.now);
 if(profile.organizationId!==p.organizationId)return null;
 const actor=await loadCustomerPlanActorRows(db,p,lock);if(!actor||!inspectCustomerPlanActor(actor,p,operation,now))return null;
 const request=await loadCustomerPlanRequestRows(db,{organizationId:p.organizationId,requestId:profile.deploymentRequestId},lock);if(!request)return null;
 const environment=await single<CustomerPlanAuthorityRows["environment"]>(db,'SELECT "id","organizationId","slug","name","approvalPolicyId","updatedAt" FROM public."Environment" WHERE "organizationId"=$1 AND "id"=$2',[p.organizationId,profile.environmentId],lock);
 if(!environment)return null;
 const policy=environment.approvalPolicyId===null?null:await single<NonNullable<CustomerPlanAuthorityRows["policy"]>>(db,'SELECT "id","organizationId","enabled","blockAction","updatedAt" FROM public."AxiomApprovalPolicy" WHERE "organizationId"=$1 AND "id"=$2',[p.organizationId,environment.approvalPolicyId],lock);
 if(environment.approvalPolicyId!==null&&!policy)return null;
 const repository=await single<CustomerPlanAuthorityRows["repository"]>(db,'SELECT "id","organizationId","provider","remoteOwner","remoteName","remoteUrl","updatedAt" FROM public."Repository" WHERE "organizationId"=$1 AND "id"=$2',[p.organizationId,profile.repository.recordId],lock);
 const installation=await single<CustomerPlanAuthorityRows["installation"]>(db,'SELECT "id","organizationId","githubInstallationId","accountLogin","status","revokedAt","suspendedAt","updatedAt" FROM public."GitHubInstallation" WHERE "organizationId"=$1 AND "status"=\'active\' ORDER BY "installedAt" DESC LIMIT 1',[p.organizationId],lock);
 const connection=await loadCustomerPlanConnectionRows(db,{organizationId:p.organizationId,connectionId:profile.connection.id},lock);
 return repository&&installation&&connection?{...actor,...request,environment,policy,repository,installation,...connection}:null;
}
