import { expect, it, vi } from "vitest";
import { createReviewCore, type ReviewStore, type ReviewTransaction, type ReviewPacket, type ReviewDecision, type ReviewCheckpoint, type ReviewPolicy } from "../reviewCore";
import { reviewManifest, reviewNow, syntheticReviewFacts } from "@/scripts/fixtures/ecsReviewFixture";
import { validateReviewRehearsalTarget } from "@/scripts/rehearse-ecs-review.mjs";
function fixture() {
    const packets: ReviewPacket[] = [], decisions: ReviewDecision[] = [], checkpoints: ReviewCheckpoint[] = [];
    const members = new Map(["author", "alice", "bob"].map(user => [user, { role: "admin", acceptedAt: new Date(reviewNow) }]));
    const policy: ReviewPolicy = { digest: reviewManifest().policyDigest, requiredApprovals: 2, allowedRoles: ["admin"], allowSelfApproval: false, blocked: false };
    const tx: ReviewTransaction = {
        packetByOperation: async (org, op) => packets.find(p => p.organizationId === org && p.operationId === op) ?? null,
        packetById: async (org, id) => packets.find(p => p.organizationId === org && p.id === id) ?? null,
        createPacket: async (p) => { packets.push(structuredClone(p)); },
        latestDecisions: async (org, packet) => [...new Set(decisions.filter(d => d.organizationId === org && d.packetId === packet).map(d => d.userId))].map(user => decisions.filter(d => d.userId === user && d.packetId === packet).sort((a, b) => b.revision - a.revision)[0]),
        appendDecision: async (d) => { decisions.push(structuredClone(d)); },
        checkpoint: async (org, packet, digest) => checkpoints.find(c => c.organizationId === org && c.packetId === packet && c.decisionSetDigest === digest) ?? null,
        createCheckpoint: async (c) => { checkpoints.push(structuredClone(c)); },
        membership: async (org, user) => org === "org-1" ? members.get(user) ?? null : null,
        policy: async (org) => org === "org-1" ? structuredClone(policy) : null,
    };
    const store: ReviewStore = { transaction: async (operation) => operation(tx) };
    let next = 0;
    let time = reviewNow;
    const verifier = { inspect: vi.fn(async (candidate: Parameters<typeof syntheticReviewFacts>[0]) => ({ kind: "independently_verified" as const, facts: syntheticReviewFacts(candidate) })) };
    const core = createReviewCore(store, { id: () => `review-${++next}`, now: () => time, verifier });
    const author = { organizationId: "org-1", userId: "author" };
    return { core, store, tx, packets, decisions, checkpoints, members, policy, verifier, author, expire: () => { time = new Date(reviewManifest().expiresAt); } };
}
it("default missing verifier cannot persist caller-supplied trust labels", async () => { const f = fixture(); const core = createReviewCore(f.store, { id: () => "id", now: () => reviewNow }); expect(await core.prepare(f.author, reviewManifest())).toMatchObject({ kind: "unavailable", reason: "independent_verifier_unavailable", executionEnabled: false }); expect(f.packets).toHaveLength(0); expect(core.execution()).toEqual({ kind: "execution_disabled", executionEnabled: false }); });
it("rejects cross-tenant and decorated candidates before the trusted boundary", async () => { const f = fixture(); expect((await f.core.prepare({ ...f.author, organizationId: "foreign" }, reviewManifest())).kind).toBe("unavailable"); expect((await f.core.prepare(f.author, { ...reviewManifest(), verified: true })).kind).toBe("unavailable"); expect(f.verifier.inspect).not.toHaveBeenCalled(); expect(f.packets).toHaveLength(0); });
it("requires matching independent facts rather than accepting a valid candidate hash", async () => { const f = fixture(); f.verifier.inspect.mockImplementation(async (candidate) => { const facts = syntheticReviewFacts(candidate); facts.target.accountId = "999999999999"; return { kind: "independently_verified", facts }; }); expect((await f.core.prepare(f.author, reviewManifest())).kind).toBe("unavailable"); expect(f.packets).toHaveLength(0); });
it("records and replays immutable review identity while rejecting changed operation content", async () => { const f = fixture(); expect((await f.core.prepare(f.author, reviewManifest())).kind).toBe("review_packet_recorded"); expect(await f.core.prepare(f.author, reviewManifest())).toMatchObject({ replayed: true, executionEnabled: false }); const changed = reviewManifest(); changed.target.revision++; expect(await f.core.prepare(f.author, changed)).toMatchObject({ reason: "review_operation_conflict" }); expect(f.packets).toHaveLength(1); });
it("detects packet storage tampering before recording approval", async () => { const f = fixture(); await f.core.prepare(f.author, reviewManifest()); f.packets[0].imageSetDigest = "sha256:" + "0".repeat(64); expect(await f.core.decide({ organizationId: "org-1", userId: "alice" }, { packetId: f.packets[0].id, expectedPriorRevision: 0, decision: "approved" })).toMatchObject({ reason: "review_packet_integrity_failed" }); expect(f.decisions).toHaveLength(0); });
it("supports append-only revocation, exact revision CAS and fresh current quorum", async () => {
    const f = fixture();
    await f.core.prepare(f.author, reviewManifest());
    const packetId = f.packets[0].id;
    for (const userId of ["alice", "bob"])
        expect((await f.core.decide({ ...f.author, userId }, { packetId, expectedPriorRevision: 0, decision: "approved" })).kind).toBe("review_decision_recorded");
    expect((await f.core.checkpoint(f.author, packetId)).kind).toBe("review_ready_execution_disabled");
    expect((await f.core.decide({ ...f.author, userId: "alice" }, { packetId, expectedPriorRevision: 1, decision: "revoked" })).kind).toBe("review_decision_recorded");
    expect(await f.core.checkpoint(f.author, packetId)).toMatchObject({ reason: "review_rejected_or_revoked" });
    expect(await f.core.decide({ ...f.author, userId: "alice" }, { packetId, expectedPriorRevision: 1, decision: "approved" })).toMatchObject({ reason: "review_decision_conflict" });
    expect(f.decisions).toHaveLength(3);
});
it("rechecks current role, policy and expiry without turning old checkpoints into authority", async () => { const f = fixture(); await f.core.prepare(f.author, reviewManifest()); const packetId = f.packets[0].id; f.policy.blocked = true; expect(await f.core.checkpoint(f.author, packetId)).toMatchObject({ reason: "current_review_policy_unavailable" }); f.policy.blocked = false; f.members.delete("author"); expect(await f.core.checkpoint(f.author, packetId)).toMatchObject({ reason: "current_management_membership_required" }); f.members.set("author", { role: "admin", acceptedAt: reviewNow }); f.expire(); expect(await f.core.checkpoint(f.author, packetId)).toMatchObject({ reason: "review_packet_missing_or_expired" }); });
it.each([undefined, "", "postgresql://production.example/axiom_ecs_review_rehearsal", "postgresql://127.0.0.1/production", "postgresql://localhost/axiom_ecs_review_rehearsal", "postgresql://127.0.0.1/axiom_ecs_review_rehearsal?schema=public"])("refuses nonisolated SQL rehearsal target: %s", value => { expect(() => validateReviewRehearsalTarget(value)).toThrow("isolated_ecs_review_target_required"); });
it("duplicate voter observations cannot manufacture a quorum", async () => {
    const f = fixture();
    await f.core.prepare(f.author, reviewManifest());
    const packetId = f.packets[0].id;
    await f.core.decide({ ...f.author, userId: "alice" }, { packetId, expectedPriorRevision: 0, decision: "approved" });
    f.tx.latestDecisions = async () => [f.decisions[0], f.decisions[0]];
    expect(await f.core.checkpoint(f.author, packetId)).toMatchObject({ reason: "review_decision_integrity_failed" });
});
it("an altered stored checkpoint cannot become a valid review snapshot", async () => {
    const f = fixture();
    await f.core.prepare(f.author, reviewManifest());
    const packetId = f.packets[0].id;
    for (const userId of ["alice", "bob"])
        await f.core.decide({ ...f.author, userId }, { packetId, expectedPriorRevision: 0, decision: "approved" });
    await f.core.checkpoint(f.author, packetId);
    f.checkpoints[0].policyDigest = "sha256:" + "0".repeat(64);
    expect(await f.core.checkpoint(f.author, packetId)).toMatchObject({ reason: "review_checkpoint_integrity_failed" });
});
it("requires accepted management authority and current policy before verifier IO", async () => {
    const unauthorized = fixture();
    unauthorized.members.delete("author");
    expect(await unauthorized.core.prepare(unauthorized.author, reviewManifest())).toMatchObject({ reason: "current_management_membership_required" });
    expect(unauthorized.verifier.inspect).not.toHaveBeenCalled();
    expect(unauthorized.packets).toHaveLength(0);
    const blocked = fixture();
    blocked.policy.blocked = true;
    expect(await blocked.core.prepare(blocked.author, reviewManifest())).toMatchObject({ reason: "current_review_policy_unavailable" });
    expect(blocked.verifier.inspect).not.toHaveBeenCalled();
    expect(blocked.packets).toHaveLength(0);
});
it("rechecks authority after verifier IO without preserving an unauthorized packet", async () => {
    const f = fixture();
    f.verifier.inspect.mockImplementation(async (candidate) => { f.members.delete("author"); return { kind: "independently_verified", facts: syntheticReviewFacts(candidate) }; });
    expect(await f.core.prepare(f.author, reviewManifest())).toMatchObject({ reason: "current_management_membership_required" });
    expect(f.packets).toHaveLength(0);
});
