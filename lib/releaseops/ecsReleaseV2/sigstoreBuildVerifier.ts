import "server-only";
import { createHash } from "node:crypto";
import type { ManifestCandidate } from "./contract";

/** Internal independently obtained expectations. Never bind these from request JSON. */
export interface BuildBinding {
  organizationId: string;
  repositoryId: string;
  repositoryFullName: string;
  sourceSha: string;
  sourceRef: string;
  workflowPath: string;
  workflowSha: string;
  runId: string;
  runAttempt: number;
  attestationDigest: string;
  subjects: { name: string; sha256: string }[];
}
/** Server configuration only. No built-in roots, network trust refresh or caller profile selection. */
export interface PublicTrustProfile {
  kind: "public_sigstore";
  trustedRoot: unknown;
  trustedRootDigest: string;
  reviewedAt: string;
  reviewExpiresAt: string;
  signerWorkflow: string;
  signerWorkflowSha: string;
}
type ProvenanceResult = {
  kind: "verified_build_provenance";
  organizationId: string;
  repositoryId: string;
  repositoryFullName: string;
  sourceSha: string;
  workflowSha: string;
  runId: string;
  runAttempt: number;
  attestationDigest: string;
  subjects: BuildBinding["subjects"];
} | { kind: "unavailable"; reason: string };
const unavailable = (reason: string): ProvenanceResult => ({ kind: "unavailable", reason });
const sha = (value: Uint8Array) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const hex40 = /^[a-f0-9]{40}$/;
const hex64 = /^[a-f0-9]{64}$/;
const repo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const numeric = /^[1-9][0-9]*$/;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
  return value as Record<string, unknown>;
}
function same(actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error("signed binding mismatch");
}
export function sigstoreRuntimeSupported(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major >= 26 || (major === 24 && minor >= 15) || (major === 22 && (minor > 22 || (minor === 22 && patch >= 2)));
}
function validBinding(b: BuildBinding): boolean {
  return typeof b.organizationId === "string" && b.organizationId.length > 0 && b.organizationId.length <= 200
    && numeric.test(b.repositoryId) && repo.test(b.repositoryFullName) && hex40.test(b.sourceSha) && hex40.test(b.workflowSha)
    && /^refs\/(heads|tags)\/[^\s]+$/.test(b.sourceRef) && /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(b.workflowPath)
    && numeric.test(b.runId) && Number.isSafeInteger(b.runAttempt) && b.runAttempt >= 1
    && /^sha256:[a-f0-9]{64}$/.test(b.attestationDigest) && Array.isArray(b.subjects) && b.subjects.length > 0 && b.subjects.length <= 100
    && new Set(b.subjects.map(s => s.name)).size === b.subjects.length
    && b.subjects.every(s => typeof s.name === "string" && s.name.length > 0 && s.name.length <= 1000 && hex64.test(s.sha256));
}
function utf8DER(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > 255) throw new Error("identity too long");
  return Buffer.concat([Buffer.from(bytes.length < 128 ? [12, bytes.length] : [12, 129, bytes.length]), bytes]);
}
/** Offline crypto verification only. This returns build evidence, never full AWS/review facts,
 * approval, execution permission, image availability or application health. */
export async function verifyBuildProvenance(input: {
  bytes: Uint8Array;
  binding: BuildBinding;
  profile: unknown;
  authorize: (organizationId: string) => Promise<boolean>;
  now: Date;
}): Promise<ProvenanceResult> {
  if (!sigstoreRuntimeSupported(process.versions.node)) return unavailable("unsupported_sigstore_runtime");
  try {
    // Snapshot everything before awaiting authority; an adapter cannot change the checked binding mid-flight.
    if (input.bytes.byteLength > 1024 * 1024) return unavailable("attestation_too_large");
    const bytes = Buffer.from(input.bytes);
    const b: BuildBinding = JSON.parse(JSON.stringify(input.binding));
    const profileJson = JSON.stringify(input.profile);
    const now = input.now.getTime();
    if (!Number.isFinite(now)) return unavailable("invalid_verification_time");
    if (!validBinding(b)) return unavailable("invalid_build_binding");
    if (!await input.authorize(b.organizationId)) return unavailable("current_tenant_authority_required");
    if (sha(bytes) !== b.attestationDigest) return unavailable("attestation_digest_mismatch");
    if (!profileJson || profileJson.length > 256 * 1024) return unavailable("trust_profile_unavailable");
    const p = object(JSON.parse(profileJson));
    if (p.kind === "private_github") return unavailable("private_trust_profile_unavailable");
    if (p.kind !== "public_sigstore") return unavailable("trust_profile_unavailable");
    const reviewedAt = Date.parse(String(p.reviewedAt)), expires = Date.parse(String(p.reviewExpiresAt));
    if (!Number.isFinite(reviewedAt) || !Number.isFinite(expires) || reviewedAt > now || expires <= now
      || expires <= reviewedAt || expires - reviewedAt > 7 * 86400_000) return unavailable("trust_review_expired_or_invalid");
    if (sha(Buffer.from(JSON.stringify(p.trustedRoot))) !== p.trustedRootDigest) return unavailable("trust_root_digest_mismatch");
    if (typeof p.signerWorkflowSha !== "string" || !hex40.test(p.signerWorkflowSha)
      || typeof p.signerWorkflow !== "string" || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml@[a-f0-9]{40}$/.test(p.signerWorkflow)
      || !p.signerWorkflow.endsWith(`@${p.signerWorkflowSha}`)) return unavailable("pinned_signer_required");
    const root = object(p.trustedRoot);
    // Public and private domains cannot be exchanged by simply disabling thresholds.
    for (const field of ["certificateAuthorities", "ctlogs", "tlogs"]) {
      if (!Array.isArray(root[field]) || root[field].length === 0) return unavailable("public_trust_material_incomplete");
    }
    const [{ bundleFromJSON }, { Verifier, toSignedEntity, toTrustMaterial }, { TrustedRoot }] = await Promise.all([
      import("@sigstore/bundle"), import("@sigstore/verify"), import("@sigstore/protobuf-specs"),
    ]);
    const raw = object(JSON.parse(bytes.toString("utf8")));
    const envelope = object(raw.dsseEnvelope);
    same(envelope.payloadType, "application/vnd.in-toto+json");
    const material = object(raw.verificationMaterial);
    if (!Array.isArray(envelope.signatures) || envelope.signatures.length !== 1
      || !Array.isArray(material.tlogEntries) || material.tlogEntries.length < 1 || material.tlogEntries.length > 4)
      return unavailable("unsupported_or_unbounded_proof_set");
    for (const value of material.tlogEntries) {
      const entry = object(value);
      if (entry.inclusionProof) {
        const proof = object(entry.inclusionProof);
        if (Array.isArray(proof.hashes) && proof.hashes.length > 64) return unavailable("unsupported_or_unbounded_proof_set");
      }
    }
    if (material.x509CertificateChain) {
      const chain = object(material.x509CertificateChain);
      if (!Array.isArray(chain.certificates) || chain.certificates.length > 4) return unavailable("unsupported_or_unbounded_proof_set");
    }
    const repositoryUrl = `https://github.com/${b.repositoryFullName}`;
    const invocation = `${repositoryUrl}/actions/runs/${b.runId}/attempts/${b.runAttempt}`;
    const callerWorkflow = `${repositoryUrl}/${b.workflowPath}@${b.sourceRef}`;
    // Fulcio's modern GitHub identity OIDs are DER UTF8 strings; verify through the official policy engine.
    const oidValues: [number, string][] = [[9, p.signerWorkflow], [10, p.signerWorkflowSha], [12, repositoryUrl],
      [13, b.sourceSha], [14, b.sourceRef], [15, b.repositoryId], [18, callerWorkflow], [19, b.workflowSha], [21, invocation], [22, "public"]];
    new Verifier(toTrustMaterial(TrustedRoot.fromJSON(root)), {
      ctlogThreshold: 1, tlogThreshold: 1, timestampThreshold: 1,
    }).verify(toSignedEntity(bundleFromJSON(raw)), {
      subjectAlternativeName: p.signerWorkflow,
      extensions: { issuer: "https://token.actions.githubusercontent.com" },
      oids: oidValues.map(([suffix, value]) => ({ oid: { id: [1, 3, 6, 1, 4, 1, 57264, 1, suffix] }, value: utf8DER(value) })),
    });
    const statement = object(JSON.parse(Buffer.from(String(envelope.payload), "base64").toString("utf8")));
    same(statement._type, "https://in-toto.io/Statement/v1");
    same(statement.predicateType, "https://slsa.dev/provenance/v1");
    const predicate = object(statement.predicate), definition = object(predicate.buildDefinition);
    same(definition.buildType, "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1");
    const workflow = object(object(definition.externalParameters).workflow);
    same(workflow.repository, repositoryUrl); same(workflow.path, b.workflowPath); same(workflow.ref, b.sourceRef);
    same(object(object(definition.internalParameters).github).repository_id, b.repositoryId);
    same(object(object(predicate.runDetails).metadata).invocationId, invocation);
    if (!Array.isArray(definition.resolvedDependencies) || definition.resolvedDependencies.length !== 1) throw new Error("ambiguous source dependencies");
    const source = object(definition.resolvedDependencies[0]);
    same(source.uri, `git+${repositoryUrl}@${b.sourceRef}`); same(object(source.digest).gitCommit, b.sourceSha);
    if (!Array.isArray(statement.subject) || statement.subject.length !== b.subjects.length) throw new Error("subject coverage mismatch");
    const subjects = statement.subject.map(value => { const s = object(value); return { name: s.name, sha256: object(s.digest).sha256 }; });
    if (new Set(subjects.map(s => s.name)).size !== subjects.length) throw new Error("duplicate subject");
    for (const expected of b.subjects) {
      if (!subjects.some(s => s.name === expected.name && s.sha256 === expected.sha256)) throw new Error("subject mismatch");
    }
    if (!await input.authorize(b.organizationId)) return unavailable("current_tenant_authority_required");
    return { kind: "verified_build_provenance", organizationId: b.organizationId, repositoryId: b.repositoryId,
      repositoryFullName: b.repositoryFullName, sourceSha: b.sourceSha, workflowSha: b.workflowSha,
      runId: b.runId, runAttempt: b.runAttempt, attestationDigest: b.attestationDigest, subjects: b.subjects };
  } catch { return unavailable("provenance_verification_failed"); }
}

/** Reuse the existing parsed manifest and its complete immutable image subject set.
 * Tenant membership + GitHub run/attempt metadata still belong to the independent adapter. */
export function manifestBuildBinding(candidate: ManifestCandidate, sourceRef: string): BuildBinding {
  const m = candidate.manifest;
  return { organizationId: m.organizationId, repositoryId: m.repository.id, repositoryFullName: m.repository.fullName,
    sourceSha: m.repository.sourceSha, sourceRef, workflowPath: m.build.workflowPath, workflowSha: m.build.workflowSha,
    runId: m.build.runId, runAttempt: m.build.attempt, attestationDigest: m.build.attestationDigest,
    subjects: [...new Set(m.proposed.images.map(image => image.image))].map(image => { const [name, digest] = image.split("@sha256:"); return { name, sha256: digest }; }) };
}
