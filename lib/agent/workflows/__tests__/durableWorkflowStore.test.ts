import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const durable = {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  };
  const event = { create: vi.fn() };
  const proposal = { findFirst: vi.fn() };
  const tx = {
    durableAgentWorkflow: durable,
    durableAgentWorkflowEvent: event,
    agentActionProposal: proposal,
  };
  return { durable, event, proposal, tx };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    durableAgentWorkflow: mocks.durable,
    $transaction: vi.fn(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx)),
  },
}));

import {
  DurableWorkflowConflictError,
  createDurableWorkflow,
  acknowledgeDurableWorkflowCancellation,
  checkpointDurableWorkflow,
  claimDurableWorkflow,
  requestDurableWorkflowCancellation,
  resumeDurableWorkflowFromApproval,
  recoverExpiredDurableWorkflowLeases,
} from "@/lib/agent/workflows/durableWorkflowStore";

const now = new Date("2026-10-13T19:30:00.000Z");

describe("durableWorkflowStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.durable.findUniqueOrThrow.mockResolvedValue({ id: "run_1", version: 2 });
    mocks.event.create.mockResolvedValue({ id: "event_1" });
  });

  it("claims a due workflow with a bounded lease and version CAS", async () => {
    mocks.durable.findFirst.mockResolvedValue({ attemptCount: 0, maxAttempts: 3 });
    mocks.durable.updateMany.mockResolvedValue({ count: 1 });

    const run = await claimDurableWorkflow({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 1,
      workerId: "worker_1",
      leaseDurationMs: 30_000,
      now,
    });

    expect(run).toEqual({ id: "run_1", version: 2 });
    expect(mocks.durable.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org_1", version: 1, attemptCount: 0, workflowKind: { notIn: ["release_batch_observation_v1", "release_operation_plan_v1", "release_provider_merge_v1", "release_provider_merge_approval_v1", "release_merge_execution_v1", "release_execution_approval_v1", "jira_ticket_action_v1", "servicenow_ticket_action_v1", "release_workflow_evidence_v1", "release_deployment_execution_v1", "github_installation_reconnect_v1", "slack_notification_v1", "slack_notification_approval_v1"] } }),
      data: expect.objectContaining({
        status: "running",
        leaseOwner: "worker_1",
        leaseExpiresAt: new Date("2026-10-13T19:30:30.000Z"),
        version: { increment: 1 },
      }),
    }));
    expect(mocks.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sequence: 2 }) });
  });

  it("does not claim an exhausted workflow", async () => {
    mocks.durable.findFirst.mockResolvedValue({ attemptCount: 3, maxAttempts: 3 });

    await expect(claimDurableWorkflow({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 4,
      workerId: "worker_1",
      now,
    })).resolves.toBeNull();
    expect(mocks.durable.updateMany).not.toHaveBeenCalled();
    expect(mocks.event.create).not.toHaveBeenCalled();
  });

  it("rejects a stale worker checkpoint without writing audit evidence", async () => {
    mocks.durable.updateMany.mockResolvedValue({ count: 0 });

    await expect(checkpointDurableWorkflow({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 2,
      workerId: "worker_1",
      state: { result: "verified" },
      status: "completed",
      now,
    })).rejects.toBeInstanceOf(DurableWorkflowConflictError);
    expect(mocks.durable.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workflowKind: { notIn: ["release_batch_observation_v1", "release_operation_plan_v1", "release_provider_merge_v1", "release_provider_merge_approval_v1", "release_merge_execution_v1", "release_execution_approval_v1", "jira_ticket_action_v1", "servicenow_ticket_action_v1", "release_workflow_evidence_v1", "release_deployment_execution_v1", "github_installation_reconnect_v1", "slack_notification_v1", "slack_notification_approval_v1"] } }) }));
    expect(mocks.event.create).not.toHaveBeenCalled();
  });

  it("fails closed when an approval is missing or expired", async () => {
    mocks.proposal.findFirst.mockResolvedValue(null);

    await expect(resumeDurableWorkflowFromApproval({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 3,
      approvalProposalId: "approval_1",
      now,
    })).rejects.toThrow("valid, unexpired approval");
    expect(mocks.durable.updateMany).not.toHaveBeenCalled();
  });

  it("invalidates a worker version when cancellation is requested", async () => {
    mocks.durable.updateMany.mockResolvedValue({ count: 1 });

    await requestDurableWorkflowCancellation({
      organizationId: "org_1",
      workflowRunId: "run_1",
      expectedVersion: 2,
      actorUserId: "admin_1",
      now,
    });

    expect(mocks.durable.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ version: 2, cancelRequestedAt: null }),
      data: { cancelRequestedAt: now, version: { increment: 1 } },
    }));
    expect(mocks.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      sequence: 3,
      eventType: "workflow.cancellation_requested",
      actorId: "admin_1",
    }) });
  });
  it.each([false, true])("finalizes an abandoned cancellation even when exhausted=%s", async (exhausted) => {
    mocks.durable.findMany.mockResolvedValue([{ id: "run_1", organizationId: "org_1", version: 2,
      attemptCount: exhausted ? 3 : 1, maxAttempts: 3, cancelRequestedAt: now }]);
    mocks.durable.updateMany.mockResolvedValue({ count: 1 });
    expect(await recoverExpiredDurableWorkflowLeases({ now })).toEqual({ inspected: 1, recovered: 1 });
    expect(mocks.durable.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: "cancelled", failureCode: null, cancelledAt: now, completedAt: now,
      nextAttemptAt: null, leaseOwner: null, leaseExpiresAt: null,
    }) }));
    expect(mocks.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      sequence: 3, eventType: "workflow.cancelled", actorKind: "system",
    }) });
  });

  it("does not append recovery evidence after losing the workflow version race", async () => {
    mocks.durable.findMany.mockResolvedValue([{ id: "run_1", organizationId: "org_1", version: 2,
      attemptCount: 1, maxAttempts: 3, cancelRequestedAt: now }]);
    mocks.durable.updateMany.mockResolvedValue({ count: 0 });
    expect(await recoverExpiredDurableWorkflowLeases({ now })).toEqual({ inspected: 1, recovered: 0 });
    expect(mocks.event.create).not.toHaveBeenCalled();
  });

});

it('refuses reserved release plans through generic creation',async()=>{await expect(createDurableWorkflow({organizationId:'org',workflowKind:'release_operation_plan_v1',objective:'Do not execute',autonomyLevel:'observe',input:{},requestedByUserId:'user'})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});
it.each(['cancel','ack','resume','recovery'])('excludes operation plans from generic %s mutations',async kind=>{mocks.durable.updateMany.mockResolvedValue({count:1});mocks.durable.findMany.mockResolvedValue([{id:'run',organizationId:'org',version:1,attemptCount:0,maxAttempts:3,cancelRequestedAt:null}]);mocks.proposal.findFirst.mockResolvedValue({id:'approval',actionDigest:'d',decidedByUserId:'reviewer'});if(kind==='cancel')await requestDurableWorkflowCancellation({organizationId:'org',workflowRunId:'run',expectedVersion:1,actorUserId:'user',now});if(kind==='ack')await acknowledgeDurableWorkflowCancellation({organizationId:'org',workflowRunId:'run',expectedVersion:1,actorKind:'system',now});if(kind==='resume')await resumeDurableWorkflowFromApproval({organizationId:'org',workflowRunId:'run',expectedVersion:1,approvalProposalId:'approval',now});if(kind==='recovery'){await recoverExpiredDurableWorkflowLeases({now});expect(mocks.durable.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({workflowKind:{notIn:['release_operation_plan_v1','release_provider_merge_v1','release_provider_merge_approval_v1','release_merge_execution_v1','release_execution_approval_v1','jira_ticket_action_v1','servicenow_ticket_action_v1','release_workflow_evidence_v1','release_deployment_execution_v1','github_installation_reconnect_v1','slack_notification_v1','slack_notification_approval_v1']}})}))}expect(mocks.durable.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({workflowKind:{notIn:['release_operation_plan_v1','release_provider_merge_v1','release_provider_merge_approval_v1','release_merge_execution_v1','release_execution_approval_v1','jira_ticket_action_v1','servicenow_ticket_action_v1','release_workflow_evidence_v1','release_deployment_execution_v1','github_installation_reconnect_v1','slack_notification_v1','slack_notification_approval_v1']}})}))});

it('refuses reserved merge execution through generic creation',async()=>{await expect(createDurableWorkflow({organizationId:"org",workflowKind:"release_merge_execution_v1",objective:"No generic merge",autonomyLevel:"observe",input:{},requestedByUserId:"user"})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});

it("refuses independent execution approvals through generic creation",async()=>{await expect(createDurableWorkflow({organizationId:"org",workflowKind:"release_execution_approval_v1",objective:"No generic approval",autonomyLevel:"observe",input:{},requestedByUserId:"user"})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});

it("refuses ticket actions through generic creation",async()=>{await expect(createDurableWorkflow({organizationId:"org",workflowKind:"jira_ticket_action_v1",objective:"No generic ticket write",autonomyLevel:"observe",input:{},requestedByUserId:"user"})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});

it("refuses ServiceNow ticket actions through generic creation",async()=>{await expect(createDurableWorkflow({organizationId:"org",workflowKind:"servicenow_ticket_action_v1",objective:"No generic ServiceNow write",autonomyLevel:"observe",input:{},requestedByUserId:"user"})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});

it('refuses provider merge operations through generic creation',async()=>{await expect(createDurableWorkflow({organizationId:'org',workflowKind:'release_provider_merge_v1',objective:'Dedicated executor only',autonomyLevel:'observe',input:{},requestedByUserId:'user'})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});
it('refuses provider approval records through generic workflow creation',async()=>{await expect(createDurableWorkflow({organizationId:'org',workflowKind:'release_provider_merge_approval_v1',objective:'Dedicated independent issuer only',autonomyLevel:'observe',input:{},requestedByUserId:'user'})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});

it('refuses release-bound evidence through generic creation',async()=>{await expect(createDurableWorkflow({organizationId:'org',workflowKind:'release_workflow_evidence_v1',objective:'Do not execute',autonomyLevel:'observe',input:{},requestedByUserId:'user'})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});

it('refuses deployment execution through generic creation',async()=>{await expect(createDurableWorkflow({organizationId:'org',workflowKind:'release_deployment_execution_v1',objective:'Do not execute',autonomyLevel:'observe',input:{},requestedByUserId:'user'})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});

it('refuses reconnect challenges through generic creation',async()=>{await expect(createDurableWorkflow({organizationId:'org',workflowKind:'github_installation_reconnect_v1',objective:'Do not execute',autonomyLevel:'observe',input:{},requestedByUserId:'user'})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});

it.each(["slack_notification_v1","slack_notification_approval_v1"])("refuses dedicated Slack state through generic creation: %s",async workflowKind=>{vi.clearAllMocks();await expect(createDurableWorkflow({organizationId:"org",workflowKind,objective:"Do not execute",autonomyLevel:"observe",input:{},requestedByUserId:"user"})).rejects.toThrow();expect(mocks.durable.create).not.toHaveBeenCalled()});
