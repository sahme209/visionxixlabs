import { prisma } from "@/lib/db";
import type { CloudSnapshot, ComputeResource } from "../cloudSnapshot";
import { deriveCostSignals, computeConfidence } from "../costSignals";
import { generateExecutionPlan } from "../executionPlan";
import type { ExecutionPlanItem } from "../executionPlan";
import { simulateDryRun } from "../dryRunSimulator";
import { runAllPrechecks, runPrechecks } from "../precheckSystem";
import { generateAllRollbackPlans, captureComputeState, captureStorageState } from "../rollbackPlanner";
import { getHandlersForProvider } from "../applyEngine";
import { verifyAppliedAction } from "../verificationEngine";
import { generateSnapshot } from "../agent/providerRegistry";
import { loadPreferences, filterIgnoredFindings } from "../agent/preferences";
import { findingToRecommendationWithPrefs, priorityScoreWithPrefs } from "../agent/prioritizer";
import type { AgentFinding, AgentRecommendation, ActionDisposition } from "../agent/types";
import type { AgentTaskType, TaskHandler, TaskContext, TaskHandlerResult } from "./types";

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

const HANDLERS: Record<AgentTaskType, TaskHandler> = {
  scan_cloud: handleScanCloud,
  analyze_snapshot: handleAnalyzeSnapshot,
  generate_execution_plan: handleGenerateExecutionPlan,
  generate_terraform: handleGenerateTerraform,
  request_approval: handleRequestApproval,
  apply_action: handleApplyAction,
  verify_action: handleVerifyAction,
  rollback_action: handleRollbackAction,
  schedule_next_scan: handleScheduleNextScan,
};

export function getHandler(taskType: AgentTaskType): TaskHandler {
  return HANDLERS[taskType];
}

// ---------------------------------------------------------------------------
// scan_cloud — collect a snapshot from the cloud provider
//
// Idempotent: if snapshotData already exists on the run, returns completed.
// ---------------------------------------------------------------------------

async function handleScanCloud(ctx: TaskContext): Promise<TaskHandlerResult> {
  const run = await prisma.axiomAgentRun.findUniqueOrThrow({
    where: { id: ctx.agentRunId },
  });

  if (run.snapshotData) {
    return {
      status: "completed",
      outputJson: { skipped: true, reason: "Snapshot already exists." },
    };
  }

  const account = await prisma.cloudAccount.findUnique({
    where: { id: ctx.cloudAccountId },
  });

  if (!account || !account.enabled) {
    return { status: "failed", errorMessage: "Cloud account not found or disabled." };
  }

  const credentialRef = account.credentialRef ?? account.id;
  const snapshot = await generateSnapshot(ctx.provider, ctx.userId, credentialRef);

  await prisma.axiomAgentRun.update({
    where: { id: ctx.agentRunId },
    data: { snapshotData: snapshot as object, startedAt: new Date(), status: "running" },
  });

  await prisma.cloudAccount.update({
    where: { id: account.id },
    data: { lastScannedAt: new Date() },
  });

  return {
    status: "completed",
    outputJson: {
      resourceCount: snapshot.resources.length,
      regionCount: snapshot.regions.length,
      provider: snapshot.provider,
    },
  };
}

// ---------------------------------------------------------------------------
// analyze_snapshot — derive cost signals and create findings
//
// Idempotent: if findings already exist for this run, returns completed.
// ---------------------------------------------------------------------------

async function handleAnalyzeSnapshot(ctx: TaskContext): Promise<TaskHandlerResult> {
  const existingFindings = await prisma.axiomFinding.count({
    where: { runId: ctx.agentRunId },
  });

  if (existingFindings > 0) {
    return {
      status: "completed",
      outputJson: { skipped: true, findingCount: existingFindings },
    };
  }

  const run = await prisma.axiomAgentRun.findUniqueOrThrow({
    where: { id: ctx.agentRunId },
  });

  const snapshot = run.snapshotData as unknown as CloudSnapshot;
  if (!snapshot) {
    return { status: "failed", errorMessage: "No snapshot data found on run." };
  }

  const costSummary = deriveCostSignals(snapshot);

  if (costSummary.signals.length === 0) {
    return {
      status: "completed",
      outputJson: { findingCount: 0, noIssues: true },
    };
  }

  const prefs = await loadPreferences(ctx.organizationId);

  const domainFindings: AgentFinding[] = costSummary.signals.map((signal, i) => {
    const avgMonthly = (signal.monthlyCostEstimate.low + signal.monthlyCostEstimate.high) / 2;
    return {
      id: `finding-${i + 1}`,
      category: "cost" as const,
      severity:
        signal.confidenceScore === "high"
          ? ("high" as const)
          : signal.confidenceScore === "medium"
            ? ("medium" as const)
            : ("low" as const),
      title: signal.issue,
      description: `${signal.resource}: ${signal.issue}`,
      affectedResources: [signal.resource],
      region: snapshot.regions[0] ?? "global",
      provider: snapshot.provider,
      confidence: signal.confidenceScore,
      estimatedSavings: { monthly: avgMonthly, yearly: avgMonthly * 12 },
      data: {
        monthlyCostEstimate: signal.monthlyCostEstimate,
        annualSavingsEstimate: signal.annualSavingsEstimate,
      },
    };
  });

  const dbFindings = await prisma.$transaction(
    domainFindings.map((f, i) => {
      const signal = costSummary.signals[i];
      return prisma.axiomFinding.create({
        data: {
          runId: ctx.agentRunId,
          category: f.category,
          severity: f.severity,
          title: f.title,
          description: f.description,
          affectedResources: f.affectedResources,
          region: f.region,
          provider: f.provider as any,
          confidence: f.confidence,
          monthlyLow: signal.monthlyCostEstimate.low,
          monthlyHigh: signal.monthlyCostEstimate.high,
          yearlyLow: signal.annualSavingsEstimate.low,
          yearlyHigh: signal.annualSavingsEstimate.high,
          data: f.data as object,
        },
      });
    }),
  );

  const allFindings = domainFindings.map((f, i) => ({ ...f, id: dbFindings[i].id }));
  const filtered = filterIgnoredFindings(allFindings, prefs);

  return {
    status: "completed",
    outputJson: {
      findingCount: filtered.length,
      totalSignals: costSummary.signals.length,
      ignoredCount: allFindings.length - filtered.length,
    },
  };
}

// ---------------------------------------------------------------------------
// generate_execution_plan — build plan + recommendations from findings
//
// Idempotent: if an execution plan already exists for this run, returns completed.
// ---------------------------------------------------------------------------

async function handleGenerateExecutionPlan(ctx: TaskContext): Promise<TaskHandlerResult> {
  const existingPlan = await prisma.axiomExecutionPlan.findUnique({
    where: { runId: ctx.agentRunId },
  });

  if (existingPlan) {
    return {
      status: "completed",
      outputJson: { skipped: true, planId: existingPlan.id },
    };
  }

  const run = await prisma.axiomAgentRun.findUniqueOrThrow({
    where: { id: ctx.agentRunId },
    include: { findings: true },
  });

  const snapshot = run.snapshotData as unknown as CloudSnapshot;
  if (!snapshot) {
    return { status: "failed", errorMessage: "No snapshot data found." };
  }

  if (run.findings.length === 0) {
    return {
      status: "completed",
      outputJson: { planItems: 0, noFindings: true },
    };
  }

  const prefs = await loadPreferences(ctx.organizationId);
  const executionPlan = generateExecutionPlan(snapshot);
  const computeResources = snapshot.resources.filter(
    (r): r is ComputeResource => r.resourceType === "compute",
  );
  const confidence = computeConfidence(!!snapshot.monthlySpend, computeResources);

  const findings: AgentFinding[] = run.findings.map((f) => ({
    id: f.id,
    category: f.category as AgentFinding["category"],
    severity: f.severity as AgentFinding["severity"],
    title: f.title,
    description: f.description,
    affectedResources: f.affectedResources as string[],
    region: f.region,
    provider: f.provider as AgentFinding["provider"],
    confidence: f.confidence as AgentFinding["confidence"],
    estimatedSavings: { monthly: (f.monthlyLow + f.monthlyHigh) / 2, yearly: (f.yearlyLow + f.yearlyHigh) / 2 },
    data: (f.data as Record<string, unknown>) ?? {},
  }));

  findings.sort((a, b) => priorityScoreWithPrefs(b, 0, prefs) - priorityScoreWithPrefs(a, 0, prefs));

  const recommendations: AgentRecommendation[] = findings.map((f, i) => {
    const matched =
      executionPlan.items.find(
        (item) =>
          item.resourceIds.some((rid) => f.affectedResources.includes(rid)) ||
          f.title.toLowerCase().includes(item.actionType.replace(/_/g, " ")),
      ) ??
      executionPlan.items[i] ??
      null;
    return findingToRecommendationWithPrefs(f, matched, confidence, i, prefs);
  });

  const dbRecs = await prisma.$transaction(
    recommendations.map((rec, i) =>
      prisma.axiomRecommendation.create({
        data: {
          runId: ctx.agentRunId,
          findingId: findings[i].id,
          title: rec.title,
          rationale: rec.rationale,
          disposition: rec.disposition as any,
          dispositionReason: rec.dispositionReason,
          actionType: rec.actionType as any ?? undefined,
          riskLevel: rec.riskLevel as any ?? undefined,
          effort: rec.effort,
          actionable: rec.actionable,
          monthlyLow: rec.estimatedSavings?.monthly ?? 0,
          monthlyHigh: rec.estimatedSavings?.monthly ?? 0,
          yearlyLow: rec.estimatedSavings?.yearly ?? 0,
          yearlyHigh: rec.estimatedSavings?.yearly ?? 0,
        },
      }),
    ),
  );

  if (executionPlan.items.length > 0) {
    const dryRun = simulateDryRun(executionPlan);
    const prechecks = runAllPrechecks(executionPlan.items);
    const rollbackPlans = generateAllRollbackPlans(executionPlan.items);

    const dbPlan = await prisma.axiomExecutionPlan.create({
      data: {
        runId: ctx.agentRunId,
        totalItems: executionPlan.items.length,
        safeToApply: dryRun.safeToApply,
        downtimeEstimate: dryRun.downtimeEstimate,
        rollbackComplexity: dryRun.rollbackComplexity,
        dryRunResult: dryRun as object,
      },
    });

    await prisma.$transaction(
      executionPlan.items.map((item, i) => {
        const rec = recommendations.find((r) => r.actionType === item.actionType);
        const dbRec = dbRecs.find((r) => r.actionType === item.actionType);
        const disposition: ActionDisposition = rec?.disposition ?? "approval_required";
        const precheck = prechecks.find((p) => p.itemId === item.id);
        const rollback = rollbackPlans.find((r) => r.itemId === item.id);

        return prisma.axiomExecutionPlanItem.create({
          data: {
            planId: dbPlan.id,
            recommendationId: dbRec?.id ?? null,
            actionType: item.actionType as any,
            provider: item.provider as any,
            region: item.region,
            resourceIds: item.resourceIds,
            currentState: item.currentState,
            recommendedState: item.recommendedState,
            riskLevel: item.riskLevel as any,
            disposition: disposition as any,
            monthlyLow: item.estimatedSavings.monthly,
            monthlyHigh: item.estimatedSavings.monthly,
            yearlyLow: item.estimatedSavings.yearly,
            yearlyHigh: item.estimatedSavings.yearly,
            rollbackPlan: rollback ? (rollback as object) : undefined,
            precheckResult: precheck ? (precheck as object) : undefined,
            sortOrder: i,
          },
        });
      }),
    );

    return {
      status: "completed",
      outputJson: {
        planId: dbPlan.id,
        planItems: executionPlan.items.length,
        recommendationCount: dbRecs.length,
      },
    };
  }

  return {
    status: "completed",
    outputJson: {
      planItems: 0,
      recommendationCount: dbRecs.length,
    },
  };
}

// ---------------------------------------------------------------------------
// generate_terraform — export the execution plan as IaC
//
// Reads inputJson.format ("terraform" | "cli" | "json"), defaults to terraform.
// ---------------------------------------------------------------------------

async function handleGenerateTerraform(ctx: TaskContext): Promise<TaskHandlerResult> {
  const plan = await prisma.axiomExecutionPlan.findUnique({
    where: { runId: ctx.agentRunId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!plan || plan.items.length === 0) {
    return { status: "skipped", errorMessage: "No execution plan items to export." };
  }

  const format = (ctx.inputJson?.format as string) ?? "terraform";
  const blocks: string[] = [];

  for (const item of plan.items) {
    if (format === "terraform") {
      blocks.push(toTerraformBlock(item));
    } else if (format === "cli") {
      blocks.push(toCliCommand(item));
    } else {
      blocks.push(JSON.stringify(itemToJson(item), null, 2));
    }
  }

  return {
    status: "completed",
    outputJson: { format, blockCount: blocks.length, output: blocks },
  };
}

// ---------------------------------------------------------------------------
// request_approval — create approval request records for pending items
//
// Idempotent: checks if approval requests already exist for this run.
// ---------------------------------------------------------------------------

async function handleRequestApproval(ctx: TaskContext): Promise<TaskHandlerResult> {
  const existingApprovals = await prisma.axiomApprovalRequest.count({
    where: { runId: ctx.agentRunId },
  });

  if (existingApprovals > 0) {
    return {
      status: "completed",
      outputJson: { skipped: true, existingApprovals },
    };
  }

  const plan = await prisma.axiomExecutionPlan.findUnique({
    where: { runId: ctx.agentRunId },
    include: { items: { where: { disposition: "approval_required" } } },
  });

  if (!plan || plan.items.length === 0) {
    return {
      status: "completed",
      outputJson: { approvalItemCount: 0, noApprovalNeeded: true },
    };
  }

  return {
    status: "completed",
    outputJson: {
      approvalItemCount: plan.items.length,
      itemIds: plan.items.map((i) => i.id),
    },
  };
}

// ---------------------------------------------------------------------------
// apply_action — execute approved plan items
//
// Reads inputJson.approvedItemIds to know which items to apply.
// If no items provided, skips.
// ---------------------------------------------------------------------------

async function handleApplyAction(ctx: TaskContext): Promise<TaskHandlerResult> {
  const approvedItemIds = (ctx.inputJson?.approvedItemIds as string[]) ?? [];

  if (approvedItemIds.length === 0) {
    return { status: "skipped", errorMessage: "No approved items to apply." };
  }

  const plan = await prisma.axiomExecutionPlan.findUnique({
    where: { runId: ctx.agentRunId },
    include: { items: true },
  });

  if (!plan) {
    return { status: "failed", errorMessage: "No execution plan found." };
  }

  const approvedSet = new Set(approvedItemIds);
  const itemsToApply = plan.items.filter((i) => approvedSet.has(i.id));

  if (itemsToApply.length === 0) {
    return { status: "skipped", errorMessage: "None of the approved IDs match plan items." };
  }

  const results: Array<{ itemId: string; status: string; message: string }> = [];

  for (const dbItem of itemsToApply) {
    const execItem: ExecutionPlanItem = {
      id: dbItem.id,
      provider: dbItem.provider as ExecutionPlanItem["provider"],
      actionType: dbItem.actionType as ExecutionPlanItem["actionType"],
      resourceIds: dbItem.resourceIds as string[],
      region: dbItem.region,
      currentState: dbItem.currentState,
      recommendedState: dbItem.recommendedState,
      estimatedSavings: { monthly: dbItem.monthlyHigh, yearly: dbItem.yearlyHigh },
      riskLevel: dbItem.riskLevel as ExecutionPlanItem["riskLevel"],
      requiresDowntime: dbItem.actionType === "resize_compute",
      rollbackSteps: [],
    };

    const beforeState =
      execItem.actionType === "resize_compute" || execItem.actionType === "decommission_compute"
        ? captureComputeState(execItem)
        : captureStorageState(execItem);

    let auditEventId: string | null = null;
    try {
      const event = await prisma.axiomAuditEvent.create({
        data: {
          runId: ctx.agentRunId,
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          planItemId: execItem.id,
          provider: execItem.provider as any,
          actionType: execItem.actionType as any,
          resourceIds: execItem.resourceIds,
          region: execItem.region,
          beforeState: beforeState as object,
          riskLevel: execItem.riskLevel as any,
          monthlyLow: execItem.estimatedSavings.monthly,
          monthlyHigh: execItem.estimatedSavings.monthly,
          yearlyLow: execItem.estimatedSavings.yearly,
          yearlyHigh: execItem.estimatedSavings.yearly,
          metadata: { source: "task_queue" },
        },
      });
      auditEventId = event.id;
    } catch {}

    const precheck = runPrechecks(execItem);
    if (!precheck.passed) {
      if (auditEventId) {
        try { await prisma.axiomAuditEvent.update({ where: { id: auditEventId }, data: { status: "precheck_failed", errorMessage: precheck.blockers.join("; ") } }); } catch {}
      }
      results.push({ itemId: execItem.id, status: "failed", message: `Precheck failed: ${precheck.blockers.join("; ")}` });
      continue;
    }

    const handlers = getHandlersForProvider(execItem.provider);
    const handler = handlers[execItem.actionType];
    if (!handler) {
      results.push({ itemId: execItem.id, status: "failed", message: `No handler for ${execItem.actionType}` });
      continue;
    }

    let applyResult: Awaited<ReturnType<typeof handler.apply>>;
    try {
      applyResult = await handler.apply(execItem);
      if (!applyResult.success) {
        if (auditEventId) {
          try { await prisma.axiomAuditEvent.update({ where: { id: auditEventId }, data: { status: "failed", errorMessage: applyResult.message } }); } catch {}
        }
        results.push({ itemId: execItem.id, status: "failed", message: applyResult.message });
        continue;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({ itemId: execItem.id, status: "failed", message: errMsg });
      continue;
    }

    // Never call this a completed mutation if the handler never touched a
    // real cloud SDK — see StepResult["simulated"] in applyEngine.ts.
    const resultStatus = applyResult.simulated ? "simulated" : "applied";

    if (auditEventId) {
      try {
        await prisma.axiomAuditEvent.update({
          where: { id: auditEventId },
          data: { status: resultStatus, afterState: { recommendedState: execItem.recommendedState }, appliedAt: new Date() },
        });
      } catch {}
    }

    results.push({
      itemId: execItem.id,
      status: resultStatus,
      message: applyResult.simulated ? applyResult.message : "Applied successfully.",
    });
  }

  const applied = results.filter((r) => r.status === "applied").length;
  const simulated = results.filter((r) => r.status === "simulated").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return {
    status: failed === results.length ? "failed" : "completed",
    outputJson: { applied, failed, results },
    errorMessage: failed > 0 ? `${failed} of ${results.length} items failed.` : undefined,
  };
}

// ---------------------------------------------------------------------------
// verify_action — confirm applied actions took effect (read-only)
// ---------------------------------------------------------------------------

async function handleVerifyAction(ctx: TaskContext): Promise<TaskHandlerResult> {
  const auditEvents = await prisma.axiomAuditEvent.findMany({
    where: { runId: ctx.agentRunId, status: "applied" },
  });

  if (auditEvents.length === 0) {
    return { status: "skipped", errorMessage: "No applied actions to verify." };
  }

  const plan = await prisma.axiomExecutionPlan.findUnique({
    where: { runId: ctx.agentRunId },
    include: { items: true },
  });

  let verified = 0;
  let unverified = 0;

  for (const event of auditEvents) {
    const dbItem = plan?.items.find((i) => i.id === event.planItemId);
    if (!dbItem) { unverified++; continue; }

    const execItem: ExecutionPlanItem = {
      id: dbItem.id,
      provider: dbItem.provider as ExecutionPlanItem["provider"],
      actionType: dbItem.actionType as ExecutionPlanItem["actionType"],
      resourceIds: dbItem.resourceIds as string[],
      region: dbItem.region,
      currentState: dbItem.currentState,
      recommendedState: dbItem.recommendedState,
      estimatedSavings: { monthly: dbItem.monthlyHigh, yearly: dbItem.yearlyHigh },
      riskLevel: dbItem.riskLevel as ExecutionPlanItem["riskLevel"],
      requiresDowntime: false,
      rollbackSteps: [],
    };

    const verification = verifyAppliedAction(execItem);

    if (verification.verified) {
      verified++;
      try {
        await prisma.axiomAuditEvent.update({
          where: { id: event.id },
          data: { status: "verified", verifiedAt: new Date() },
        });
      } catch {}
    } else {
      unverified++;
    }
  }

  return {
    status: "completed",
    outputJson: { verified, unverified, total: auditEvents.length },
  };
}

// ---------------------------------------------------------------------------
// rollback_action — roll back a failed or unwanted action
//
// Reads inputJson.auditEventId to target a specific action.
// ---------------------------------------------------------------------------

async function handleRollbackAction(ctx: TaskContext): Promise<TaskHandlerResult> {
  const targetEventId = ctx.inputJson?.auditEventId as string | undefined;

  const where = targetEventId
    ? { id: targetEventId }
    : undefined;

  if (!where) {
    return { status: "skipped", errorMessage: "No auditEventId provided for rollback." };
  }

  const event = await prisma.axiomAuditEvent.findUnique({ where });
  if (!event) {
    return { status: "failed", errorMessage: "Audit event not found." };
  }

  if (event.status === "rolled_back") {
    return { status: "completed", outputJson: { skipped: true, alreadyRolledBack: true } };
  }

  try {
    await prisma.axiomAuditEvent.update({
      where: { id: event.id },
      data: { status: "rolled_back", rolledBackAt: new Date() },
    });
  } catch {}

  return {
    status: "completed",
    outputJson: { auditEventId: event.id, rolledBack: true },
  };
}

// ---------------------------------------------------------------------------
// schedule_next_scan — create or advance the scheduled run record
// ---------------------------------------------------------------------------

async function handleScheduleNextScan(ctx: TaskContext): Promise<TaskHandlerResult> {
  const frequency = (ctx.inputJson?.frequency as string) ?? "weekly";
  const delayDays = frequency === "daily" ? 1 : 7;
  const nextRunAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);

  const existing = await prisma.axiomScheduledRun.findFirst({
    where: { cloudAccountId: ctx.cloudAccountId, enabled: true },
  });

  if (existing) {
    await prisma.axiomScheduledRun.update({
      where: { id: existing.id },
      data: { nextRunAt, lastRunId: ctx.agentRunId },
    });
    return {
      status: "completed",
      outputJson: { scheduledRunId: existing.id, nextRunAt: nextRunAt.toISOString(), updated: true },
    };
  }

  const cronExpression = frequency === "daily" ? "0 9 * * *" : "0 9 * * 1";

  const schedule = await prisma.axiomScheduledRun.create({
    data: {
      organizationId: ctx.organizationId,
      cloudAccountId: ctx.cloudAccountId,
      frequency: frequency as any,
      cronExpression,
      nextRunAt,
      lastRunId: ctx.agentRunId,
    },
  });

  return {
    status: "completed",
    outputJson: { scheduledRunId: schedule.id, nextRunAt: nextRunAt.toISOString(), created: true },
  };
}

// ---------------------------------------------------------------------------
// Terraform / CLI / JSON export helpers
// ---------------------------------------------------------------------------

function toTerraformBlock(item: {
  actionType: string;
  provider: string;
  region: string;
  resourceIds: unknown;
  currentState: string;
  recommendedState: string;
}): string {
  const ids = (item.resourceIds as string[]).join(", ");
  const lines = [
    `# ${item.actionType} — ${item.provider} ${item.region}`,
    `# Resources: ${ids}`,
    `# Current: ${item.currentState}`,
    `# Recommended: ${item.recommendedState}`,
  ];

  if (item.actionType === "resize_compute") {
    lines.push(`resource "aws_instance" "resize" {`);
    lines.push(`  instance_type = "${item.recommendedState}"`);
    lines.push(`  # Apply to: ${ids}`);
    lines.push(`}`);
  } else if (item.actionType === "apply_storage_policy") {
    lines.push(`resource "aws_s3_bucket_lifecycle_configuration" "tiering" {`);
    lines.push(`  bucket = "${(item.resourceIds as string[])[0] ?? "BUCKET_NAME"}"`);
    lines.push(`  rule {`);
    lines.push(`    id     = "axiom-lifecycle"`);
    lines.push(`    status = "Enabled"`);
    lines.push(`    transition {`);
    lines.push(`      days          = 30`);
    lines.push(`      storage_class = "STANDARD_IA"`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
  } else {
    lines.push(`# Manual action required for ${item.actionType}`);
  }

  return lines.join("\n");
}

function toCliCommand(item: {
  actionType: string;
  provider: string;
  region: string;
  resourceIds: unknown;
  recommendedState: string;
}): string {
  const ids = item.resourceIds as string[];
  if (item.actionType === "resize_compute" && item.provider === "aws") {
    return ids
      .map((id) => `aws ec2 modify-instance-attribute --instance-id ${id} --instance-type '{"Value":"${item.recommendedState}"}' --region ${item.region}`)
      .join("\n");
  }
  if (item.actionType === "apply_storage_policy" && item.provider === "aws") {
    return ids
      .map((id) => `aws s3api put-bucket-lifecycle-configuration --bucket ${id} --lifecycle-configuration file://axiom-lifecycle.json --region ${item.region}`)
      .join("\n");
  }
  return `# ${item.actionType}: manual action required for ${ids.join(", ")}`;
}

function itemToJson(item: {
  actionType: string;
  provider: string;
  region: string;
  resourceIds: unknown;
  currentState: string;
  recommendedState: string;
  riskLevel: string;
  disposition: string;
  monthlyHigh: number;
  yearlyHigh: number;
}): Record<string, unknown> {
  return {
    actionType: item.actionType,
    provider: item.provider,
    region: item.region,
    resourceIds: item.resourceIds,
    currentState: item.currentState,
    recommendedState: item.recommendedState,
    riskLevel: item.riskLevel,
    disposition: item.disposition,
    estimatedSavings: { monthly: item.monthlyHigh, yearly: item.yearlyHigh },
  };
}
