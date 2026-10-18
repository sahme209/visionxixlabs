import "server-only";
import type { GithubBundleDownloadRule } from "@/lib/connectors/github/githubWriteClient";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { verifyBuildProvenance, type BuildBinding } from "@/lib/releaseops/ecsReleaseV2/sigstoreBuildVerifier";
import { bytesDigest, inspectSavedPlanJson, MAX_PLAN_BYTES, MAX_SHOW_BYTES, type SavedPlanRecord } from "./savedPlanArtifact";
import { CUSTOMER_RECEIPT_MAX_BYTES, parseCustomerPlanProfile, parseCustomerBackendState, parseCustomerSavedPlanBinding, customerImportId, type CustomerPlanProfile, type CustomerSavedPlanBinding } from "./customerPlanContract";

export interface CustomerPlanTrust {
 publicProfile: unknown; digest: string; terraformVersion: string; executableDigest: string; reviewExpiresAt: string; downloadPolicy:readonly GithubBundleDownloadRule[];
}
export interface CustomerProducerInput {
 profile: CustomerPlanProfile; requestContentHash:string; targetDigest:string; run:{id:string;attempt:number};
 binary:Uint8Array; show:Uint8Array; receipt:Uint8Array; bundle:Uint8Array;
 trust:CustomerPlanTrust; now:Date; authorize:(organizationId:string)=>Promise<boolean>;
}
const proofBrand: unique symbol = Symbol("verified-customer-plan");
export interface VerifiedCustomerPlan { readonly kind:"verified_customer_plan"; readonly binding:CustomerSavedPlanBinding; readonly [proofBrand]:true }
interface Captured { binding:CustomerSavedPlanBinding; binary:Buffer; show:string; receipt:Buffer; bundle:Buffer }
const captured = new WeakMap<VerifiedCustomerPlan,Captured>();
const unavailable = () => ({kind:"unavailable" as const,reason:"customer_plan_producer_unavailable"});
function requireValue(condition:unknown): asserts condition { if (!condition) throw new Error("customer_plan_producer_unavailable"); }
function object(value:unknown):Record<string,unknown> { requireValue(value && typeof value==="object" && !Array.isArray(value)); return value as Record<string,unknown>; }
function exact(value:unknown,keys:string[]):Record<string,unknown> { const o=object(value);requireValue(Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k)));return o; }
const text=(bytes:Uint8Array)=>new TextDecoder("utf-8",{fatal:true}).decode(bytes);
const hex=(value:unknown)=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);
function freeze<T>(value:T):T { if(value && typeof value==="object"){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value; }

/** No public upload/JSON authority. All subject expectations come from the
 * scoped profile, independent run/context, actual bytes and fixed trusted CI.
 * Signature verification remains the existing official verifier, with no bypass. */
export async function verifyCustomerPlanProducer(input:CustomerProducerInput):Promise<VerifiedCustomerPlan|ReturnType<typeof unavailable>> {
 try {
  requireValue(input.binary instanceof Uint8Array && input.show instanceof Uint8Array && input.receipt instanceof Uint8Array && input.bundle instanceof Uint8Array);
  requireValue(input.binary.byteLength>0 && input.binary.byteLength<=MAX_PLAN_BYTES && input.show.byteLength>0 && input.show.byteLength<=MAX_SHOW_BYTES && input.receipt.byteLength>0 && input.receipt.byteLength<=CUSTOMER_RECEIPT_MAX_BYTES && input.bundle.byteLength>0 && input.bundle.byteLength<=1024*1024);
  // Snapshot all inputs before the first asynchronous authority boundary.
  const profile=parseCustomerPlanProfile(input.profile),run=structuredClone(input.run),trust=structuredClone(input.trust),now=new Date(input.now.getTime());
  const binary=Buffer.from(input.binary),showBytes=Buffer.from(input.show),receipt=Buffer.from(input.receipt),bundle=Buffer.from(input.bundle);
  const requestContentHash=input.requestContentHash,targetDigest=input.targetDigest,authorize=input.authorize;
  requireValue(Number.isFinite(now.getTime()) && hex(requestContentHash) && hex(targetDigest) && hex(trust.digest) && hex(trust.executableDigest));
  requireValue(typeof trust.reviewExpiresAt==="string"&&Date.parse(trust.reviewExpiresAt)>now.getTime());
  const r=exact(JSON.parse(text(receipt)),["schema","profileDigest","requestContentHash","targetDigest","producer","backendIdentityDigest","workspace","stateBefore","stateAfter","lock","configurationDigest","providerLockDigest","terraformVersion","executableDigest","binary","show","createdAt","expiresAt"]);
  const w=exact(r.producer,["repositoryId","repositoryFullName","sourceRef","sourceSha","workflowPath","workflowSha","runId","runAttempt","roleArn"]);
  const b=exact(r.binary,["digest","bytes"]),s=exact(r.show,["digest","bytes"]);
  const state=parseCustomerBackendState(r.stateBefore);parseCustomerBackendState(r.stateAfter);
  requireValue(r.schema==="axiom.terraform.plan-receipt.v2"&&r.profileDigest===sha256ContentHash(profile)&&r.requestContentHash===requestContentHash&&r.targetDigest===targetDigest);
  requireValue(w.repositoryId===profile.repository.remoteId&&w.repositoryFullName===profile.repository.fullName&&w.sourceRef===profile.repository.sourceRef&&w.sourceSha===profile.repository.sourceSha
   &&w.workflowPath===profile.producer.workflowPath&&w.workflowSha===profile.producer.workflowSha&&w.runId===run.id&&w.runAttempt===run.attempt&&w.roleArn===profile.producer.planRoleArn);
  requireValue(r.backendIdentityDigest===sha256ContentHash(profile.backend)&&r.workspace==="default"&&r.lock==="released"&&sha256ContentHash(r.stateAfter)===sha256ContentHash(state));
  requireValue(r.configurationDigest===profile.configuration.treeDigest&&r.providerLockDigest===profile.configuration.providerLockDigest&&r.terraformVersion===trust.terraformVersion&&r.executableDigest===trust.executableDigest);
  requireValue(b.digest===bytesDigest(binary)&&b.bytes===binary.byteLength&&s.digest===bytesDigest(showBytes)&&s.bytes===showBytes.byteLength);
  const show=text(showBytes);inspectSavedPlanJson(show,trust.terraformVersion);
  const binding=parseCustomerSavedPlanBinding({schema:"axiom.terraform.saved-plan.v2",evidenceScope:"customer_ci_attested",profile,profileDigest:sha256ContentHash(profile),requestContentHash,targetDigest,backendState:state,
   producer:{repositoryId:profile.repository.remoteId,runId:run.id,runAttempt:run.attempt,attestationDigest:`sha256:${bytesDigest(bundle)}`,trustDigest:trust.digest,receiptDigest:bytesDigest(receipt)},
   configurationDigest:r.configurationDigest,providerLockDigest:r.providerLockDigest,terraformVersion:r.terraformVersion,executableDigest:r.executableDigest,binaryDigest:b.digest,showDigest:s.digest,createdAt:r.createdAt,expiresAt:r.expiresAt});
  requireValue(Date.parse(binding.createdAt)<=now.getTime()&&Date.parse(binding.expiresAt)>now.getTime()&&Date.parse(binding.expiresAt)<=Date.parse(trust.reviewExpiresAt));
  if(!await authorize(profile.organizationId))return unavailable();
  const expected:BuildBinding={organizationId:profile.organizationId,repositoryId:profile.repository.remoteId,repositoryFullName:profile.repository.fullName,sourceSha:profile.repository.sourceSha,sourceRef:profile.repository.sourceRef,
   workflowPath:profile.producer.workflowPath,workflowSha:profile.producer.workflowSha,runId:run.id,runAttempt:run.attempt,attestationDigest:binding.producer.attestationDigest,
   subjects:[{name:"plan.tfplan",sha256:binding.binaryDigest},{name:"plan.show.json",sha256:binding.showDigest},{name:"plan.receipt.json",sha256:binding.producer.receiptDigest}]};
  const verified=await verifyBuildProvenance({bytes:bundle,binding:expected,profile:trust.publicProfile,authorize,now});
  requireValue(verified.kind==="verified_build_provenance"&&verified.organizationId===expected.organizationId&&verified.repositoryId===expected.repositoryId&&verified.sourceSha===expected.sourceSha
   &&verified.runId===expected.runId&&verified.runAttempt===expected.runAttempt&&verified.attestationDigest===expected.attestationDigest&&sha256ContentHash(verified.subjects)===sha256ContentHash(expected.subjects));
  if(!await authorize(profile.organizationId))return unavailable();
  const result:VerifiedCustomerPlan=freeze({kind:"verified_customer_plan",binding:structuredClone(binding),[proofBrand]:true});
  captured.set(result,{binding:structuredClone(binding),binary,show,receipt,bundle});return result;
 } catch {return unavailable();}
}
export type CustomerSavedPlanRecord=Omit<SavedPlanRecord,"bindingJson">&{bindingJson:CustomerSavedPlanBinding};
export interface CustomerPlanProvenanceRow {
 artifactId:string;organizationId:string;deploymentRequestId:string;requestVersion:number;profileId:string;profileRevision:number;
 bindingDigest:string;binaryDigest:string;showDigest:string;receiptDigest:string;attestationDigest:string;trustDigest:string;encryptedProof:string;createdAt:Date;
}
export const customerArtifactContext=(row:Pick<CustomerSavedPlanRecord,"id"|"organizationId"|"deploymentRequestId"|"bindingDigest"|"binaryDigest">,purpose:"binary"|"show"|"proof")=>JSON.stringify(["axiom.terraform.saved-plan.v2",row.organizationId,row.deploymentRequestId,row.id,row.binaryDigest,row.bindingDigest,purpose]);
/** An object shaped like a successful verification result cannot seal evidence. */
export function sealVerifiedCustomerPlan(result:VerifiedCustomerPlan):{artifact:CustomerSavedPlanRecord;provenance:CustomerPlanProvenanceRow} {
 const snapshot=captured.get(result);if(!snapshot)throw new Error("customer_plan_unverified");
 const binding=structuredClone(snapshot.binding),p=binding.profile;
 const base={id:customerImportId(binding),organizationId:p.organizationId,deploymentRequestId:p.deploymentRequestId,requestVersion:p.requestVersion,bindingJson:binding,bindingDigest:sha256ContentHash(binding),binaryDigest:binding.binaryDigest,binaryBytes:snapshot.binary.byteLength,showDigest:binding.showDigest,createdAt:new Date(binding.createdAt),expiresAt:new Date(binding.expiresAt)};
 const artifact={...base,encryptedBinary:encryptScopedCredential(snapshot.binary.toString("base64"),customerArtifactContext(base,"binary")),encryptedShow:encryptScopedCredential(snapshot.show,customerArtifactContext(base,"show"))};
 const provenance={artifactId:base.id,organizationId:p.organizationId,deploymentRequestId:p.deploymentRequestId,requestVersion:p.requestVersion,profileId:p.id,profileRevision:p.revision,bindingDigest:base.bindingDigest,binaryDigest:base.binaryDigest,showDigest:base.showDigest,
  receiptDigest:binding.producer.receiptDigest,attestationDigest:binding.producer.attestationDigest,trustDigest:binding.producer.trustDigest,
  encryptedProof:encryptScopedCredential(JSON.stringify({receipt:snapshot.receipt.toString("base64"),bundle:snapshot.bundle.toString("base64")}),customerArtifactContext(base,"proof")),createdAt:base.createdAt};
 return {artifact,provenance};
}
