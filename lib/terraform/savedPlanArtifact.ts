import "server-only";
import type { SavedPlanMetadata, SavedPlanProjection } from "./savedPlanDto";
export type { SavedPlanMetadata, SavedPlanProjection } from "./savedPlanDto";
import { createHash } from "node:crypto";
import { decryptScopedCredential } from "@/lib/security/credentialVault";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { summarizeTerraformPlan, type PlanSummary, type PlanResourceChange } from "@/lib/iac/terraformPlanSummarizer";

export const MAX_PLAN_BYTES = 16 * 1024 * 1024;
export const MAX_SHOW_BYTES = 32 * 1024 * 1024;
const hex = /^[a-f0-9]{64}$/;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 1024 && !/[\x00-\x1f]/.test(v);
export const bytesDigest = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

export interface SavedPlanBinding {
  schema: "axiom.terraform.saved-plan.v1";
  organizationId: string;
  deploymentRequestId: string;
  requestVersion: number;
  environmentId: string;
  targetDigest: string;
  configurationDigest: string;
  providerLockDigest: string;
  terraformVersion: string;
  executableDigest: string;
  backend: { kind: "local_fixture"; workspace: "default"; identityDigest: string; stateLineage: null; stateSerial: null };
  credential: null;
  evidenceScope: "owned_local_fixture";
  createdAt: string;
  expiresAt: string;
}

/** Only the owned local fixture producer is modeled today. Remote state,
 * target and credential authority require a separately reviewed producer. */
export function parseSavedPlanBinding(input: unknown): SavedPlanBinding {
  if (!record(input) || input.schema !== "axiom.terraform.saved-plan.v1" || input.evidenceScope !== "owned_local_fixture" || input.credential !== null
    || !["organizationId", "deploymentRequestId", "environmentId", "terraformVersion"].every(k => text(input[k]))
    || !["targetDigest", "configurationDigest", "providerLockDigest", "executableDigest"].every(k => typeof input[k] === "string" && hex.test(input[k] as string))
    || !Number.isSafeInteger(input.requestVersion) || (input.requestVersion as number) < 1 || (input.requestVersion as number) > 2147483647
    || !record(input.backend) || input.backend.kind !== "local_fixture" || input.backend.workspace !== "default" || !hex.test(String(input.backend.identityDigest))
    || input.backend.stateLineage !== null || input.backend.stateSerial !== null
    || typeof input.createdAt !== "string" || typeof input.expiresAt !== "string"
    || !Number.isFinite(Date.parse(input.createdAt)) || !Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.parse(input.createdAt)) throw new Error("saved_plan_binding_unavailable");
  const keys = ["schema", "organizationId", "deploymentRequestId", "requestVersion", "environmentId", "targetDigest", "configurationDigest", "providerLockDigest", "terraformVersion", "executableDigest", "backend", "credential", "evidenceScope", "createdAt", "expiresAt"];
  if (Object.keys(input).some(k => !keys.includes(k)) || Object.keys(input.backend).some(k => !["kind", "workspace", "identityDigest", "stateLineage", "stateSerial"].includes(k))) throw new Error("saved_plan_binding_unavailable");
  return structuredClone(input) as unknown as SavedPlanBinding;
}

/** Decoder only: JSON alone never proves that a saved binary produced it. */
export function inspectSavedPlanJson(json: string, terraformVersion: string): PlanSummary {
  if (Buffer.byteLength(json) > MAX_SHOW_BYTES) throw new Error("saved_plan_show_too_large");
  const value: unknown = JSON.parse(json);
  if (!record(value) || value.format_version !== "1.2" || value.terraform_version !== terraformVersion || !Array.isArray(value.resource_changes)
    || value.resource_changes.length > 10_000 || value.errored === true || value.complete === false
    || (value.deferred_changes !== undefined && (!Array.isArray(value.deferred_changes) || value.deferred_changes.length > 0))
    || (value.resource_drift !== undefined && (!Array.isArray(value.resource_drift) || value.resource_drift.length > 0))) throw new Error("saved_plan_show_unsupported");
  const seen = new Set<string>();
  const actions = new Set(["no-op", "create", "read", "update", "delete", "delete,create", "create,delete"]);
  const changes: PlanResourceChange[] = value.resource_changes.map((row: unknown) => {
    if (!record(row) || !text(row.address) || seen.has(row.address) || !text(row.provider_name) || !record(row.change)
      || !Array.isArray(row.change.actions) || !row.change.actions.every(a => typeof a === "string") || !actions.has(row.change.actions.join(","))) throw new Error("saved_plan_actions_unsupported");
    seen.add(row.address);
    return { address: row.address, provider: row.provider_name, actions: row.change.actions };
  });
  return summarizeTerraformPlan(changes);
}

export interface SavedPlanRecord {
  id: string;
  organizationId: string;
  deploymentRequestId: string;
  requestVersion: number;
  bindingJson: SavedPlanBinding;
  bindingDigest: string;
  binaryDigest: string;
  binaryBytes: number;
  showDigest: string;
  encryptedBinary: string;
  encryptedShow: string;
  createdAt: Date;
  expiresAt: Date;
}
export const savedPlanArtifactContext = (r: Pick<SavedPlanRecord, "id" | "organizationId" | "deploymentRequestId" | "binaryDigest" | "bindingDigest">, purpose: "binary" | "show") =>
  JSON.stringify(["axiom.terraform.saved-plan.v1", r.organizationId, r.deploymentRequestId, r.id, r.binaryDigest, r.bindingDigest, purpose]);

export function openSavedPlan(row: SavedPlanRecord, scope: { organizationId: string; requestId: string; requestVersion: number }, now: Date): SavedPlanProjection {
  const metadata = readSavedPlanMetadata(row, scope, now);
  if (row.encryptedBinary.length > MAX_PLAN_BYTES * 2 || row.encryptedShow.length > MAX_SHOW_BYTES * 2) throw new Error("saved_plan_artifact_too_large");
  const encoded = decryptScopedCredential(row.encryptedBinary, savedPlanArtifactContext(row, "binary"));
  const binary = Buffer.from(encoded, "base64");
  const show = decryptScopedCredential(row.encryptedShow, savedPlanArtifactContext(row, "show"));
  if (binary.length === 0 || binary.length > MAX_PLAN_BYTES || binary.length !== row.binaryBytes || binary.toString("base64") !== encoded
    || bytesDigest(binary) !== row.binaryDigest || bytesDigest(show) !== row.showDigest) throw new Error("saved_plan_artifact_integrity_failed");
  return { ...metadata, inspection: "artifact_bytes_checked", summary: inspectSavedPlanJson(show, row.bindingJson.terraformVersion) };
}

/** Metadata inspection does not decrypt/recheck artifact bytes. Detail must
 * openSavedPlan before presenting any change summary. */
export function readSavedPlanMetadata(row: Omit<SavedPlanRecord, "encryptedBinary" | "encryptedShow" | "showDigest">, scope: { organizationId: string; requestId: string; requestVersion: number }, now: Date): SavedPlanMetadata {
  const binding = parseSavedPlanBinding(row.bindingJson);
  if (!Number.isFinite(now.getTime()) || row.organizationId !== scope.organizationId || row.deploymentRequestId !== scope.requestId || row.requestVersion !== scope.requestVersion
    || binding.organizationId !== row.organizationId || binding.deploymentRequestId !== row.deploymentRequestId || binding.requestVersion !== row.requestVersion
    || sha256ContentHash(binding) !== row.bindingDigest || !hex.test(row.binaryDigest) || !Number.isSafeInteger(row.binaryBytes) || row.binaryBytes < 1 || row.binaryBytes > MAX_PLAN_BYTES
    || row.createdAt.getTime() !== Date.parse(binding.createdAt) || row.expiresAt.getTime() !== Date.parse(binding.expiresAt)
    || row.createdAt.getTime() > now.getTime() || row.expiresAt.getTime() <= now.getTime()) throw new Error("saved_plan_integrity_or_scope_changed");
  return { id: row.id, binaryDigest: row.binaryDigest, binaryBytes: row.binaryBytes, environmentId: binding.environmentId, requestVersion: row.requestVersion,
    terraformVersion: binding.terraformVersion, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(), evidenceScope: binding.evidenceScope,
    inspection: "metadata_only", approval: "unavailable", currentTarget: "unavailable", executionEnabled: false };
}
