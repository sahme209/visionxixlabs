import type { ReleaseManifest, ManifestCandidate } from "../../lib/releaseops/ecsReleaseV2/contract";
import type { ReviewFacts } from "../../lib/releaseops/ecsReleaseV2/reviewCore";
export const reviewNow = new Date("2026-10-16T12:00:00Z");
const hash = (digit: string) => `sha256:${digit.repeat(64)}`;
const sourceSha = "a".repeat(40);
const image = (name: string, digit: string) => ({ container: name, image: `123456789012.dkr.ecr.us-east-1.amazonaws.com/${name}@${hash(digit)}` });
export function reviewManifest(): ReleaseManifest {
    return { protocol: "axiom.ecs.release.v2", operationId: "op-1", organizationId: "org-1", environmentId: "stage",
        repository: { id: "123", fullName: "owner/repo", sourceSha },
        build: { runId: "31", attempt: 1, workflowPath: ".github/workflows/build.yml", workflowSha: "b".repeat(40), attestationDigest: hash("c") },
        executor: { workflowPath: ".github/workflows/axiom-release-aws-ecs-v2.yml", workflowSha: "d".repeat(40) },
        target: { partition: "aws", accountId: "123456789012", region: "us-east-1", roleArn: "arn:aws:iam::123456789012:role/Deploy", clusterArn: "arn:aws:ecs:us-east-1:123456789012:cluster/app", serviceArn: "arn:aws:ecs:us-east-1:123456789012:service/app/web", revision: 4 },
        proposed: { arn: "arn:aws:ecs:us-east-1:123456789012:task-definition/web:12", contentDigest: hash("e"), images: [image("app", "1"), image("proxy", "2")] },
        baseline: { arn: "arn:aws:ecs:us-east-1:123456789012:task-definition/web:11", contentDigest: hash("f"), images: [image("app", "3"), image("proxy", "2")] },
        health: { kind: "alb_target_health", targetGroupArn: "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/web/abcdef0123456789", minimumHealthyTargets: 1, timeoutSeconds: 60, stabilizationSeconds: 300 },
        promotion: null, policyDigest: hash("4"), createdAt: "2026-10-16T11:00:00Z", expiresAt: "2026-10-16T13:00:00Z" };
}
/** Synthetic facts for isolated tests only; no provenance or provider verification. */
export function syntheticReviewFacts(candidate: ManifestCandidate): ReviewFacts {
    const m = structuredClone(candidate.manifest);
    return { source: "trusted_application_boundary", organizationId: m.organizationId, environmentId: m.environmentId, repository: m.repository, build: m.build, executor: m.executor, attestedImageSetDigest: candidate.imageSetDigest, target: m.target, proposed: m.proposed, baseline: m.baseline, associatedTargetGroups: [m.health.targetGroupArn] };
}
