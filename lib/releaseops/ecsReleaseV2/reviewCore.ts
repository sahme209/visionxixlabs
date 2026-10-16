import { evidenceDigest, matchTrustedReviewEvidence, parseManifestCandidate, type ManifestCandidate, type TrustedReleaseEvidence } from "./contract";
export const ECS_REVIEW_EXECUTION_ENABLED = false;
export type ReviewFacts = Omit<TrustedReleaseEvidence, "approval">;
export interface ReviewPolicy {
    digest: string;
    requiredApprovals: number;
    allowedRoles: string[];
    allowSelfApproval: boolean;
    blocked: boolean;
}
export interface ReviewPacket {
    id: string;
    organizationId: string;
    environmentId: string;
    operationId: string;
    manifestJson: unknown;
    manifestDigest: string;
    imageSetDigest: string;
    healthPolicyDigest: string;
    verifiedEvidenceJson: ReviewFacts;
    evidenceDigest: string;
    policyDigest: string;
    createdByUserId: string;
    createdAt: Date;
    expiresAt: Date;
}
export interface ReviewDecision {
    id: string;
    packetId: string;
    organizationId: string;
    userId: string;
    revision: number;
    decision: "approved" | "rejected" | "revoked";
    manifestDigest: string;
    policyDigest: string;
    decidedAt: Date;
    expiresAt: Date;
}
export interface ReviewCheckpoint {
    id: string;
    packetId: string;
    organizationId: string;
    manifestDigest: string;
    policyDigest: string;
    decisionSetDigest: string;
    decisionIds: string[];
    createdAt: Date;
    expiresAt: Date;
}
export interface ReviewTransaction {
    packetByOperation(organizationId: string, operationId: string): Promise<ReviewPacket | null>;
    packetById(organizationId: string, packetId: string): Promise<ReviewPacket | null>;
    createPacket(packet: ReviewPacket): Promise<void>;
    latestDecisions(organizationId: string, packetId: string): Promise<ReviewDecision[]>;
    appendDecision(decision: ReviewDecision): Promise<void>;
    checkpoint(organizationId: string, packetId: string, decisionSetDigest: string): Promise<ReviewCheckpoint | null>;
    createCheckpoint(checkpoint: ReviewCheckpoint): Promise<void>;
    membership(organizationId: string, userId: string): Promise<{
        acceptedAt: Date | null;
        role: string;
    } | null>;
    policy(organizationId: string, environmentId: string): Promise<ReviewPolicy | null>;
}
export interface ReviewStore {
    transaction<T>(operation: (tx: ReviewTransaction) => Promise<T>): Promise<T>;
}
export interface VerifiedReviewBoundary {
    /** Internal independently verified IO only. Never deserialize request JSON
     * into these facts. No runtime verifier is implemented by this module. */
    inspect(candidate: ManifestCandidate): Promise<{
        kind: "independently_verified";
        facts: ReviewFacts;
    } | {
        kind: "unavailable";
    }>;
}
interface Scope {
    organizationId: string;
    userId: string;
}
class ReviewFailure extends Error {
}
function deny(reason: string): never { throw new ReviewFailure(reason); }
const closed = (error: unknown) => ({ kind: "unavailable" as const, reason: error instanceof ReviewFailure ? error.message : "review_outcome_unknown", executionEnabled: false as const });
function sameFacts(candidate: ManifestCandidate, facts: ReviewFacts): boolean {
    return matchTrustedReviewEvidence(candidate, facts, new Date(candidate.manifest.createdAt)).kind === "review_facts_match";
}
async function authority(tx: ReviewTransaction, scope: Scope): Promise<string> {
    const member = await tx.membership(scope.organizationId, scope.userId);
    if (!member?.acceptedAt || !["owner", "admin"].includes(member.role))
        deny("current_management_membership_required");
    return member.role;
}
export function policyValid(policy: ReviewPolicy | null, digest: string): policy is ReviewPolicy {
    return Boolean(policy && policy.digest === digest && !policy.blocked && Number.isSafeInteger(policy.requiredApprovals) && policy.requiredApprovals >= 1 && policy.requiredApprovals <= 20
        && Array.isArray(policy.allowedRoles) && policy.allowedRoles.every(role => ["owner", "admin"].includes(role)) && typeof policy.allowSelfApproval === "boolean");
}
function checkedPacket(packet: ReviewPacket | null, organizationId: string, now: Date): {
    packet: ReviewPacket;
    candidate: ManifestCandidate;
} {
    if (!packet || packet.organizationId !== organizationId || packet.expiresAt.getTime() <= now.getTime())
        deny("review_packet_missing_or_expired");
    const candidate = parseManifestCandidate(packet.manifestJson, now);
    if (candidate.kind !== "structural_candidate" || candidate.digest !== packet.manifestDigest || candidate.imageSetDigest !== packet.imageSetDigest || candidate.healthPolicyDigest !== packet.healthPolicyDigest
        || candidate.manifest.organizationId !== packet.organizationId || candidate.manifest.environmentId !== packet.environmentId || candidate.manifest.operationId !== packet.operationId
        || candidate.manifest.policyDigest !== packet.policyDigest || Date.parse(candidate.manifest.expiresAt) !== packet.expiresAt.getTime()
        || evidenceDigest(packet.verifiedEvidenceJson) !== packet.evidenceDigest || !sameFacts(candidate, packet.verifiedEvidenceJson))
        deny("review_packet_integrity_failed");
    return { packet, candidate };
}
/** Internal durable review lifecycle only. No routes, runtime verifier,
 * dispatch, signing, execution claim or live allowance consumption. */
export function createReviewCore(store: ReviewStore, options: {
    verifier?: VerifiedReviewBoundary;
    now?: () => Date;
    id: () => string;
}) {
    const clock = options.now ?? (() => new Date());
    return {
        async prepare(scope: Scope, submitted: unknown) {
            try {
                const candidate = parseManifestCandidate(submitted, clock());
                if (candidate.kind !== "structural_candidate" || candidate.manifest.organizationId !== scope.organizationId)
                    deny("invalid_review_candidate");
                if (!options.verifier)
                    deny("independent_verifier_unavailable");
                // Reject unauthorized/costly provider reads before crossing the
                // independently verified boundary. Recheck after IO below.
                await store.transaction(async (tx) => {
                    await authority(tx, scope);
                    const policy = await tx.policy(scope.organizationId, candidate.manifest.environmentId);
                    if (!policyValid(policy, candidate.manifest.policyDigest))
                        deny("current_review_policy_unavailable");
                });
                const observed = await options.verifier.inspect(candidate);
                if (observed.kind !== "independently_verified" || !sameFacts(candidate, observed.facts))
                    deny("independent_evidence_unavailable");
                return await store.transaction(async (tx) => {
                    await authority(tx, scope);
                    const current = parseManifestCandidate(candidate.manifest, clock());
                    if (current.kind !== "structural_candidate" || current.digest !== candidate.digest)
                        deny("review_expired_or_changed");
                    const policy = await tx.policy(scope.organizationId, candidate.manifest.environmentId);
                    if (!policyValid(policy, candidate.manifest.policyDigest))
                        deny("current_review_policy_unavailable");
                    const prior = await tx.packetByOperation(scope.organizationId, candidate.manifest.operationId);
                    if (prior) {
                        checkedPacket(prior, scope.organizationId, clock());
                        if (prior.manifestDigest !== candidate.digest || prior.evidenceDigest !== evidenceDigest(observed.facts))
                            deny("review_operation_conflict");
                        return { kind: "review_packet_recorded" as const, packetId: prior.id, replayed: true, executionEnabled: false as const };
                    }
                    const packet: ReviewPacket = { id: options.id(), organizationId: scope.organizationId, environmentId: candidate.manifest.environmentId, operationId: candidate.manifest.operationId,
                        manifestJson: candidate.manifest, manifestDigest: candidate.digest, imageSetDigest: candidate.imageSetDigest, healthPolicyDigest: candidate.healthPolicyDigest,
                        verifiedEvidenceJson: structuredClone(observed.facts), evidenceDigest: evidenceDigest(observed.facts), policyDigest: policy.digest,
                        createdByUserId: scope.userId, createdAt: clock(), expiresAt: new Date(candidate.manifest.expiresAt) };
                    await tx.createPacket(packet);
                    return { kind: "review_packet_recorded" as const, packetId: packet.id, replayed: false, executionEnabled: false as const };
                });
            }
            catch (error) {
                return closed(error);
            }
        },
        async decide(scope: Scope, input: {
            packetId: string;
            expectedPriorRevision: number;
            decision: ReviewDecision["decision"];
        }) {
            try {
                if (!options.verifier)
                    deny("independent_verifier_unavailable");
                if (!Number.isSafeInteger(input.expectedPriorRevision) || input.expectedPriorRevision < 0 || !["approved", "rejected", "revoked"].includes(input.decision))
                    deny("invalid_review_decision");
                return await store.transaction(async (tx) => {
                    const role = await authority(tx, scope);
                    const { packet } = checkedPacket(await tx.packetById(scope.organizationId, input.packetId), scope.organizationId, clock());
                    const policy = await tx.policy(scope.organizationId, packet.environmentId);
                    if (!policyValid(policy, packet.policyDigest) || (policy.allowedRoles.length && !policy.allowedRoles.includes(role)))
                        deny("current_review_policy_unavailable");
                    if (input.decision === "approved" && !policy.allowSelfApproval && packet.createdByUserId === scope.userId)
                        deny("self_approval_forbidden");
                    const decisions = await tx.latestDecisions(scope.organizationId, packet.id);
                    const previous = decisions.find(decision => decision.userId === scope.userId);
                    if ((previous?.revision ?? 0) !== input.expectedPriorRevision || input.expectedPriorRevision >= 2147483647)
                        deny("review_decision_conflict");
                    const decision: ReviewDecision = { id: options.id(), packetId: packet.id, organizationId: scope.organizationId, userId: scope.userId, revision: input.expectedPriorRevision + 1,
                        decision: input.decision, manifestDigest: packet.manifestDigest, policyDigest: packet.policyDigest, decidedAt: clock(), expiresAt: packet.expiresAt };
                    await tx.appendDecision(decision);
                    return { kind: "review_decision_recorded" as const, revision: decision.revision, executionEnabled: false as const };
                });
            }
            catch (error) {
                return closed(error);
            }
        },
        async checkpoint(scope: Scope, packetId: string) {
            try {
                if (!options.verifier)
                    deny("independent_verifier_unavailable");
                return await store.transaction(async (tx) => {
                    await authority(tx, scope);
                    const { packet } = checkedPacket(await tx.packetById(scope.organizationId, packetId), scope.organizationId, clock());
                    const policy = await tx.policy(scope.organizationId, packet.environmentId);
                    if (!policyValid(policy, packet.policyDigest))
                        deny("current_review_policy_unavailable");
                    const decisions = await tx.latestDecisions(scope.organizationId, packet.id);
                    const qualifying: ReviewDecision[] = [];
                    const voters = new Set<string>();
                    for (const decision of decisions) {
                        if (voters.has(decision.userId) || !Number.isSafeInteger(decision.revision) || decision.revision < 1 || !["approved", "rejected", "revoked"].includes(decision.decision) || decision.decidedAt.getTime() > clock().getTime() || decision.expiresAt.getTime() > packet.expiresAt.getTime() || decision.organizationId !== scope.organizationId || decision.packetId !== packet.id || decision.manifestDigest !== packet.manifestDigest || decision.policyDigest !== packet.policyDigest)
                            deny("review_decision_integrity_failed");
                        voters.add(decision.userId);
                        if (decision.decision === "rejected" || decision.decision === "revoked")
                            deny("review_rejected_or_revoked");
                        const member = await tx.membership(scope.organizationId, decision.userId);
                        if (decision.decision === "approved" && decision.expiresAt.getTime() > clock().getTime() && member?.acceptedAt && ["owner", "admin"].includes(member.role)
                            && (!policy.allowedRoles.length || policy.allowedRoles.includes(member.role)) && (policy.allowSelfApproval || packet.createdByUserId !== decision.userId))
                            qualifying.push(decision);
                    }
                    if (qualifying.length < policy.requiredApprovals)
                        deny("review_quorum_missing");
                    const decisionIds = qualifying.map(decision => decision.id).sort();
                    const decisionSetDigest = evidenceDigest(decisionIds);
                    let checkpoint = await tx.checkpoint(scope.organizationId, packet.id, decisionSetDigest);
                    if (checkpoint && (checkpoint.organizationId !== scope.organizationId || checkpoint.packetId !== packet.id || checkpoint.manifestDigest !== packet.manifestDigest || checkpoint.policyDigest !== packet.policyDigest || checkpoint.decisionSetDigest !== decisionSetDigest || evidenceDigest(checkpoint.decisionIds) !== decisionSetDigest || checkpoint.expiresAt.getTime() > packet.expiresAt.getTime() || checkpoint.expiresAt.getTime() <= clock().getTime()))
                        deny("review_checkpoint_integrity_failed");
                    if (!checkpoint) {
                        checkpoint = { id: options.id(), packetId: packet.id, organizationId: scope.organizationId, manifestDigest: packet.manifestDigest, policyDigest: packet.policyDigest,
                            decisionSetDigest, decisionIds, createdAt: clock(), expiresAt: packet.expiresAt };
                        await tx.createCheckpoint(checkpoint);
                    }
                    return { kind: "review_ready_execution_disabled" as const, checkpointId: checkpoint.id, executionEnabled: false as const };
                });
            }
            catch (error) {
                return closed(error);
            }
        },
        execution() { return { kind: "execution_disabled" as const, executionEnabled: false as const }; },
    };
}
