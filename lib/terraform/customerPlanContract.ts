import { sha256ContentHash } from "@/lib/tauri/contentHash";

export const CUSTOMER_PLAN_TTL_MS = 15 * 60_000;
export const CUSTOMER_RECEIPT_MAX_BYTES = 64 * 1024;
export const CUSTOMER_STATE_MAX_BYTES = 16 * 1024 * 1024;
export const CUSTOMER_RESPONSE_BUDGET_BYTES = 96 * 1024 * 1024;
export interface CustomerPlanProfile {
 schema: "axiom.terraform.customer-profile.v2";
 id: string; organizationId: string; deploymentRequestId: string; requestVersion: number; environmentId: string; revision: number;
 repository: { recordId: string; remoteId: string; fullName: string; sourceRef: string; sourceSha: string };
 producer: { workflowPath: string; workflowSha: string; workflowDigest: string; scriptPath: string; scriptDigest: string; trustProfileId: string; toolchainProfileId: string; planRoleArn: string };
 configuration: { root: string; treeDigest: string; providerLockDigest: string };
 backend: { kind: "s3_dynamodb"; accountId: string; region: string; bucket: string; key: string; workspace: "default"; lockTable: string; lockKey: string };
 artifacts: { bucket: string; region: string; prefix: string; kmsKeyArn: string };
 connection: { id: string; version: number };
}
export interface CustomerBackendState { versionId: string; digest: string; lineage: string; serial: number }
export interface CustomerSavedPlanBinding {
 schema: "axiom.terraform.saved-plan.v2"; evidenceScope: "customer_ci_attested";
 profile: CustomerPlanProfile; profileDigest: string; requestContentHash: string; targetDigest: string; backendState: CustomerBackendState;
 producer: { repositoryId: string; runId: string; runAttempt: number; attestationDigest: string; trustDigest: string; receiptDigest: string };
 configurationDigest: string; providerLockDigest: string; terraformVersion: string; executableDigest: string; binaryDigest: string; showDigest: string;
 createdAt: string; expiresAt: string;
}
const hex64 = /^[a-f0-9]{64}$/;
const hex40 = /^[a-f0-9]{40}$/;
const numeric = /^[1-9]\d{0,31}$/;
const safeId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_.:-]{1,200}$/.test(v);
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= 2147483647;
const hex = (v: unknown): v is string => typeof v === "string" && hex64.test(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 1024 && !/[\x00-\x20\x7f]/.test(v);
export const customerPath = (v: unknown): v is string => typeof v === "string" && v.length <= 512 && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(v) && !v.split("/").some(s => s === "." || s === "..");
export const customerRegion = (v: unknown): v is string => typeof v === "string" && /^[a-z]{2}(?:-[a-z]+)+-\d$/.test(v) && !v.startsWith("cn-") && !v.startsWith("us-gov-");
const bucket = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(v) && !v.endsWith("--x-s3");
const iso = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
function fail(code: string): never { throw new Error(code); }
function closed(value: unknown, keys: readonly string[], error: string): Record<string, unknown> {
 if (!value || typeof value !== "object" || Array.isArray(value)) return fail(error);
 const actual = Object.keys(value);
 if (actual.length !== keys.length || !keys.every(k => Object.hasOwn(value, k))) return fail(error);
 return value as Record<string, unknown>;
}
/** Structural profile only; a configured profile is not permission to plan or apply. */
export function parseCustomerPlanProfile(input: unknown): CustomerPlanProfile {
 const error = "customer_plan_profile_invalid";
 const p = closed(input, ["schema","id","organizationId","deploymentRequestId","requestVersion","environmentId","revision","repository","producer","configuration","backend","artifacts","connection"], error);
 const r = closed(p.repository,["recordId","remoteId","fullName","sourceRef","sourceSha"],error);
 const w = closed(p.producer,["workflowPath","workflowSha","workflowDigest","scriptPath","scriptDigest","trustProfileId","toolchainProfileId","planRoleArn"],error);
 const c = closed(p.configuration,["root","treeDigest","providerLockDigest"],error);
 const b = closed(p.backend,["kind","accountId","region","bucket","key","workspace","lockTable","lockKey"],error);
 const a = closed(p.artifacts,["bucket","region","prefix","kmsKeyArn"],error);
 const v = closed(p.connection,["id","version"],error);
 if (p.schema !== "axiom.terraform.customer-profile.v2" || ![p.id,p.organizationId,p.deploymentRequestId,p.environmentId,r.recordId,w.trustProfileId,w.toolchainProfileId,v.id].every(safeId)
  || ![p.requestVersion,p.revision,v.version].every(positive) || typeof r.remoteId !== "string" || !numeric.test(r.remoteId)
  || typeof r.fullName !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(r.fullName) || r.fullName.length > 201
  || typeof r.sourceRef !== "string" || !/^refs\/heads\/[A-Za-z0-9_][A-Za-z0-9_./-]{0,254}$/.test(r.sourceRef) || r.sourceRef.includes("..") || r.sourceRef.includes("//") || r.sourceRef.endsWith("/")
  || typeof r.sourceSha !== "string" || !hex40.test(r.sourceSha) || w.workflowSha !== r.sourceSha
  || typeof w.workflowPath !== "string" || !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(w.workflowPath)
  || !customerPath(w.scriptPath) || !String(w.scriptPath).endsWith(".mjs") || ![w.workflowDigest,w.scriptDigest,c.treeDigest,c.providerLockDigest].every(hex)
  || !customerPath(c.root) || b.kind !== "s3_dynamodb" || b.workspace !== "default" || typeof b.accountId !== "string" || !/^\d{12}$/.test(b.accountId)
  || !customerRegion(b.region) || !customerRegion(a.region) || b.region !== a.region || !bucket(b.bucket) || !bucket(a.bucket) || b.bucket === a.bucket
  || !customerPath(b.key) || !customerPath(a.prefix) || typeof b.lockTable !== "string" || !/^[A-Za-z0-9_.-]{3,255}$/.test(b.lockTable)
  || b.lockKey !== `${b.bucket}/${b.key}` || typeof w.planRoleArn !== "string" || !new RegExp(`^arn:aws:iam::${b.accountId}:role/[A-Za-z0-9_+=,.@/-]{1,512}$`).test(w.planRoleArn)
  || typeof a.kmsKeyArn !== "string" || !new RegExp(`^arn:aws:kms:${a.region}:${b.accountId}:key/[a-f0-9-]{36}$`).test(a.kmsKeyArn)) return fail(error);
 return structuredClone(input) as CustomerPlanProfile;
}
export function parseCustomerBackendState(input: unknown): CustomerBackendState {
 const error = "customer_plan_state_invalid";
 const s = closed(input,["versionId","digest","lineage","serial"],error);
 if (!text(s.versionId) || s.versionId === "null" || !hex(s.digest) || typeof s.lineage !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s.lineage)
  || !Number.isSafeInteger(s.serial) || (s.serial as number) < 0) return fail(error);
 return structuredClone(input) as CustomerBackendState;
}
export function parseCustomerSavedPlanBinding(input: unknown): CustomerSavedPlanBinding {
 const error = "customer_plan_binding_unavailable";
 try {
  const b = closed(input,["schema","evidenceScope","profile","profileDigest","requestContentHash","targetDigest","backendState","producer","configurationDigest","providerLockDigest","terraformVersion","executableDigest","binaryDigest","showDigest","createdAt","expiresAt"],error);
  const p = parseCustomerPlanProfile(b.profile); parseCustomerBackendState(b.backendState);
  const w = closed(b.producer,["repositoryId","runId","runAttempt","attestationDigest","trustDigest","receiptDigest"],error);
  if (b.schema !== "axiom.terraform.saved-plan.v2" || b.evidenceScope !== "customer_ci_attested" || b.profileDigest !== sha256ContentHash(p)
   || ![b.profileDigest,b.requestContentHash,b.targetDigest,b.configurationDigest,b.providerLockDigest,b.executableDigest,b.binaryDigest,b.showDigest,w.trustDigest,w.receiptDigest].every(hex)
   || w.repositoryId !== p.repository.remoteId || typeof w.runId !== "string" || !numeric.test(w.runId) || !positive(w.runAttempt)
   || typeof w.attestationDigest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(w.attestationDigest)
   || b.configurationDigest !== p.configuration.treeDigest || b.providerLockDigest !== p.configuration.providerLockDigest
   || typeof b.terraformVersion !== "string" || !/^1\.\d+\.\d+$/.test(b.terraformVersion) || !iso(b.createdAt) || !iso(b.expiresAt)
   || Date.parse(b.expiresAt)-Date.parse(b.createdAt) <= 0 || Date.parse(b.expiresAt)-Date.parse(b.createdAt) > CUSTOMER_PLAN_TTL_MS) return fail(error);
  return structuredClone(input) as CustomerSavedPlanBinding;
 } catch { return fail(error); }
}
export interface CustomerTargetRows {
 environment: { id: string; organizationId: string; updatedAt: Date };
 account: { id: string; organizationId: string; provider: string; externalAccountId: string; credentialRef: string | null; regions: string[]; enabled: boolean; autopilotMode: string; updatedAt: Date };
 credential: { id: string; organizationId: string; version: number; revokedAt: Date | null };
}
/** Equality of independently loaded rows only. No planning capability or lock permit. */
export function projectCustomerTarget(profileInput: CustomerPlanProfile, rows: CustomerTargetRows): { digest: string; connection: { id: string; version: number } } | null {
 try {
  const p = parseCustomerPlanProfile(profileInput), {environment:e,account:a,credential:c} = rows;
  if (e.id !== p.environmentId || e.organizationId !== p.organizationId || a.id !== p.connection.id || c.id !== a.id || a.organizationId !== p.organizationId || c.organizationId !== p.organizationId
   || a.provider !== "aws" || a.externalAccountId !== p.backend.accountId || a.credentialRef !== `cloud-v2:${a.id}` || a.enabled !== false || a.autopilotMode !== "observe_only"
   || !Array.isArray(a.regions) || a.regions.length > 100 || !a.regions.includes(p.backend.region) || !a.regions.every(text) || c.version !== p.connection.version || c.revokedAt !== null
   || ![e.updatedAt,a.updatedAt].every(v => v instanceof Date && Number.isFinite(v.getTime()))) return null;
  return { digest: sha256ContentHash({ schema: "axiom.terraform.target.v2", profileDigest: sha256ContentHash(p), environment: {...e,updatedAt:e.updatedAt.toISOString()},
   account:{...a,regions:[...a.regions],updatedAt:a.updatedAt.toISOString()}, credential:{id:c.id,organizationId:c.organizationId,version:c.version,revokedAt:null} }), connection:{id:c.id,version:c.version} };
 } catch { return null; }
}
export function customerImportId(binding: CustomerSavedPlanBinding): string {
 const b = parseCustomerSavedPlanBinding(binding);
 return `tfcp_${sha256ContentHash({ organizationId:b.profile.organizationId,requestId:b.profile.deploymentRequestId,requestVersion:b.profile.requestVersion,profileId:b.profile.id,profileRevision:b.profile.revision,
  repositoryId:b.producer.repositoryId,runId:b.producer.runId,runAttempt:b.producer.runAttempt,binaryDigest:b.binaryDigest,showDigest:b.showDigest,receiptDigest:b.producer.receiptDigest })}`;
}
