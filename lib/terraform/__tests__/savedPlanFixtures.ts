import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { bytesDigest, savedPlanArtifactContext, type SavedPlanBinding, type SavedPlanRecord } from "../savedPlanArtifact";
import { createHash } from "node:crypto";
export const digest = (text: string) => createHash("sha256").update(text).digest("hex");
export const binding = () => ({
  schema: "axiom.terraform.saved-plan.v1", organizationId: "org-fixture", deploymentRequestId: "request-fixture", requestVersion: 1,
  environmentId: "environment-fixture", targetDigest: digest("target"), configurationDigest: digest("configuration"), providerLockDigest: digest("builtin-no-external-provider"),
  terraformVersion: "1.9.8", executableDigest: digest("executable"),
  backend: { kind: "local_fixture", workspace: "default", identityDigest: digest("owned-local-state"), stateLineage: null, stateSerial: null },
  credential: null, evidenceScope: "owned_local_fixture", createdAt: "2026-10-16T12:00:00.000Z", expiresAt: "2026-10-16T13:00:00.000Z",
});
export const show = () => ({ format_version: "1.2", terraform_version: "1.9.8", resource_changes: [
  { address: "terraform_data.fixture", provider_name: "terraform.io/builtin/terraform", mode: "managed", change: { actions: ["create"], after: { secret: "DO-NOT-RETURN-THIS-SENTINEL" } } },
] });

/** Synthetic envelope-only fixture, never genuine binary/show provenance. */
export function sealSavedPlan(id: string, binding: SavedPlanBinding, binary: Buffer, show: string): SavedPlanRecord {
  const base = { id, organizationId: binding.organizationId, deploymentRequestId: binding.deploymentRequestId, requestVersion: binding.requestVersion,
    bindingJson: binding, bindingDigest: sha256ContentHash(binding), binaryDigest: bytesDigest(binary), binaryBytes: binary.length,
    showDigest: bytesDigest(show), createdAt: new Date(binding.createdAt), expiresAt: new Date(binding.expiresAt) };
  return { ...base, encryptedBinary: encryptScopedCredential(binary.toString("base64"), savedPlanArtifactContext(base, "binary")), encryptedShow: encryptScopedCredential(show, savedPlanArtifactContext(base, "show")) };
}
