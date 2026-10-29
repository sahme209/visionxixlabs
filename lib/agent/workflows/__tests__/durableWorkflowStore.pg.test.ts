import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { realpathSync, statSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const fixture = vi.hoisted(() => ({ client: undefined as unknown as PrismaClient }));
vi.mock("@/lib/db", () => ({ get prisma() { return fixture.client; } }));
import {
  createDurableWorkflow, claimDurableWorkflow, checkpointDurableWorkflow,
  requestDurableWorkflowCancellation, acknowledgeDurableWorkflowCancellation,
  recoverExpiredDurableWorkflowLeases, DurableWorkflowConflictError,
} from "../durableWorkflowStore";

import { claimReleaseBatchObservation } from "../releaseBatchObservationLease";
import { checkpointReleaseBatchObservation } from "../releaseBatchObservationCheckpoint";
import { ensureReleaseBatchObservation } from "../releaseBatchObservationCreation";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { findDueReleaseBatchObservations } from "../releaseBatchObservationTick";
import { cancelReleaseBatchObservation } from "../releaseBatchObservationCancellation";
const socket = process.env.AXIOM_OWNED_WORKFLOW_PG_SOCKET;
const now = new Date("2026-10-23T09:00:00Z");
describe.skipIf(!socket)("durable workflow actual isolated PostgreSQL", () => {
  beforeAll(async () => {
    // A caller cannot substitute a network database or a production URL.
    if (!socket || !/^\/private\/tmp\/axiom-private-restore-[^/]+\/socket$/.test(socket)
        || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0) {
      throw new Error("owned_private_socket_required");
    }
    fixture.client = new PrismaClient({ datasources: { db: {
      url: `postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}`,
    } } });
    const [binding] = await fixture.client.$queryRawUnsafe<Array<{ private: boolean }>>(
      `SELECT current_database()='neondb' AND current_user='recovery_fixture'
        AND current_setting('listen_addresses')='' AS private`);
    if (!binding?.private) throw new Error("owned_fixture_binding_required");
  });
  beforeEach(async () => {
    // This fixture is owned, isolated and restored for this test invocation only.
    await fixture.client.durableAgentWorkflowEvent.deleteMany();
    await fixture.client.durableAgentWorkflow.deleteMany();
  });
  afterAll(async () => { await fixture.client?.$disconnect(); });
  async function create(maxAttempts = 3) {
    return createDurableWorkflow({ organizationId: "fixture_org", requestedByUserId: "fixture_user",
      workflowKind: "fixture_readonly", objective: "Exercise storage without provider actions",
      autonomyLevel: "observe", input: {}, maxAttempts });
  }
  async function events(id: string) {
    return fixture.client.durableAgentWorkflowEvent.findMany({ where: { workflowRunId: id }, orderBy: { sequence: "asc" } });
  }
  it("creates one observation and event under concurrent requests and never resets its deadline", async () => {
    const requestId = "fixture_creation_" + Date.now();
    const intake = { id: requestId, tenantId: "fixture_org", airflowDependency: { connectionId: "fixture_airflow", connectionUpdatedAt: now.toISOString(), runs: [{ dagId: "batch", dagRunId: "exact", logicalDate: now.toISOString() }] } };
    const request = await fixture.client.tauriDeploymentRequest.create({ data: { id: requestId, organizationId: "fixture_org", requesterUserId: "fixture_user", title: "Owned observation fixture", correlationId: requestId, status: "submitted", intakeJson: intake } });
    try {
      const input = { organizationId: request.organizationId, requestId, expectedVersion: request.version, expectedDigest: sha256ContentHash({ requestVersion: request.version, intake }), requestedByUserId: "fixture_user", deadlineAt: now.getTime() + 600_000, now };
      const [a, b] = await Promise.all([ensureReleaseBatchObservation(input), ensureReleaseBatchObservation(input)]);
      expect(a.id).toBe(b.id);
      expect(await events(a.id)).toHaveLength(1);
      const replay = await ensureReleaseBatchObservation({ ...input, now: new Date(now.getTime() + 700_000), deadlineAt: now.getTime() + 900_000 });
      expect(replay.inputJson).toEqual(a.inputJson);
      expect(replay.requestedByUserId).toBe("fixture_user");
    } finally { await fixture.client.tauriDeploymentRequest.delete({ where: { id: requestId } }); }
  });
  it("selects an overdue repeat observation ahead of newly arriving null-due queued waits", async () => {
    const older = await createObservation();
    await fixture.client.durableAgentWorkflow.update({ where: { id: older.id }, data: { status: "retrying", nextAttemptAt: new Date(now.getTime() - 1000), updatedAt: new Date(now.getTime() - 60000) } });
    for (let wave = 0; wave < 2; wave += 1) {
      for (let index = 0; index < 3; index += 1) { const newer = await createObservation(); await fixture.client.durableAgentWorkflow.update({ where: { id: newer.id }, data: { updatedAt: new Date(now.getTime() + wave * 1000) } }); }
      expect((await findDueReleaseBatchObservations(now))[0].id).toBe(older.id);
    }
  });
  async function createObservation() {
    const run = await fixture.client.durableAgentWorkflow.create({ data: {
      organizationId: "fixture_org", requestedByUserId: "fixture_user", workflowKind: "release_batch_observation_v1",
      objective: "Observe exact batches without executing", autonomyLevel: "observe", currentStep: "observe_batches",
      inputJson: { requestId: "fixture_release", requestVersion: 2, intakeDigest: "a".repeat(64), startedAt: now.getTime(), deadlineAt: now.getTime() + 600_000 },
      stateJson: { observationCount: 0 }, maxAttempts: 1,
    } });
    return run;
  }
  it("cancels only the creator's reserved wait and fences late worker results", async () => {
    const run = await createObservation();
    await claimReleaseBatchObservation({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 0, workerId: "reader", now });
    const cancel = { organizationId: run.organizationId, requestId: "fixture_release", workflowRunId: run.id, expectedVersion: 1, actorUserId: "fixture_user", now };
    await expect(cancelReleaseBatchObservation({ ...cancel, actorUserId: "different_user" })).rejects.toThrow();
    const result = await cancelReleaseBatchObservation(cancel);
    expect(result).toMatchObject({ version: 2, status: "cancelled", leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: null, attemptCount: 0 });
    await expect(checkpointReleaseBatchObservation({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 1, workerId: "reader", observation: "ready", now })).rejects.toThrow();
    expect(await findDueReleaseBatchObservations(new Date(now.getTime() + 60001))).toEqual([]);
    expect(await events(run.id)).toHaveLength(2);
    await cancelReleaseBatchObservation({ ...cancel, expectedVersion: 2 });
    expect(await events(run.id)).toHaveLength(2);
  });
  it("keeps read observations separate from write attempts across repeated claims", async () => {
    const run = await createObservation();
    expect(await claimDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 0, workerId: "generic", now })).toBeNull();
    const claims = await Promise.all(["a", "b"].map(workerId => claimReleaseBatchObservation({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 0, workerId, now })));
    const winner = claims.find(Boolean)!;
    expect(claims.filter(Boolean)).toHaveLength(1);
    await expect(checkpointDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 1, workerId: winner.leaseOwner!, state: {}, status: "completed", now })).rejects.toBeInstanceOf(DurableWorkflowConflictError);
    await checkpointReleaseBatchObservation({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 1, workerId: winner.leaseOwner!, observation: "waiting", now });
    const later = new Date(now.getTime() + 15_000);
    const second = await claimReleaseBatchObservation({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 2, workerId: "reader", now: later });
    expect(second).toMatchObject({ version: 3, attemptCount: 0 });
    await checkpointReleaseBatchObservation({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 3, workerId: "reader", observation: "ready", now: later });
    const stored = await fixture.client.durableAgentWorkflow.findUniqueOrThrow({ where: { id: run.id } });
    expect(stored).toMatchObject({ version: 4, attemptCount: 0, status: "paused_for_input", currentStep: "preflight_required", approvalProposalId: null, stateJson: { observationCount: 2, phase: "preflight_required" } });
    expect(stored.inputJson).toEqual(run.inputJson);
    expect(await events(run.id)).toHaveLength(4);
  });
  it("recovers an expired observation lease without spending a write attempt", async () => {
    const run = await createObservation();
    await claimReleaseBatchObservation({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 0, workerId: "lost", now });
    const later = new Date(now.getTime() + 61_000);
    expect(await recoverExpiredDurableWorkflowLeases({ now: later })).toMatchObject({ recovered: 1 });
    const again = await claimReleaseBatchObservation({ organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 2, workerId: "new", now: later });
    expect(again).toMatchObject({ version: 3, attemptCount: 0 });
  });
  it("atomically creates the initial event and permits only one competing worker", async () => {
    const run = await create();
    const wins = await Promise.all(["first", "second"].map(workerId => claimDurableWorkflow({
      organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 0, workerId, now,
    })));
    expect(wins.filter(Boolean)).toHaveLength(1);
    expect(await events(run.id)).toMatchObject([{ sequence: 0, eventType: "workflow.created" },
      { sequence: 1, eventType: "workflow.lease_acquired" }]);
    expect(wins.find(Boolean)).toMatchObject({ version: 1, attemptCount: 1, status: "running" });
  });
  it("rejects another tenant and stale checkpoint without an audit append", async () => {
    const run = await create();
    expect(await claimDurableWorkflow({ organizationId: "other_org", workflowRunId: run.id,
      expectedVersion: 0, workerId: "wrong", now })).toBeNull();
    await claimDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 0, workerId: "owner", now });
    await expect(checkpointDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 1, workerId: "wrong", state: {}, status: "completed", now })).rejects.toBeInstanceOf(DurableWorkflowConflictError);
    expect(await events(run.id)).toHaveLength(2);
  });
  it("persists completion once and refuses a replay", async () => {
    const run = await create();
    await claimDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 0, workerId: "owner", now });
    const checkpoint = { organizationId: run.organizationId, workflowRunId: run.id, expectedVersion: 1,
      workerId: "owner", state: { result: "fixture_only" }, status: "completed" as const, now };
    expect(await checkpointDurableWorkflow(checkpoint)).toMatchObject({ status: "completed", version: 2,
      stateJson: { result: "fixture_only" }, leaseOwner: null, completedAt: now });
    await expect(checkpointDurableWorkflow(checkpoint)).rejects.toBeInstanceOf(DurableWorkflowConflictError);
    expect(await events(run.id)).toHaveLength(3);
  });
  it("cancellation invalidates a running worker and completes once acknowledged", async () => {
    const run = await create();
    await claimDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 0, workerId: "owner", now });
    await requestDurableWorkflowCancellation({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 1, actorUserId: "fixture_user", now });
    await expect(checkpointDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 1, workerId: "owner", state: {}, status: "completed", now })).rejects.toBeInstanceOf(DurableWorkflowConflictError);
    expect(await acknowledgeDurableWorkflowCancellation({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 2, actorKind: "system", now })).toMatchObject({ status: "cancelled", version: 3 });
    expect(await events(run.id)).toHaveLength(4);
  });
  it("recovers an abandoned lease and prevents its previous worker from completing", async () => {
    const run = await create();
    await claimDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 0, workerId: "old", leaseDurationMs: 1000, now });
    const later = new Date(now.getTime() + 2000);
    expect(await recoverExpiredDurableWorkflowLeases({ now: later })).toMatchObject({ inspected: 1, recovered: 1 });
    expect(await claimDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 2, workerId: "replacement", now: later })).toMatchObject({ version: 3, attemptCount: 2 });
    await expect(checkpointDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 1, workerId: "old", state: {}, status: "completed", now: later })).rejects.toBeInstanceOf(DurableWorkflowConflictError);
    expect(await events(run.id)).toHaveLength(4);
  });
  it("finishes cancellation when its worker disappears instead of stranding a retry", async () => {
    const run = await create();
    await claimDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 0, workerId: "disappeared", leaseDurationMs: 1000, now });
    await requestDurableWorkflowCancellation({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 1, actorUserId: "fixture_user", now });
    const later = new Date(now.getTime() + 2000);
    expect(await recoverExpiredDurableWorkflowLeases({ now: later })).toMatchObject({ recovered: 1 });
    expect(await fixture.client.durableAgentWorkflow.findUniqueOrThrow({ where: { id: run.id } }))
      .toMatchObject({ status: "cancelled", cancelledAt: later, completedAt: later,
        leaseOwner: null, nextAttemptAt: null, version: 3 });
    expect(await events(run.id)).toMatchObject([{ sequence: 0 }, { sequence: 1 }, { sequence: 2 },
      { sequence: 3, eventType: "workflow.cancelled" }]);
  });
  it("fails an exhausted abandoned workflow without dispatching or allowing another claim", async () => {
    const run = await create(1);
    await claimDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 0, workerId: "owner", leaseDurationMs: 1000, now });
    const later = new Date(now.getTime() + 2000);
    expect(await recoverExpiredDurableWorkflowLeases({ now: later })).toMatchObject({ recovered: 1 });
    expect(await fixture.client.durableAgentWorkflow.findUniqueOrThrow({ where: { id: run.id } }))
      .toMatchObject({ status: "failed", failureCode: "attempts_exhausted", attemptCount: 1, version: 2 });
    expect(await claimDurableWorkflow({ organizationId: run.organizationId, workflowRunId: run.id,
      expectedVersion: 2, workerId: "extra", now: later })).toBeNull();
    expect(await events(run.id)).toHaveLength(3);
  });
});
