import "server-only";
import { createHash } from "node:crypto";
import { resolveTenantScopedToken, parseRepositoryFullName, type InstallationRepo } from "@/lib/connectors/github/resolveTenantScopedToken";
import { readGithubProvenanceResource, readGithubProvenanceBundle, type GithubBundleDownloadRule, type GithubProvenanceResource } from "@/lib/connectors/github/githubWriteClient";
import { withGithubAbort } from "@/lib/connectors/github/boundedGithubRead";
import { matchesPattern } from "../branchValidationEvaluator";
import { evidenceDigest, parseManifestCandidate, type ManifestCandidate } from "./contract";
import { policyValid, type ReviewPolicy } from "./reviewCore";
import { inspectPublicTrustConfiguration, isValidBuildBinding, manifestBuildBinding, sigstoreRuntimeSupported, verifyBuildProvenance, type BuildBinding } from "./sigstoreBuildVerifier";
import { readGithubBuildSnapshot, type GithubBuildSnapshotClient } from "./githubBuildSnapshot";

export interface GithubBuildSnapshot {
  membership: { id: string; organizationId: string; userId: string; role: string; acceptedAt: string | null; updatedAt: string };
  repository: { id: string; organizationId: string; provider: string; remoteOwner: string; remoteName: string; updatedAt: string };
  environment: { id: string; organizationId: string; approvalPolicyId: string | null; updatedAt: string };
  installation: { id: string; organizationId: string; githubInstallationId: string; accountLogin: string; status: string; installedAt: string; updatedAt: string; revokedAt: string | null; suspendedAt: string | null };
  policy: ReviewPolicy;
  branchPolicies: { id: string; organizationId: string; repositoryId: string; environmentId: string; branchPattern: string; priority: number; requireReleaseTag: boolean; requireCodeowners: boolean; requirePrLink: boolean; requireChangeTicket: boolean; requirePromotionFromEnvironmentId: string | null; requireTestsPassing: boolean; enabled: boolean; updatedAt: string }[];
}
export interface GithubBuildScope { organizationId: string; userId: string }
export interface GithubBuildRequest {
  repositoryRecordId: string; environmentId: string; policyDigest: string;
  expected: Omit<BuildBinding, "organizationId" | "sourceRef">;
}
interface Options {
  client?: GithubBuildSnapshotClient & InstallationRepo;
  snapshot?: (scope: GithubBuildScope, request: GithubBuildRequest) => Promise<GithubBuildSnapshot | null>;
  token?: typeof resolveTenantScopedToken;
  profile?: unknown;
  downloadPolicy?: readonly GithubBundleDownloadRule[];
  clock?: () => Date;
}
const unavailable = (reason: string) => ({ kind: "unavailable" as const, reason });
class ReadFailure extends Error {}
function requireRead(value: unknown, reason: string): asserts value { if (!value) throw new ReadFailure(reason); }
function record(value: unknown): Record<string, unknown> { requireRead(value && typeof value === "object" && !Array.isArray(value), "github_metadata_unavailable"); return value as Record<string, unknown>; }
function numberId(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return typeof value === "string" && /^[1-9]\d{0,31}$/.test(value) ? value : null;
}
function validSnapshot(s: GithubBuildSnapshot, scope: GithubBuildScope, r: GithubBuildRequest): boolean {
  const m = s.membership, repo = s.repository, env = s.environment, install = s.installation;
  return Boolean(m.id && m.organizationId === scope.organizationId && m.userId === scope.userId && m.acceptedAt && ["owner", "admin"].includes(m.role)
    && repo.id === r.repositoryRecordId && repo.organizationId === scope.organizationId && repo.provider === "github" && `${repo.remoteOwner}/${repo.remoteName}` === r.expected.repositoryFullName
    && env.id === r.environmentId && env.organizationId === scope.organizationId && env.approvalPolicyId
    && install.id && install.organizationId === scope.organizationId && install.status === "active" && !install.revokedAt && !install.suspendedAt
    && numberId(install.githubInstallationId) && Number.isSafeInteger(Number(install.githubInstallationId)) && install.accountLogin.toLowerCase() === repo.remoteOwner.toLowerCase()
    && [m.acceptedAt, m.updatedAt, repo.updatedAt, env.updatedAt, install.installedAt, install.updatedAt].every(value => Number.isFinite(Date.parse(value)))
    && policyValid(s.policy, r.policyDigest) && (!s.policy.allowedRoles.length || s.policy.allowedRoles.includes(m.role))
    && Array.isArray(s.branchPolicies) && s.branchPolicies.length <= 100 && s.branchPolicies.every(p => p.organizationId === scope.organizationId && p.repositoryId === repo.id && p.environmentId === env.id
      && p.enabled && p.id && typeof p.branchPattern === "string" && p.branchPattern.length > 0 && p.branchPattern.length <= 256 && Number.isSafeInteger(p.priority) && Number.isFinite(Date.parse(p.updatedAt))));
}
function snapshotDigest(s: GithubBuildSnapshot): string { return evidenceDigest({ ...s, branchPolicies: [...s.branchPolicies].sort((a, b) => a.id.localeCompare(b.id)) }); }
function sourceBranch(value: unknown): string {
  requireRead(typeof value === "string" && value.length > 0 && value.length <= 255 && !value.startsWith("/") && !value.endsWith("/") && !value.includes("..") && !value.includes("@{") && !/[\s~^:?*\[\]\\]/.test(value), "unsupported_build_ref");
  return value;
}
function matchRepository(value: unknown, r: GithubBuildRequest) {
  const repo = record(value);
  requireRead(numberId(repo.id) === r.expected.repositoryId && repo.full_name === r.expected.repositoryFullName, "github_repository_identity_changed");
}

/** Internal read-only ingestion. Missing client/trust is unavailable; no global token or public route. */
export function createGithubBuildEvidenceReader(options: Options = {}) {
  const clock = options.clock ?? (() => new Date());
  const load = options.snapshot ?? (options.client ? (scope: GithubBuildScope, request: GithubBuildRequest) => readGithubBuildSnapshot(options.client!, scope, request) : async () => null);
  const token: typeof resolveTenantScopedToken = options.token ?? ((organizationId, repository, expectedInstallation) =>
    options.client ? resolveTenantScopedToken(organizationId, repository, expectedInstallation, options.client)
      : Promise.resolve({ ok: false, error: "github_token_unavailable" }));
  async function inspectBuild(scopeInput: GithubBuildScope, requestInput: GithubBuildRequest) {
    if (!sigstoreRuntimeSupported(process.versions.node)) return unavailable("unsupported_sigstore_runtime");
    try {
      const scope: GithubBuildScope = structuredClone(scopeInput), r: GithubBuildRequest = structuredClone(requestInput);
      requireRead(typeof scope.organizationId === "string" && scope.organizationId.length > 0 && typeof scope.userId === "string" && scope.userId.length > 0, "current_tenant_authority_required");
      requireRead(isValidBuildBinding({ ...r.expected, organizationId: scope.organizationId, sourceRef: "refs/heads/placeholder" }) && r.expected.workflowSha === r.expected.sourceSha, "unsupported_build_binding");
      const config = inspectPublicTrustConfiguration(options.profile, clock());
      if (config.kind !== "configured") return config;
      const configuredPolicy = structuredClone(options.downloadPolicy ?? []);
      requireRead(configuredPolicy.length > 0 && configuredPolicy.length <= 8, "bundle_download_policy_unavailable");
      const profile = config.profile, policy = configuredPolicy.filter(p => p.pathPrefix === `/attestations/${r.expected.repositoryId}/`);
      requireRead(policy.length > 0, "bundle_download_policy_unavailable");
      const configDigest = evidenceDigest({ profile, policy });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const signal = controller.signal, budget = { remainingBytes: 4 * 1024 * 1024 };
      try {
        async function capture() {
          signal.throwIfAborted();
          const snapshot = await withGithubAbort(load(scope, r), signal);
          requireRead(snapshot && validSnapshot(snapshot, scope, r), "current_github_review_authority_unavailable");
          return structuredClone(snapshot);
        }
        const initial = await capture(), initialDigest = snapshotDigest(initial);
        async function current(): Promise<boolean> {
          const nowConfig = inspectPublicTrustConfiguration(options.profile, clock());
          const currentPolicy = (options.downloadPolicy ?? []).filter(p => p.pathPrefix === `/attestations/${r.expected.repositoryId}/`);
          if (nowConfig.kind !== "configured" || evidenceDigest({ profile: nowConfig.profile, policy: currentPolicy }) !== configDigest) return false;
          return snapshotDigest(await capture()) === initialDigest;
        }
        const repository = parseRepositoryFullName(r.expected.repositoryFullName);
        requireRead(repository, "github_repository_unavailable");
        const credential = await withGithubAbort(token(scope.organizationId, repository, {
          id: initial.installation.id, githubInstallationId: initial.installation.githubInstallationId, updatedAt: new Date(initial.installation.updatedAt), signal, permissionProfile: "provenance_read",
        }), signal);
        requireRead(credential.ok && await current(), "github_installation_changed");
        async function read(resource: GithubProvenanceResource) {
          requireRead(await current(), "github_review_context_changed");
          const result = await readGithubProvenanceResource({ ...repository!, installationToken: credential.ok ? credential.token : "", signal, budget, resource });
          requireRead(result.ok, "github_build_metadata_unavailable");
          return result.data;
        }
        let branch: string | undefined;
        async function validateRun(resource: Extract<GithubProvenanceResource, { kind: "run" }>) {
          const run = record(await read(resource));
          matchRepository(run.repository, r); matchRepository(run.head_repository, r);
          requireRead(numberId(run.id) === r.expected.runId && run.run_attempt === r.expected.runAttempt && run.head_sha === r.expected.sourceSha
            && run.path === r.expected.workflowPath && ["push", "workflow_dispatch"].includes(String(run.event)) && run.status === "completed" && run.conclusion === "success", "github_build_run_changed_or_unsupported");
          const observedBranch = sourceBranch(run.head_branch);
          requireRead(branch === undefined || branch === observedBranch, "github_build_ref_changed"); branch = observedBranch;
          const workflows = run.referenced_workflows;
          if (profile.kind === "public_sigstore_direct_workflow_v1") {
            requireRead((workflows === undefined || (Array.isArray(workflows) && workflows.length === 0))
              && profile.signerWorkflow === `https://github.com/${r.expected.repositoryFullName}/${r.expected.workflowPath}@refs/heads/${observedBranch}`
              && profile.signerWorkflowSha === r.expected.workflowSha, "github_direct_signer_workflow_unavailable");
          } else {
            requireRead(Array.isArray(workflows) && workflows.length <= 20 && workflows.some(value => { const w = record(value); return w.path === profile.signerWorkflow.replace("https://github.com/", "") && w.sha === profile.signerWorkflowSha; }), "github_signer_workflow_unavailable");
          }
          const rules = [...initial.branchPolicies].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
          const selected = rules.find(p => matchesPattern(observedBranch, p.branchPattern));
          requireRead(!rules.length || (selected && !selected.requireReleaseTag), "unsupported_build_ref_policy");
        }
        async function validateRepository() {
          const remote = record(await read({ kind: "repository" })); matchRepository(remote, r);
          requireRead(remote.private === false, "private_trust_profile_unavailable");
        }
        await validateRepository();
        await validateRun({ kind: "run", runId: r.expected.runId });
        await validateRun({ kind: "run", runId: r.expected.runId, attempt: r.expected.runAttempt });
        const workflow = record(await read({ kind: "workflow", workflowPath: r.expected.workflowPath, commitSha: r.expected.workflowSha }));
        requireRead(workflow.type === "file" && workflow.path === r.expected.workflowPath && workflow.encoding === "base64" && typeof workflow.content === "string" && /^[A-Za-z0-9+/=\r\n]+$/.test(workflow.content), "github_workflow_content_unavailable");
        const content = Buffer.from(workflow.content, "base64");
        requireRead(content.length > 0 && content.length <= 128 * 1024 && content.length === workflow.size
          && content.toString("base64") === workflow.content.replace(/[\r\n]/g, "")
          && createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex") === workflow.sha, "github_workflow_content_unavailable");
        const listed = record(await read({ kind: "attestations", subjectSha256: r.expected.subjects[0].sha256 }));
        requireRead(Array.isArray(listed.attestations) && listed.attestations.length > 0 && listed.attestations.length <= 5, "bounded_attestation_unavailable");
        let bundle: Uint8Array | undefined;
        for (const value of listed.attestations) {
          const entry = record(value);
          requireRead(numberId(entry.repository_id) === r.expected.repositoryId && typeof entry.bundle_url === "string", "github_attestation_repository_mismatch");
          requireRead(await current(), "github_review_context_changed");
          const result = await readGithubProvenanceBundle({ url: entry.bundle_url, policy, signal, budget });
          requireRead(result.ok, "bounded_attestation_unavailable");
          if (`sha256:${createHash("sha256").update(result.data).digest("hex")}` === r.expected.attestationDigest) { bundle = result.data; break; }
        }
        requireRead(bundle && branch, "exact_attestation_bytes_unavailable");
        await validateRepository();
        await validateRun({ kind: "run", runId: r.expected.runId });
        await validateRun({ kind: "run", runId: r.expected.runId, attempt: r.expected.runAttempt });
        requireRead(await current(), "github_review_context_changed");
        const result = await verifyBuildProvenance({ bytes: bundle, binding: { ...r.expected, organizationId: scope.organizationId, sourceRef: `refs/heads/${branch}` }, profile, authorize: async org => org === scope.organizationId && await current(), now: clock() });
        signal.throwIfAborted();
        requireRead(await current(), "github_review_context_changed");
        return result;
      } finally { clearTimeout(timeout); controller.abort(); }
    } catch (error) { return unavailable(error instanceof ReadFailure ? error.message : "github_build_evidence_unavailable"); }
  }
  return {
    inspectBuild,
    async inspectManifest(scope: GithubBuildScope, input: { repositoryRecordId: string; candidate: ManifestCandidate }) {
      const parsed = parseManifestCandidate(input.candidate.manifest, clock());
      if (parsed.kind !== "structural_candidate" || parsed.digest !== input.candidate.digest || parsed.manifest.organizationId !== scope.organizationId) return unavailable("invalid_or_expired_manifest");
      const binding = manifestBuildBinding(parsed, "refs/heads/placeholder");
      const expected = { repositoryId: binding.repositoryId, repositoryFullName: binding.repositoryFullName, sourceSha: binding.sourceSha,
        workflowPath: binding.workflowPath, workflowSha: binding.workflowSha, runId: binding.runId, runAttempt: binding.runAttempt,
        attestationDigest: binding.attestationDigest, subjects: binding.subjects };
      const result = await inspectBuild(scope, { repositoryRecordId: input.repositoryRecordId, environmentId: parsed.manifest.environmentId, policyDigest: parsed.manifest.policyDigest, expected });
      const after = parseManifestCandidate(input.candidate.manifest, clock());
      if (after.kind !== "structural_candidate" || after.digest !== parsed.digest) return unavailable("invalid_or_expired_manifest");
      return result;
    },
  };
}
