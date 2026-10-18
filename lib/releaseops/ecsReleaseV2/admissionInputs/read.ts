import "server-only";
import type { InstallationRepo } from "@/lib/connectors/github/resolveTenantScopedToken";
import type { GithubBundleDownloadRule } from "@/lib/connectors/github/githubWriteClient";
import { withGithubAbort } from "@/lib/connectors/github/boundedGithubRead";
import type { EnrollmentPrincipal } from "@/lib/cloud/aws/enrollment/service";
import { readTenantEcsObservation, type EcsObservationRepo } from "@/lib/cloud/aws/ecsObservation/reader";
import { createGithubBuildEvidenceReader, githubBuildSnapshotDigest, type CheckedGithubBuildEvidenceV1 } from "../githubBuildEvidence";
import type { GithubBuildSnapshotClient } from "../githubBuildSnapshot";
import { evidenceDigest, imageSetDigest, type ImagePin } from "../contract";
import { inspectPublicTrustConfiguration, isValidBuildBinding } from "../sigstoreBuildVerifier";
import { readEcsAdmissionContext, type EcsAdmissionContextV1, type EcsInputSelectors } from "./context";

type AwsObservation = Awaited<ReturnType<typeof readTenantEcsObservation>>;
interface Options {
  client: GithubBuildSnapshotClient & InstallationRepo & EcsObservationRepo;
  profile?: unknown;
  downloadPolicy?: readonly GithubBundleDownloadRule[];
  clock?: () => Date;
}
interface CheckedInputsV1 {
  schema: "axiom.ecs.checked-provider-inputs.v1";
  context: EcsAdmissionContextV1;
  contextDigest: string;
  build: CheckedGithubBuildEvidenceV1;
  aws: AwsObservation;
  observedImageSetDigest: string;
  checkedAt: string;
}
export type EcsCheckedInputResult =
  | { kind: "checked_provider_context_inputs"; sourceCoverage: "matched"; usability: "inputs_only"; evidence: CheckedInputsV1 }
  | { kind: "checked_provider_inputs_subject_mismatch"; sourceCoverage: "mismatch"; usability: "not_usable_for_admission"; evidence: CheckedInputsV1 }
  | { kind: "unavailable"; reason: "invalid_input" | "configuration_unavailable" | "current_context_unavailable" | "context_changed" | "build_evidence_unavailable" | "aws_observation_unavailable" | "input_read_unavailable" };
type Reason = Extract<EcsCheckedInputResult, { kind: "unavailable" }>["reason"];
class InputFailure extends Error { constructor(readonly reason: Reason) { super(reason); } }
function requireInput(value: unknown, reason: Reason): asserts value { if (!value) throw new InputFailure(reason); }
const identity = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value);
const exactKeys = (value: object, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
/** Pure exact name+digest diagnostic. No registry aliases, artifact-type inference or permission. */
export function exactSubjectCoverage(subjects: CheckedGithubBuildEvidenceV1["subjects"], images: ImagePin[]): boolean {
  const wanted = new Set<string>();
  for (const { image } of images) {
    const pin = /^(.+)@sha256:([a-f0-9]{64})$/.exec(image);
    if (!pin) return false;
    wanted.add(JSON.stringify({ name: pin[1], sha256: pin[2] }));
  }
  const actual = new Set(subjects.map(s => JSON.stringify({ name: s.name, sha256: s.sha256 })));
  return wanted.size > 0 && actual.size === subjects.length && actual.size === wanted.size && [...actual].every(value => wanted.has(value));
}
/** Inactive server composition. A checked result is evidence input only, never durable admission. */
export function createEcsCheckedInputReader(options: Options) {
  const clock = options.clock ?? (() => new Date());
  return {
    async inspect(principalInput: EnrollmentPrincipal, input: EcsInputSelectors, parentSignal?: AbortSignal): Promise<EcsCheckedInputResult> {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60_000);
      const signal = parentSignal ? AbortSignal.any([parentSignal, controller.signal]) : controller.signal;
      try {
        signal.throwIfAborted();
        requireInput(JSON.stringify(input).length <= 64 * 1024, "invalid_input");
        const principal = structuredClone(principalInput), request = structuredClone(input), startedAt = clock();
        requireInput(exactKeys(principal, ["organizationId", "userId", "sessionId"]) && Object.values(principal).every(identity)
          && exactKeys(request, ["repositoryRecordId", "environmentId", "cloudAccountId", "baselineArn", "proposedArn", "build"])
          && [request.repositoryRecordId, request.environmentId, request.cloudAccountId].every(identity)
          && request.build && exactKeys(request.build, ["repositoryId", "repositoryFullName", "sourceSha", "workflowPath", "workflowSha", "runId", "runAttempt", "attestationDigest", "subjects"])
          && isValidBuildBinding({ ...request.build, organizationId: principal.organizationId, sourceRef: "refs/heads/placeholder" })
          && request.build.sourceSha === request.build.workflowSha, "invalid_input");
        const configuration = () => {
          const inspected = inspectPublicTrustConfiguration(options.profile, clock());
          requireInput(inspected.kind === "configured", "configuration_unavailable");
          const policy = structuredClone(options.downloadPolicy ?? []);
          requireInput(policy.length > 0 && policy.length <= 8 && policy.every(p => exactKeys(p, ["origin", "pathPrefix"]) && typeof p.origin === "string" && p.origin.length <= 256 && typeof p.pathPrefix === "string" && p.pathPrefix.length <= 256), "configuration_unavailable");
          return { profile: inspected.profile, downloadPolicy: policy };
        };
        const config = configuration(), configDigest = evidenceDigest(config);
        async function capture() {
          signal.throwIfAborted();
          const now = clock();
          requireInput(Number.isFinite(startedAt.getTime()) && Number.isFinite(now.getTime()) && now >= startedAt && now.getTime() - startedAt.getTime() < 60_000, "current_context_unavailable");
          requireInput(evidenceDigest(configuration()) === configDigest, "context_changed");
          const context = await withGithubAbort(readEcsAdmissionContext(options.client, principal, request, configDigest, now), signal);
          requireInput(context, "current_context_unavailable");
          const completedAt = clock();
          requireInput(Number.isFinite(completedAt.getTime()) && completedAt >= startedAt && completedAt.getTime() - startedAt.getTime() < 60_000
            && completedAt < new Date(context.session.expiresAt), "current_context_unavailable");
          requireInput(evidenceDigest(configuration()) === configDigest, "context_changed");
          return context;
        }
        const before = await capture(), contextDigest = evidenceDigest(before);
        async function current() {
          requireInput(evidenceDigest(await capture()) === contextDigest, "context_changed");
        }
        const scope = { organizationId: principal.organizationId, userId: principal.userId };
        const github = createGithubBuildEvidenceReader({ client: options.client, profile: config.profile, downloadPolicy: config.downloadPolicy, clock });
        const build = await github.inspectBuild(scope, { repositoryRecordId: request.repositoryRecordId, environmentId: request.environmentId, policyDigest: before.github.policy.digest, expected: request.build }, signal);
        requireInput(build.kind === "verified_build_provenance", "build_evidence_unavailable");
        requireInput(build.checkedBinding.contextDigest === githubBuildSnapshotDigest(before.github), "context_changed");
        await current();
        const aws = await readTenantEcsObservation(options.client, principal, request, { now: clock, signal });
        requireInput(aws.organizationId === principal.organizationId && aws.environmentId === request.environmentId
          && evidenceDigest(aws.targetSnapshot) === evidenceDigest(before.target)
          && evidenceDigest(aws.connection) === evidenceDigest(before.target.connection)
          && aws.baseline.arn === request.baselineArn && aws.proposed.arn === request.proposedArn, "aws_observation_unavailable");
        await current();
        signal.throwIfAborted();
        const deliveryAt = clock();
        requireInput(Number.isFinite(deliveryAt.getTime()) && deliveryAt >= startedAt && deliveryAt.getTime() - startedAt.getTime() < 60_000
          && deliveryAt < new Date(before.session.expiresAt), "current_context_unavailable");
        const evidence: CheckedInputsV1 = { schema: "axiom.ecs.checked-provider-inputs.v1", context: before, contextDigest, build, aws, observedImageSetDigest: imageSetDigest(aws.proposed.images), checkedAt: deliveryAt.toISOString() };
        return exactSubjectCoverage(build.subjects, aws.proposed.images)
          ? { kind: "checked_provider_context_inputs", sourceCoverage: "matched", usability: "inputs_only", evidence }
          : { kind: "checked_provider_inputs_subject_mismatch", sourceCoverage: "mismatch", usability: "not_usable_for_admission", evidence };
      } catch (error) {
        return { kind: "unavailable", reason: error instanceof InputFailure ? error.reason : "input_read_unavailable" };
      } finally { clearTimeout(timer); controller.abort(); }
    },
  };
}
