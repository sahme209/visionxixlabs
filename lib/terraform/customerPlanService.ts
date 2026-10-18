import "server-only";
import {randomUUID} from "node:crypto";
import {sha256ContentHash} from "@/lib/tauri/contentHash";
import {readSavedPlanStorageReadiness,type SavedPlanDatabase} from "./savedPlanStore";
import {readCurrentCustomerProfile,readCustomerPlanStorageReadiness,type CurrentCustomerProfile} from "./customerPlanStore";
import {inspectCustomerPlanActor,inspectCustomerPlanAuthority,type CustomerPlanPrincipal,type CustomerPlanOperation} from "./customerPlanAuthority";
import {loadCustomerPlanActorRows,loadCustomerPlanRequestRows,loadCustomerPlanAuthorityRows,loadCustomerPlanConnectionRows} from "./customerPlanRepository";
import {parseCustomerPlanProfile,CUSTOMER_RESPONSE_BUDGET_BYTES,type CustomerPlanProfile} from "./customerPlanContract";
import {readCustomerBackendForPrincipal,readCustomerPlanConnectionBinding,customerPlanGithubRepository} from "./customerPlanRuntime";
import {readCustomerPlanGithubEvidence} from "./customerPlanGithubRead";
import {verifyCustomerPlanProducer,sealVerifiedCustomerPlan,type CustomerPlanProvenanceRow,type CustomerSavedPlanRecord} from "./customerPlanProvenance";
import {bytesDigest} from "./savedPlanArtifact";
import {readConfiguredCustomerPlanTrust} from "./customerPlanTrust";
export interface CustomerPlanServiceDatabase extends SavedPlanDatabase {$transaction<T>(work:(db:SavedPlanDatabase)=>Promise<T>,options:{isolationLevel:"Serializable";maxWait:number;timeout:number}):Promise<T>}
export interface CustomerPlanServiceDependencies {db:CustomerPlanServiceDatabase;now:()=>Date;signal?:AbortSignal}
export type CustomerPlanFailure={kind:"invalid"|"forbidden"|"not_found"|"conflict"|"unavailable";reason:string};
import type {CustomerPlanProfileView,CustomerPlanImported} from "./customerPlanDto";
export type {CustomerPlanProfileView,CustomerPlanImported} from "./customerPlanDto";
class Failure extends Error {constructor(readonly kind:CustomerPlanFailure["kind"],readonly reason:string){super(reason);}}
function fail(kind:CustomerPlanFailure["kind"],reason:string):never{throw new Failure(kind,reason);}
function failure(error:unknown):CustomerPlanFailure{
 if(error instanceof Failure)return {kind:error.kind,reason:error.reason};
 if(error&&typeof error==="object"&&"code" in error&&["P2034","P2002"].includes(String(error.code)))return {kind:"conflict",reason:"customer_plan_concurrent_change"};
 return {kind:"unavailable",reason:"customer_plan_unavailable"};
}
function exact(value:unknown,keys:string[]):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k)))fail("invalid","customer_plan_input_invalid");return value as Record<string,unknown>;}
const positive=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>0&&(value as number)<=2147483647;
const id=(value:unknown):value is string=>typeof value==="string"&&/^[A-Za-z0-9_.:-]{1,200}$/.test(value);
function currentMatches(current:CurrentCustomerProfile|null,expectedRevision:number,profileId?:string){if((current?.profile.revision??0)!==expectedRevision||profileId!==undefined&&current?.profile.id!==profileId)fail("conflict","customer_plan_profile_revision_conflict");}
function view(current:CurrentCustomerProfile|null,manage=false):CustomerPlanProfileView{return {kind:"customer_plan_profile",profile:current?.profile??null,status:current?.status??"unconfigured",currentTarget:current?.status==="active"?"not_observed":"unavailable",approval:"unavailable",executionAllowed:false,permissions:{configure:manage,import:manage}};}
async function admission(db:SavedPlanDatabase,principal:CustomerPlanPrincipal,requestId:string,operation:CustomerPlanOperation,now:Date,lock=false){
 if(!id(principal.organizationId)||!id(principal.userId)||!id(principal.sessionId)||!id(requestId)||!Number.isFinite(now.getTime()))fail("invalid","customer_plan_input_invalid");
 const actor=await loadCustomerPlanActorRows(db,principal,lock);if(!actor||!inspectCustomerPlanActor(actor,principal,operation,now))fail("forbidden","customer_plan_current_actor_required");
 const request=await loadCustomerPlanRequestRows(db,{organizationId:principal.organizationId,requestId},lock);if(!request)fail("not_found","deployment_request_not_found");
 if(request.version.organizationId!==principal.organizationId||request.version.deploymentRequestId!==requestId||request.version.version!==request.request.version)fail("conflict","customer_plan_request_version_conflict");
 return {...actor,...request};
}
async function ready(db:SavedPlanDatabase){if(await readSavedPlanStorageReadiness(db)!=="ready"||await readCustomerPlanStorageReadiness(db)!=="ready")fail("unavailable","customer_plan_storage_unavailable");}
function requestVersion(rows:Awaited<ReturnType<typeof admission>>,expected:number){if(rows.request.version!==expected)fail("conflict","customer_plan_request_version_conflict");}
async function persistProfile(db:SavedPlanDatabase,profile:CustomerPlanProfile,status:"active"|"revoked",principal:CustomerPlanPrincipal,expectedRevision:number,now:Date){
 const rows=await db.$queryRawUnsafe<Array<{id:string;revision:number}>>(`INSERT INTO public."TerraformCustomerPlanProfile" ("id","revision","organizationId","deploymentRequestId","requestVersion","environmentId","profileJson","profileDigest","createdAt","actorUserId") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) RETURNING "id","revision"`,profile.id,profile.revision,profile.organizationId,profile.deploymentRequestId,profile.requestVersion,profile.environmentId,JSON.stringify(profile),sha256ContentHash(profile),now,principal.userId);
 if(rows.length!==1||rows[0].id!==profile.id||rows[0].revision!==profile.revision)throw Error("customer_plan_profile_insert_unconfirmed");
 const values=[profile.id,profile.revision,profile.organizationId,profile.deploymentRequestId,profile.environmentId,status,...(expectedRevision===0?[now]:[expectedRevision,now])];
 const changed=await db.$queryRawUnsafe<Array<{id:string;revision:number}>>(expectedRevision===0?`INSERT INTO public."TerraformCustomerPlanCurrent" ("id","revision","organizationId","deploymentRequestId","environmentId","status","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "id","revision"`:`UPDATE public."TerraformCustomerPlanCurrent" SET "revision"=$2,"status"=$6,"updatedAt"=$8 WHERE "id"=$1 AND "organizationId"=$3 AND "deploymentRequestId"=$4 AND "environmentId"=$5 AND "revision"=$7 RETURNING "id","revision"`,...values);
 if(changed.length!==1||changed[0].id!==profile.id||changed[0].revision!==profile.revision)fail("conflict","customer_plan_profile_revision_conflict");
}
/** Profile writes bind current canonical rows, not backend read success or an
 * execution permit. Only import may acquire exact producer/backend evidence. */
export async function configureCustomerPlanProfile(deps:CustomerPlanServiceDependencies,principalInput:CustomerPlanPrincipal,requestId:string,input:unknown):Promise<CustomerPlanProfileView|CustomerPlanFailure>{
 try{
  const principal={...principalInput},body=exact(input,["requestVersion","expectedRevision","profileInput"]);
  if(!positive(body.requestVersion)||!Number.isSafeInteger(body.expectedRevision)||(body.expectedRevision as number)<0||(body.expectedRevision as number)>=2147483647)fail("invalid","customer_plan_input_invalid");
  const expectedRevision=body.expectedRevision as number,expectedVersion=body.requestVersion;
  const raw=exact(body.profileInput,["environmentId","repository","producer","configuration","backend","artifacts","connection"]),backend=exact(raw.backend,["region","bucket","key","lockTable"]),connection=exact(raw.connection,["id"]);
  if(!id(connection.id)||!id(raw.environmentId))fail("invalid","customer_plan_input_invalid");
  // Snapshot caller-owned nested values before the first asynchronous read.
  const config=structuredClone(raw),backendConfig=structuredClone(backend),connectionId=connection.id;
  const rows=await admission(deps.db,principal,requestId,"profile",deps.now());requestVersion(rows,expectedVersion);await ready(deps.db);
  const scope={organizationId:principal.organizationId,requestId},current=await readCurrentCustomerProfile(deps.db,scope);currentMatches(current,expectedRevision);
  if(current&&current.profile.environmentId!==config.environmentId)fail("conflict","customer_plan_environment_immutable_new_request");
  const bound=await loadCustomerPlanConnectionRows(deps.db,{organizationId:principal.organizationId,connectionId});if(!bound)fail("conflict","customer_plan_context_changed");
  let profile:CustomerPlanProfile;
  try{profile=parseCustomerPlanProfile({schema:"axiom.terraform.customer-profile.v2",id:current?.profile.id??`tfcp-${randomUUID()}`,organizationId:principal.organizationId,deploymentRequestId:requestId,requestVersion:expectedVersion,revision:expectedRevision+1,...config,
   backend:{...backendConfig,kind:"s3_dynamodb",accountId:bound.account.externalAccountId,workspace:"default",lockKey:`${backendConfig.bucket}/${backendConfig.key}`},connection:{id:connectionId,version:bound.credential.version}});}catch{fail("invalid","customer_plan_input_invalid");}
  const authorityRows=await loadCustomerPlanAuthorityRows(deps.db,principal,profile,{operation:"profile",now:deps.now()}),decision=inspectCustomerPlanAuthority(profile,authorityRows,principal,"profile",deps.now());
  if(!decision)fail("conflict","customer_plan_context_changed");if(!await readCustomerPlanConnectionBinding(principal,profile))fail("conflict","customer_plan_connection_binding_unavailable");const trust=readConfiguredCustomerPlanTrust(profile,deps.now());if(!trust)fail("unavailable","customer_plan_trust_unavailable");const trustDigest=sha256ContentHash(trust);
  return await deps.db.$transaction(async tx=>{
   const locked=await admission(tx,principal,requestId,"profile",deps.now(),true);requestVersion(locked,expectedVersion);await ready(tx);
   const pointer=await readCurrentCustomerProfile(tx,scope,true);currentMatches(pointer,expectedRevision);
   if(sha256ContentHash(pointer)!==sha256ContentHash(current))fail("conflict","customer_plan_profile_revision_conflict");
   const finalRows=await loadCustomerPlanAuthorityRows(tx,principal,profile,{operation:"profile",now:deps.now(),lock:true}),now=deps.now();
   const final=inspectCustomerPlanAuthority(profile,finalRows,principal,"profile",now),finalTrust=readConfiguredCustomerPlanTrust(profile,now);
   if(!final||final.contextDigest!==decision.contextDigest||!finalTrust||sha256ContentHash(finalTrust)!==trustDigest)fail("conflict","customer_plan_context_changed");
   await persistProfile(tx,profile,"active",principal,expectedRevision,now);if(!finalRows||!inspectCustomerPlanActor(finalRows,principal,"profile",deps.now()))fail("forbidden","customer_plan_current_actor_required");return view({profile,status:"active"},true);
  },{isolationLevel:"Serializable",maxWait:3000,timeout:5000});
 }catch(error){return failure(error);}
}
/** Deny-only revocation preserves the old requestVersion/config. It requires
 * current actor/request locks/CAS but never asserts the drifted target is valid. */
export async function revokeCustomerPlanProfile(deps:CustomerPlanServiceDependencies,principalInput:CustomerPlanPrincipal,requestId:string,input:unknown):Promise<CustomerPlanProfileView|CustomerPlanFailure>{
 try{
  const principal={...principalInput},body=exact(input,["requestVersion","profileId","expectedRevision"]);if(!positive(body.requestVersion)||!positive(body.expectedRevision)||!id(body.profileId))fail("invalid","customer_plan_input_invalid");
  const expectedVersion=body.requestVersion,expectedRevision=body.expectedRevision,profileId=body.profileId,scope={organizationId:principal.organizationId,requestId};
  const rows=await admission(deps.db,principal,requestId,"profile",deps.now());requestVersion(rows,expectedVersion);await ready(deps.db);
  const current=await readCurrentCustomerProfile(deps.db,scope);currentMatches(current,expectedRevision,profileId);if(!current)fail("conflict","customer_plan_profile_revision_conflict");
  const profile=parseCustomerPlanProfile({...current.profile,revision:expectedRevision+1});
  return await deps.db.$transaction(async tx=>{
   const locked=await admission(tx,principal,requestId,"profile",deps.now(),true);requestVersion(locked,expectedVersion);await ready(tx);
   const pointer=await readCurrentCustomerProfile(tx,scope,true);currentMatches(pointer,expectedRevision,profileId);if(sha256ContentHash(pointer)!==sha256ContentHash(current))fail("conflict","customer_plan_profile_revision_conflict");
   const now=deps.now();if(!inspectCustomerPlanActor(locked,principal,"profile",now))fail("forbidden","customer_plan_current_actor_required");
   await persistProfile(tx,profile,"revoked",principal,expectedRevision,now);if(!inspectCustomerPlanActor(locked,principal,"profile",deps.now()))fail("forbidden","customer_plan_current_actor_required");return view({profile,status:"revoked"},true);
  },{isolationLevel:"Serializable",maxWait:3000,timeout:5000});
 }catch(error){return failure(error);}
}
export async function readCustomerPlanProfile(deps:CustomerPlanServiceDependencies,principalInput:CustomerPlanPrincipal,requestId:string):Promise<CustomerPlanProfileView|CustomerPlanFailure>{
 try{
  const principal={...principalInput};await admission(deps.db,principal,requestId,"read",deps.now());await ready(deps.db);
  const scope={organizationId:principal.organizationId,requestId},current=await readCurrentCustomerProfile(deps.db,scope),result=view(current);let exportContextDigest:string|undefined,exportTrustDigest:string|undefined;
  if(current?.status==="active"){
   const rows=await loadCustomerPlanAuthorityRows(deps.db,principal,current.profile,{operation:"read",now:deps.now()}),now=deps.now(),context=inspectCustomerPlanAuthority(current.profile,rows,principal,"read",now),trust=readConfiguredCustomerPlanTrust(current.profile,now);
   if(context&&trust&&await readCustomerPlanConnectionBinding(principal,current.profile,"read")){result.profileExport={schema:"axiom.terraform.profile-export.v2",profile:current.profile,requestContentHash:context.requestContentHash,targetDigest:context.targetDigest,toolchain:{version:trust.terraformVersion,executableDigest:trust.executableDigest}};exportContextDigest=context.contextDigest;exportTrustDigest=trust.digest;}
  }
  if(result.profileExport&&current){
   const pointer=await readCurrentCustomerProfile(deps.db,scope),rows=await loadCustomerPlanAuthorityRows(deps.db,principal,current.profile,{operation:"read",now:deps.now()}),now=deps.now(),checked=inspectCustomerPlanAuthority(current.profile,rows,principal,"read",now),trust=readConfiguredCustomerPlanTrust(current.profile,now);
   if(sha256ContentHash(pointer)!==sha256ContentHash(current)||checked?.contextDigest!==exportContextDigest||trust?.digest!==exportTrustDigest)delete result.profileExport;
  }
  const final=await admission(deps.db,principal,requestId,"read",deps.now());if(result.profileExport&&readConfiguredCustomerPlanTrust(result.profileExport.profile,deps.now())?.digest!==exportTrustDigest)delete result.profileExport;result.permissions={configure:inspectCustomerPlanActor(final,principal,"profile",deps.now())!==null,import:inspectCustomerPlanActor(final,principal,"import",deps.now())!==null};return result;
 }catch(error){return failure(error);}
}

function activeProfile(current:CurrentCustomerProfile|null,body:{profileId:string;profileRevision:number;requestVersion:number}){
 if(!current||current.status!=="active"||current.profile.id!==body.profileId||current.profile.revision!==body.profileRevision||current.profile.requestVersion!==body.requestVersion)fail("conflict","customer_plan_profile_revision_conflict");return current.profile;
}
async function persistArtifact(db:SavedPlanDatabase,artifact:CustomerSavedPlanRecord,provenance:CustomerPlanProvenanceRow):Promise<boolean>{
 const scope=[artifact.organizationId,artifact.deploymentRequestId,artifact.id];
 const existing=await db.$queryRawUnsafe<Array<{id:string;requestVersion:number;bindingDigest:string;binaryDigest:string;showDigest:string;binaryBytes:number}>>('SELECT "id","requestVersion","bindingDigest","binaryDigest","showDigest","binaryBytes" FROM public."TerraformSavedPlanArtifact" WHERE "organizationId"=$1 AND "deploymentRequestId"=$2 AND "id"=$3 FOR UPDATE',...scope);
 if(existing.length){
  if(existing.length!==1||Object.entries(existing[0]).some(([key,value])=>value!==artifact[key as keyof CustomerSavedPlanRecord]))fail("conflict","customer_plan_import_conflict");
  const proof=await db.$queryRawUnsafe<CustomerPlanProvenanceRow[]>('SELECT "artifactId","organizationId","deploymentRequestId","requestVersion","profileId","profileRevision","bindingDigest","binaryDigest","showDigest","receiptDigest","attestationDigest","trustDigest" FROM public."TerraformCustomerPlanProvenance" WHERE "organizationId"=$1 AND "deploymentRequestId"=$2 AND "artifactId"=$3 FOR UPDATE',...scope);
  if(proof.length!==1||Object.entries(proof[0]).some(([key,value])=>value!==provenance[key as keyof CustomerPlanProvenanceRow]))fail("conflict","customer_plan_import_conflict");return true;
 }
 const a=artifact,p=provenance;
 const inserted=await db.$queryRawUnsafe<Array<{id:string}>>(`INSERT INTO public."TerraformSavedPlanArtifact" ("id","organizationId","deploymentRequestId","requestVersion","bindingJson","bindingDigest","binaryDigest","binaryBytes","showDigest","encryptedBinary","encryptedShow","createdAt","expiresAt") VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING "id"`,a.id,a.organizationId,a.deploymentRequestId,a.requestVersion,JSON.stringify(a.bindingJson),a.bindingDigest,a.binaryDigest,a.binaryBytes,a.showDigest,a.encryptedBinary,a.encryptedShow,a.createdAt,a.expiresAt);
 if(inserted.length!==1||inserted[0].id!==a.id)throw Error("customer_plan_artifact_insert_unconfirmed");
 const linked=await db.$queryRawUnsafe<Array<{artifactId:string}>>(`INSERT INTO public."TerraformCustomerPlanProvenance" ("artifactId","organizationId","deploymentRequestId","requestVersion","profileId","profileRevision","bindingDigest","binaryDigest","showDigest","receiptDigest","attestationDigest","trustDigest","encryptedProof","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING "artifactId"`,p.artifactId,p.organizationId,p.deploymentRequestId,p.requestVersion,p.profileId,p.profileRevision,p.bindingDigest,p.binaryDigest,p.showDigest,p.receiptDigest,p.attestationDigest,p.trustDigest,p.encryptedProof,p.createdAt);
 if(linked.length!==1||linked[0].artifactId!==a.id)throw Error("customer_plan_provenance_insert_unconfirmed");return false;
}
/** The HTTP caller supplies identifiers only. Exact private artifacts come from
 * the reviewed fixed-key reader; only the private verified-result identity can
 * seal them. One aggregate budget/deadline spans every initial/final read. */
export async function importCustomerSavedPlan(deps:CustomerPlanServiceDependencies,principalInput:CustomerPlanPrincipal,requestId:string,input:unknown):Promise<CustomerPlanImported|CustomerPlanFailure>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const principal={...principalInput},raw=exact(input,["requestVersion","profileId","profileRevision","runId","runAttempt"]);
  if(!positive(raw.requestVersion)||!positive(raw.profileRevision)||!id(raw.profileId)||typeof raw.runId!=="string"||!/^[1-9]\d{0,31}$/.test(raw.runId)||!positive(raw.runAttempt))fail("invalid","customer_plan_input_invalid");
  const body={requestVersion:raw.requestVersion,profileId:raw.profileId,profileRevision:raw.profileRevision,runId:raw.runId,runAttempt:raw.runAttempt},run={id:body.runId,attempt:body.runAttempt};
  const controller=new AbortController();timer=setTimeout(()=>controller.abort(),30_000);const signal=deps.signal?AbortSignal.any([controller.signal,deps.signal]):controller.signal,budget={remaining:CUSTOMER_RESPONSE_BUDGET_BYTES};
  signal.throwIfAborted();const admitted=await admission(deps.db,principal,requestId,"import",deps.now());requestVersion(admitted,body.requestVersion);await ready(deps.db);
  const scope={organizationId:principal.organizationId,requestId},current=await readCurrentCustomerProfile(deps.db,scope),profile=activeProfile(current,body);
  const rows=await loadCustomerPlanAuthorityRows(deps.db,principal,profile,{operation:"import",now:deps.now()}),decision=inspectCustomerPlanAuthority(profile,rows,principal,"import",deps.now());
  if(!rows||!decision)fail("conflict","customer_plan_context_changed");const trust=readConfiguredCustomerPlanTrust(profile,deps.now());if(!trust)fail("unavailable","customer_plan_trust_unavailable");const trustDigest=sha256ContentHash(trust);
  async function currentAuthority():Promise<boolean>{
   try{signal.throwIfAborted();const latest=await admission(deps.db,principal,requestId,"import",deps.now());requestVersion(latest,body.requestVersion);const pointer=await readCurrentCustomerProfile(deps.db,scope);activeProfile(pointer,body);
    if(sha256ContentHash(pointer)!==sha256ContentHash(current))return false;
    const latestRows=await loadCustomerPlanAuthorityRows(deps.db,principal,profile,{operation:"import",now:deps.now()}),now=deps.now(),checked=inspectCustomerPlanAuthority(profile,latestRows,principal,"import",now),configured=readConfiguredCustomerPlanTrust(profile,now);
    return !signal.aborted&&checked?.contextDigest===decision!.contextDigest&&configured!==null&&sha256ContentHash(configured)===trustDigest;
   }catch{return false;}
  }
  if(!await currentAuthority())fail("conflict","customer_plan_context_changed");
  const observed=await readCustomerBackendForPrincipal(principal,profile,signal,budget,run);signal.throwIfAborted();
  if(observed.kind!=="observed_customer_backend"||!observed.artifacts)fail("unavailable",observed.kind==="unavailable"?observed.reason:"customer_plan_artifact_unavailable");
  const source=await readCustomerPlanGithubEvidence({profile,run,receiptDigest:bytesDigest(observed.artifacts.receipt.bytes),installation:rows.installation,repo:customerPlanGithubRepository,current:currentAuthority,signal,budget,downloadPolicy:trust.downloadPolicy});signal.throwIfAborted();
  if(source.kind!=="read_customer_plan_source")fail("unavailable","customer_plan_producer_unavailable");
  let sealed:ReturnType<typeof sealVerifiedCustomerPlan>|undefined;
  for(const bundle of source.bundles){
   const verified=await verifyCustomerPlanProducer({profile,requestContentHash:decision.requestContentHash,targetDigest:decision.targetDigest,run,binary:observed.artifacts.binary.bytes,show:observed.artifacts.show.bytes,receipt:observed.artifacts.receipt.bytes,bundle,trust,now:deps.now(),authorize:async org=>org===principal.organizationId&&await currentAuthority()});signal.throwIfAborted();
   if(verified.kind==="verified_customer_plan"){if(sha256ContentHash(verified.binding.backendState)!==sha256ContentHash(observed.state))fail("conflict","customer_plan_backend_changed");sealed=sealVerifiedCustomerPlan(verified);break;}
  }
  if(!sealed)fail("unavailable","customer_plan_producer_unavailable");
  if(!await currentAuthority())fail("conflict","customer_plan_context_changed");
  const finalObservation=await readCustomerBackendForPrincipal(principal,profile,signal,budget);signal.throwIfAborted();
  if(finalObservation.kind!=="observed_customer_backend"||sha256ContentHash(finalObservation.state)!==sha256ContentHash(sealed.artifact.bindingJson.backendState))fail("conflict","customer_plan_backend_changed");
  const artifact=sealed.artifact,provenance=sealed.provenance;
  const committed=await deps.db.$transaction(async tx=>{
   signal.throwIfAborted();const locked=await admission(tx,principal,requestId,"import",deps.now(),true);requestVersion(locked,body.requestVersion);await ready(tx);
   const pointer=await readCurrentCustomerProfile(tx,scope,true);activeProfile(pointer,body);if(sha256ContentHash(pointer)!==sha256ContentHash(current))fail("conflict","customer_plan_profile_revision_conflict");
   const finalRows=await loadCustomerPlanAuthorityRows(tx,principal,profile,{operation:"import",now:deps.now(),lock:true}),now=deps.now(),final=inspectCustomerPlanAuthority(profile,finalRows,principal,"import",now),configured=readConfiguredCustomerPlanTrust(profile,now);
   signal.throwIfAborted();if(!final||final.contextDigest!==decision.contextDigest||!configured||sha256ContentHash(configured)!==trustDigest||now.getTime()>=artifact.expiresAt.getTime())fail("conflict","customer_plan_context_changed");
   const reused=await persistArtifact(tx,artifact,provenance);signal.throwIfAborted();const after=deps.now();if(!finalRows||!inspectCustomerPlanActor(finalRows,principal,"import",after)||after.getTime()>=artifact.expiresAt.getTime())fail("conflict","customer_plan_context_changed");return {kind:"customer_plan_imported" as const,artifactId:artifact.id,reused,approval:"unavailable" as const,executionAllowed:false as const};
  },{isolationLevel:"Serializable",maxWait:3000,timeout:5000});signal.throwIfAborted();return committed;
 }catch(error){return failure(error);}finally{if(timer)clearTimeout(timer);}
}
