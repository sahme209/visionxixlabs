import "server-only";
import {sha256ContentHash} from "@/lib/tauri/contentHash";
import {decryptScopedCredential} from "@/lib/security/credentialVault";
import {readSavedPlanStorageReadiness,listSavedPlanRecords,type SavedPlanDatabase} from "./savedPlanStore";
import {readCustomerPlanStorageReadiness,readCurrentCustomerProfile} from "./customerPlanStore";
import {loadCustomerPlanActorRows,loadCustomerPlanRequestRows,loadCustomerPlanRequestVersion,loadCustomerPlanAuthorityRows} from "./customerPlanRepository";
import {inspectCustomerPlanActor,inspectCustomerPlanAuthority,type CustomerPlanPrincipal} from "./customerPlanAuthority";
import {parseCustomerSavedPlanBinding,customerImportId,CUSTOMER_RESPONSE_BUDGET_BYTES,CUSTOMER_RECEIPT_MAX_BYTES} from "./customerPlanContract";
import {parseSavedPlanBinding,openSavedPlan,readSavedPlanMetadata,inspectSavedPlanJson,bytesDigest,MAX_PLAN_BYTES,MAX_SHOW_BYTES,type SavedPlanRecord} from "./savedPlanArtifact";
import {customerArtifactContext,verifyCustomerPlanProducer,type CustomerPlanProvenanceRow} from "./customerPlanProvenance";
import {readConfiguredCustomerPlanTrust} from "./customerPlanTrust";
import {readCustomerBackendForPrincipal,customerPlanGithubRepository} from "./customerPlanRuntime";
import {readCustomerPlanGithubEvidence} from "./customerPlanGithubRead";
import type {CustomerSavedPlanMetadata,CustomerSavedPlanProjection,TerraformPlanReadData} from "./customerPlanDto";
type Artifact=Omit<SavedPlanRecord,"bindingJson">&{bindingJson:unknown};
export type TerraformPlanReadResult={status:number;body:{ok:true;data:TerraformPlanReadData}|{ok:false;error:string}};
class Denied extends Error{}
function requireValue(value:unknown):asserts value{if(!value)throw Error("customer_plan_evidence_unavailable");}
function customerMetadata(row:Artifact,scope:{organizationId:string;requestId:string;requestVersion:number},now:Date):CustomerSavedPlanMetadata{
 const b=parseCustomerSavedPlanBinding(row.bindingJson),p=b.profile;
 requireValue(row.organizationId===scope.organizationId&&row.deploymentRequestId===scope.requestId&&p.organizationId===row.organizationId&&p.deploymentRequestId===row.deploymentRequestId&&p.requestVersion===row.requestVersion&&row.id===customerImportId(b)&&sha256ContentHash(b)===row.bindingDigest&&row.binaryDigest===b.binaryDigest
  &&Number.isSafeInteger(row.binaryBytes)&&row.binaryBytes>0&&row.binaryBytes<=MAX_PLAN_BYTES&&row.createdAt instanceof Date&&row.expiresAt instanceof Date&&row.createdAt.getTime()===Date.parse(b.createdAt)&&row.expiresAt.getTime()===Date.parse(b.expiresAt)&&row.createdAt<=now&&row.requestVersion<=scope.requestVersion);
 return {id:row.id,binaryDigest:row.binaryDigest,binaryBytes:row.binaryBytes,environmentId:p.environmentId,requestVersion:row.requestVersion,terraformVersion:b.terraformVersion,createdAt:b.createdAt,expiresAt:b.expiresAt,evidenceScope:"customer_ci_attested",inspection:"metadata_only",approval:"unavailable",currentTarget:"not_observed",executionEnabled:false,historical:row.requestVersion!==scope.requestVersion||row.expiresAt<=now,profileId:p.id,profileRevision:p.revision,runId:b.producer.runId,runAttempt:b.producer.runAttempt};
}
// Reject alternate/ignored base64url spellings before vault decryption,
// without allocating a second full-size ciphertext buffer.
function canonicalEnvelope(value:unknown,max:number):value is string{
 if(typeof value!=="string"||!value.startsWith("v2.")||value.length>max)return false;const raw=value.slice(3),remainder=raw.length%4;
 if(raw.length<38||remainder===1||!/^[A-Za-z0-9_-]+$/.test(raw))return false;
 const last="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".indexOf(raw.at(-1)!);return remainder===0||remainder===2&&(last&15)===0||remainder===3&&(last&3)===0;
}
function base64(value:unknown,max:number):Buffer{requireValue(typeof value==="string"&&value.length<=max*2);const bytes=Buffer.from(value,"base64");requireValue(bytes.length>0&&bytes.length<=max&&bytes.toString("base64")===value);return bytes;}
/** Explicit v1/v2 dispatch: fixture bytes/meaning stay unchanged. Lists are
 * metadata only. Customer detail re-verifies stored signature/bytes separately
 * from a fresh read-only backend observation; neither grants approval/apply. */
export async function readTerraformPlans(db:SavedPlanDatabase,principalInput:CustomerPlanPrincipal,requestId:string,artifactId?:string,nowInput:Date|(()=>Date)=()=>new Date(),parent?:AbortSignal):Promise<TerraformPlanReadResult>{
 const principal={...principalInput},clock=typeof nowInput==="function"?nowInput:()=>new Date(nowInput.getTime());let timer:ReturnType<typeof setTimeout>|undefined;
 const failure=(status:number,error:string):TerraformPlanReadResult=>({status,body:{ok:false,error}});
 try{
  async function actor(){const rows=await loadCustomerPlanActorRows(db,principal);if(!rows||!inspectCustomerPlanActor(rows,principal,"read",clock()))throw new Denied();return rows;}
  await actor();const parents=await db.$queryRawUnsafe<Array<{id:string;organizationId:string;version:number}>>('SELECT "id","organizationId","version" FROM public."TauriDeploymentRequest" WHERE "organizationId"=$1 AND "id"=$2',principal.organizationId,requestId);if(parents.length!==1||parents[0].id!==requestId||parents[0].organizationId!==principal.organizationId)return failure(404,"not_found");requireValue(Number.isSafeInteger(parents[0].version)&&parents[0].version>0);
  const scope={organizationId:principal.organizationId,requestId,requestVersion:parents[0].version},legacy=await readSavedPlanStorageReadiness(db);if(legacy!=="ready")return failure(503,`saved_plan_storage_${legacy}`);
  const records:Artifact[]=await listSavedPlanRecords(db,scope,artifactId);if(artifactId!==undefined&&(records.length!==1||records[0].id!==artifactId))return failure(404,"not_found");requireValue(records.length<=21);
  const v2=records.some(row=>!!row.bindingJson&&typeof row.bindingJson==="object"&&"schema" in row.bindingJson&&row.bindingJson.schema==="axiom.terraform.saved-plan.v2");
  if(v2&&await readCustomerPlanStorageReadiness(db)!=="ready")return failure(503,"customer_plan_storage_unavailable");
  const plans:TerraformPlanReadData["plans"]=[];
  for(const row of records.slice(0,20)){
   const value=row.bindingJson;
   if(value&&typeof value==="object"&&"schema" in value&&value.schema==="axiom.terraform.saved-plan.v1"){
    const bindingJson=parseSavedPlanBinding(value);plans.push((artifactId===undefined?readSavedPlanMetadata:openSavedPlan)({...row,bindingJson},scope,clock()));continue;
   }
   const metadata=customerMetadata(row,scope,clock());if(artifactId===undefined){plans.push(metadata);continue;}
   const binding=parseCustomerSavedPlanBinding(row.bindingJson),profile=binding.profile,now=clock(),trust=readConfiguredCustomerPlanTrust(profile,now);const version=await loadCustomerPlanRequestVersion(db,{organizationId:scope.organizationId,requestId,version:row.requestVersion});requireValue(version&&version.organizationId===scope.organizationId&&version.deploymentRequestId===requestId&&version.version===row.requestVersion&&version.contentHash===binding.requestContentHash&&sha256ContentHash(version.intakeJson)===version.contentHash);requireValue(trust&&trust.digest===binding.producer.trustDigest&&row.showDigest===binding.showDigest);
   const stored=await db.$queryRawUnsafe<CustomerPlanProvenanceRow[]>('SELECT "artifactId","organizationId","deploymentRequestId","requestVersion","profileId","profileRevision","bindingDigest","binaryDigest","showDigest","receiptDigest","attestationDigest","trustDigest","encryptedProof","createdAt" FROM public."TerraformCustomerPlanProvenance" WHERE "organizationId"=$1 AND "deploymentRequestId"=$2 AND "artifactId"=$3 LIMIT 2',scope.organizationId,requestId,row.id);
   requireValue(stored.length===1);const proof=stored[0];
   requireValue(proof.artifactId===row.id&&proof.organizationId===scope.organizationId&&proof.deploymentRequestId===requestId&&proof.requestVersion===row.requestVersion&&proof.profileId===profile.id&&proof.profileRevision===profile.revision&&proof.bindingDigest===row.bindingDigest&&proof.binaryDigest===row.binaryDigest&&proof.showDigest===row.showDigest&&proof.receiptDigest===binding.producer.receiptDigest&&proof.attestationDigest===binding.producer.attestationDigest&&proof.trustDigest===binding.producer.trustDigest&&proof.createdAt instanceof Date&&proof.createdAt.getTime()===row.createdAt.getTime());
   requireValue(canonicalEnvelope(row.encryptedBinary,MAX_PLAN_BYTES*2)&&canonicalEnvelope(row.encryptedShow,MAX_SHOW_BYTES*2)&&canonicalEnvelope(proof.encryptedProof,3*1024*1024));
   const binary=base64(decryptScopedCredential(row.encryptedBinary,customerArtifactContext(row,"binary")),MAX_PLAN_BYTES),show=decryptScopedCredential(row.encryptedShow,customerArtifactContext(row,"show")),proofJson:unknown=JSON.parse(decryptScopedCredential(proof.encryptedProof,customerArtifactContext(row,"proof")));
   requireValue(binary.length===row.binaryBytes&&bytesDigest(binary)===binding.binaryDigest&&bytesDigest(show)===binding.showDigest&&proofJson&&typeof proofJson==="object"&&!Array.isArray(proofJson)&&Object.keys(proofJson).length===2&&"receipt" in proofJson&&"bundle" in proofJson);
   const receipt=base64(proofJson.receipt,CUSTOMER_RECEIPT_MAX_BYTES),bundle=base64(proofJson.bundle,1024*1024),run={id:binding.producer.runId,attempt:binding.producer.runAttempt};
   const controller=new AbortController();timer=setTimeout(()=>controller.abort(),30_000);const signal=parent?AbortSignal.any([controller.signal,parent]):controller.signal,budget={remaining:CUSTOMER_RESPONSE_BUDGET_BYTES};
   async function authorize(org:string){try{signal.throwIfAborted();await actor();const parent=await loadCustomerPlanRequestRows(db,{organizationId:principal.organizationId,requestId});return org===principal.organizationId&&parent!==null;}catch{return false;}}
   // Historical verification uses the artifact's original bounded validity
   // interval. Current expiry is always explicit and forbids current matching.
   const verified=await verifyCustomerPlanProducer({profile,requestContentHash:binding.requestContentHash,targetDigest:binding.targetDigest,run,binary,show:Buffer.from(show),receipt,bundle,trust,now:new Date(binding.createdAt),authorize});signal.throwIfAborted();
   requireValue(verified.kind==="verified_customer_plan"&&sha256ContentHash(verified.binding)===row.bindingDigest);
   const detail:CustomerSavedPlanProjection={...metadata,inspection:"producer_bytes_verified",currentTarget:"unavailable",validity:Date.parse(binding.expiresAt)>clock().getTime()?"unexpired":"expired",summary:inspectSavedPlanJson(show,binding.terraformVersion)};
   const current=await readCurrentCustomerProfile(db,scope);if(current?.status!=="active"||sha256ContentHash(current.profile)!==binding.profileDigest)detail.historical=true;
   if(detail.validity==="unexpired"&&!metadata.historical&&current?.status==="active"&&sha256ContentHash(current.profile)===binding.profileDigest){
    const rows=await loadCustomerPlanAuthorityRows(db,principal,profile,{operation:"read",now:clock()}),decision=inspectCustomerPlanAuthority(profile,rows,principal,"read",clock());
    async function currentAuthority(){try{signal.throwIfAborted();await actor();const current=await readCurrentCustomerProfile(db,scope),rows=await loadCustomerPlanAuthorityRows(db,principal,profile,{operation:"read",now:clock()}),latest=inspectCustomerPlanAuthority(profile,rows,principal,"read",clock()),configured=readConfiguredCustomerPlanTrust(profile,clock());return !!decision&&current?.status==="active"&&sha256ContentHash(current.profile)===binding.profileDigest&&latest?.contextDigest===decision.contextDigest&&configured!==null&&configured.digest===binding.producer.trustDigest&&Date.parse(binding.expiresAt)>clock().getTime();}catch{return false;}}
    if(rows&&decision?.targetDigest===binding.targetDigest&&decision.requestContentHash===binding.requestContentHash&&await currentAuthority()){
     const observed=await readCustomerBackendForPrincipal(principal,profile,signal,budget,undefined,"read");
     if(observed.kind==="observed_customer_backend"&&sha256ContentHash(observed.state)===sha256ContentHash(binding.backendState)&&await currentAuthority()){
      const source=await readCustomerPlanGithubEvidence({profile,run,receiptDigest:binding.producer.receiptDigest,installation:rows.installation,repo:customerPlanGithubRepository,current:currentAuthority,signal,budget,downloadPolicy:trust.downloadPolicy});
      if(source.kind==="read_customer_plan_source"&&source.bundles.some(bytes=>`sha256:${bytesDigest(bytes)}`===binding.producer.attestationDigest)&&await currentAuthority()){detail.currentTarget="observed_match";detail.observedAt=observed.observedAt;}
     }
    }
   }
   signal.throwIfAborted();const finalTrust=readConfiguredCustomerPlanTrust(profile,clock());requireValue(finalTrust&&finalTrust.digest===binding.producer.trustDigest);
   if(Date.parse(binding.expiresAt)<=clock().getTime()){detail.validity="expired";detail.historical=true;detail.currentTarget="unavailable";delete detail.observedAt;}
   plans.push(detail);
  }
  await actor();return {status:200,body:{ok:true,data:{plans,truncated:records.length>20,producer:v2?"customer_ci_import":"unavailable",executionEnabled:false}}};
 }catch(error){return error instanceof Denied?failure(403,"customer_plan_current_actor_required"):failure(409,"saved_plan_evidence_unavailable");}finally{if(timer)clearTimeout(timer);}
}
