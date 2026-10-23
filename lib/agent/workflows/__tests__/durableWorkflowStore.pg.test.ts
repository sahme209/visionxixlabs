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
