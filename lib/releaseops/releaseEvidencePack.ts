/**
 * Release evidence pack (parity item: exportable release evidence). For ONE repository commit, gathers
 * what V19 recorded: every deployment of that commit (environment, who, when, policy, configuration
 * fingerprint, outcome), every deployment check result CI reported for it, and audit events on those
 * deployments. The builder is pure and deterministic (sorted keys and arrays) so the SHA-256 digest of
 * the same records is always the same; an auditor can recompute it from the JSON. Configuration values
 * are NOT included, only their fingerprint. Absent evidence is listed as a gap, never invented.
 */
import { createHash } from "node:crypto";

export const EVIDENCE_PACK_FORMAT = "v19.release-evidence/v1";

export interface PackDeployment {
  id: string; environment: string; environmentTier: string | null; sourceRef: string | null; triggeredByUserId: string;
  source: string; status: string; conclusion: string | null; rollbackStatus: string; branchPolicyId: string | null;
  pullRequestUrl: string | null; workflowUrl: string | null; configDigest: string | null; createdAt: string; completedAt: string | null;
}
export interface PackCheckResult { checkKey: string; checkVersion: number; stage: string; status: string; environment: string | null; runUrl: string | null; reportedAt: string }
export interface PackAuditEvent { kind: string; subjectId: string; outcome: string; summary: string; actorUserId: string | null; createdAt: string }
export interface ReleaseEvidencePackInput {
  organizationId: string; repositoryFullName: string; commitSha: string; generatedAt: string;
  deployments: PackDeployment[]; checkResults: PackCheckResult[]; auditEvents: PackAuditEvent[];
}
export interface ReleaseEvidencePack {
  format: typeof EVIDENCE_PACK_FORMAT;
  subject: { organizationId: string; repositoryFullName: string; commitSha: string };
  generatedAt: string;
  summary: { deployments: number; successfulDeployments: number; environmentsReached: string[]; checksPassed: number; checksFailed: number; auditEvents: number };
  gaps: string[];
  deployments: PackDeployment[]; checkResults: PackCheckResult[]; auditEvents: PackAuditEvent[];
}

export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value as object).sort().map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

const by = <T>(key: (x: T) => string) => (a: T, b: T) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);

export function buildReleaseEvidencePack(input: ReleaseEvidencePackInput): { pack: ReleaseEvidencePack; digest: string; body: string } {
  const deployments = [...input.deployments].sort(by((d) => `${d.createdAt}\u0000${d.id}`));
  const checkResults = [...input.checkResults].sort(by((c) => `${c.reportedAt}\u0000${c.checkKey}\u0000${c.stage}`));
  const auditEvents = [...input.auditEvents].sort(by((e) => `${e.createdAt}\u0000${e.subjectId}\u0000${e.kind}`));
  const successful = deployments.filter((d) => d.status === "completed" && d.conclusion === "success");
  const gaps: string[] = [];
  if (deployments.length === 0) gaps.push("No deployment of this commit is recorded in V19.");
  if (checkResults.length === 0) gaps.push("No deployment check results were reported by CI for this commit.");
  if (deployments.some((d) => !d.configDigest)) gaps.push("Some deployments have no recorded configuration fingerprint (dispatched before fingerprints were recorded).");
  if (deployments.some((d) => d.status !== "completed")) gaps.push("Some deployments have no confirmed final outcome yet.");
  if (deployments.some((d) => d.environmentTier === "prod") && !deployments.some((d) => d.environmentTier === "prod" && (d.branchPolicyId || d.pullRequestUrl))) gaps.push("No production deployment records a branch policy or reviewed pull request.");
  const pack: ReleaseEvidencePack = {
    format: EVIDENCE_PACK_FORMAT,
    subject: { organizationId: input.organizationId, repositoryFullName: input.repositoryFullName, commitSha: input.commitSha.toLowerCase() },
    generatedAt: input.generatedAt,
    summary: {
      deployments: deployments.length,
      successfulDeployments: successful.length,
      environmentsReached: [...new Set(successful.map((d) => d.environment))].sort(),
      checksPassed: checkResults.filter((c) => c.status === "passed").length,
      checksFailed: checkResults.filter((c) => c.status !== "passed").length,
      auditEvents: auditEvents.length,
    },
    gaps, deployments, checkResults, auditEvents,
  };
  // The digest covers the evidence, not the generation time, so re-exporting the same records matches.
  const digest = createHash("sha256").update(canonicalize({ ...pack, generatedAt: null })).digest("hex");
  return { pack, digest, body: `${JSON.stringify({ ...pack, digest: { algorithm: "sha256", covers: "pack without generatedAt, canonical JSON (sorted keys)", value: digest } }, null, 2)}\n` };
}
