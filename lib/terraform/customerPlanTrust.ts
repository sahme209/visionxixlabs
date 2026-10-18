import "server-only";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { inspectPublicTrustConfiguration } from "@/lib/releaseops/ecsReleaseV2/sigstoreBuildVerifier";
import { parseCustomerPlanProfile } from "./customerPlanContract";
import type { CustomerPlanTrust } from "./customerPlanProvenance";
const hex=(value:unknown):value is string=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);
const id=(value:unknown):value is string=>typeof value==="string"&&/^[A-Za-z0-9_.:-]{1,200}$/.test(value);
function exact(value:unknown,keys:string[]):Record<string,unknown>|null {
 if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k)))return null;
 return value as Record<string,unknown>;
}
/** Configuration inspection only. The profile can select IDs, never roots or
 * verifier policy. This does not execute/verify a plan or confer authority. */
export function resolveCustomerPlanTrust(profileInput:unknown,now:Date,configuration:unknown):CustomerPlanTrust|null {
 try {
  const profile=parseCustomerPlanProfile(profileInput);
  const json=JSON.stringify(configuration);if(!json||json.length>1024*1024||!Number.isFinite(now.getTime()))return null;
  const registry=exact(JSON.parse(json),["schema","profiles"]);
  if(!registry||registry.schema!=="axiom.terraform.producer-trust-registry.v2"||!Array.isArray(registry.profiles)||registry.profiles.length>8)return null;
  const rows=registry.profiles.map(value=>exact(value,["id","toolchainId","publicProfile","terraformVersion","executableDigest","providerLockDigest","workflowDigest","scriptDigest","downloadPolicy"]));
  if(rows.some(row=>!row||!id(row.id)||!id(row.toolchainId)||typeof row.terraformVersion!=="string"||!/^1\.\d+\.\d+$/.test(row.terraformVersion)||![row.executableDigest,row.providerLockDigest,row.workflowDigest,row.scriptDigest].every(hex)))return null;
  const valid=rows as Array<NonNullable<typeof rows[number]>>;
  if(new Set(valid.map(row=>`${row.id}:${row.toolchainId}`)).size!==valid.length)return null;
  const selected=valid.filter(row=>row.id===profile.producer.trustProfileId&&row.toolchainId===profile.producer.toolchainProfileId);
  if(selected.length!==1)return null;
  const row=selected[0],checked=inspectPublicTrustConfiguration(row.publicProfile,now);
  if(!Array.isArray(row.downloadPolicy)||row.downloadPolicy.length===0||row.downloadPolicy.length>8)return null;
  const downloadPolicy=row.downloadPolicy.map(value=>{
   const rule=exact(value,["origin","pathPrefix"]);if(!rule||typeof rule.origin!=="string"||rule.pathPrefix!==`/attestations/${profile.repository.remoteId}/`)throw new Error("bundle_policy_unavailable");
   const url=new URL(rule.origin);if(url.origin!==rule.origin||url.protocol!=="https:"||url.username||url.password||url.port||url.hostname==="localhost"||/^[\d.]+$/.test(url.hostname)||url.hostname.includes(":"))throw new Error("bundle_policy_unavailable");
   return {origin:rule.origin,pathPrefix:rule.pathPrefix as string};
  });
  if(checked.kind!=="configured"||checked.profile.kind!=="public_sigstore_direct_workflow_v1"||checked.profile.signerWorkflow!==`https://github.com/${profile.repository.fullName}/${profile.producer.workflowPath}@${profile.repository.sourceRef}`
   ||checked.profile.signerWorkflowSha!==profile.producer.workflowSha||row.workflowDigest!==profile.producer.workflowDigest||row.scriptDigest!==profile.producer.scriptDigest||row.providerLockDigest!==profile.configuration.providerLockDigest)return null;
  return {publicProfile:structuredClone(checked.profile),digest:sha256ContentHash(row),terraformVersion:row.terraformVersion as string,executableDigest:row.executableDigest as string,reviewExpiresAt:checked.profile.reviewExpiresAt,downloadPolicy};
 } catch {return null;}
}
/** Server operator configuration only. Missing/malformed is unavailable, never
 * a built-in root, runtime fetch, private-repository fallback or enabling flag. */
export function readConfiguredCustomerPlanTrust(profile:unknown,now:Date):CustomerPlanTrust|null {
 try {const value=process.env.AXIOM_TERRAFORM_CUSTOMER_PLAN_TRUST;if(!value||value.length>1024*1024)return null;return resolveCustomerPlanTrust(profile,now,JSON.parse(value));}catch{return null;}
}
