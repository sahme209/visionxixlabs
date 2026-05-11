import { prisma } from "@/lib/db";
import type { CloudSnapshot, ComputeResource } from "../cloudSnapshot";
import { deriveCostSignals, computeConfidence } from "../costSignals";
import type { CostSignal } from "../costSignals";
import { generateExecutionPlan } from "../executionPlan";
import type { ExecutionPlanItem } from "../executionPlan";
import { simulateDryRun } from "../dryRunSimulator";
import { runAllPrechecks, runPrechecks } from "../precheckSystem";
import { generateAllRollbackPlans, captureComputeState, captureStorageState } from "../rollbackPlanner";
import { getHandlersForProvider } from "../applyEngine";
import { verifyAppliedAction } from "../verificationEngine";
import type { SavingsEstimate } from "../enums";

import type {
  RunAgentInput,
  ApprovalInput,
  AgentRunResult,
  AgentRunStatus,
  AgentFinding,
  AgentRecommendation,
  AgentActionPlan,
  AgentApplyResult,
  AgentMessage,
  ActionDisposition,
} from "./types";

import { generateSnapshot } from "./providerRegistry";
import { classifyDisposition, findingToRecommendation, priorityScore, findingToRecommendationWithPrefs, priorityScoreWithPrefs } from "./prioritizer";
import { loadPreferences, filterIgnoredFindings, type OrgPreferences } from "./preferences";
import { loadAutopilotMode, resolvePolicy, applyAutopilotToRecommendations, logAutopilotAction } from "./autopilot";
import { createApprovalItems } from "../approvalCenter";
import type { AutopilotMode } from "./autopilot";
import * as msg from "./messageBuilder";
import { detectDrift } from "./driftEngine";
import type { DriftReport, DriftItem } from "./driftEngine";
import { recordScanOutcome, recordActionOutcomes, loadOutcomeHistory, hasResourceFailureHistory } from "./outcomeMemory";
import type { OutcomeHistory } from "./outcomeMemory";

// ---------------------------------------------------------------------------
// runAgent — 10-step orchestrator
// ---------------------------------------------------------------------------

export async function runAgent(input: RunAgentInput): Promise<AgentRunResult> {
  const {
    organizationId,
    userId,
    connectedAccountId,
    provider,
    trigger = "manual",
    onMessage,
  } = input;
  const emit = onMessage ?? (() => {});

  // ── Step 1: Create AgentRun record ──────────────────────────────────────

  const run = await prisma.axiomAgentRun.create({
    data: {
      userId,
      organizationId,
      cloudAccountId: connectedAccountId,
      trigger,
      status: "pending",
    },
  });
  const runId = run.id;

  try {
    // ── Step 2: Load cloud connector ────────────────────────────────────

    const account = await prisma.cloudAccount.findUnique({
      where: { id: connectedAccountId },
    });

    if (!account) {
      return failRun(runId, emit, "Cloud account not found. Connect your account in Settings → Cloud Accounts.");
    }
    if (!account.enabled) {
      return failRun(runId, emit, "Cloud account is disabled. Re-enable it in Settings → Cloud Accounts.");
    }
    if (account.organizationId !== organizationId) {
      return failRun(runId, emit, "Cloud account does not belong to this organization.");
    }

    await setStatus(runId, "running");
    emit(msg.scanStarted(provider, account.externalAccountId));

    // ── Step 2b: Load organization preferences + autopilot mode ─────────

    const prefs = await loadPreferences(organizationId);
    const autopilotMode = await loadAutopilotMode(connectedAccountId);
    const autopilotPolicy = resolvePolicy(autopilotMode);
    const outcomeHistory = await loadOutcomeHistory(organizationId, connectedAccountId);

    // ── Step 3: Generate cloud snapshot ─────────────────────────────────

    const credentialRef = account.credentialRef ?? account.id;
    const snapshot = await generateSnapshot(provider, userId, credentialRef);

    await prisma.axiomAgentRun.update({
      where: { id: runId },
      data: { snapshotData: snapshot as object, startedAt: new Date() },
    });
    await prisma.cloudAccount.update({
      where: { id: account.id },
      data: { lastScannedAt: new Date() },
    });

    emit(msg.scanComplete(provider, snapshot.resources.length, snapshot.regions.length));

    // ── Step 3b: Drift detection — compare against previous snapshot ────

    const previousRun = await prisma.axiomAgentRun.findFirst({
      where: {
        cloudAccountId: connectedAccountId,
        status: "completed",
        id: { not: runId },
      },
      orderBy: { completedAt: "desc" },
      select: { id: true, snapshotData: true },
    });

    let driftReport: DriftReport | null = null;
    const driftFindings: AgentFinding[] = [];

    if (previousRun?.snapshotData) {
      const previousSnapshot = previousRun.snapshotData as unknown as CloudSnapshot;
      driftReport = detectDrift({
        organizationId,
        cloudAccountId: connectedAccountId,
        currentSnapshot: snapshot,
        previousSnapshot,
      });

      if (driftReport.items.length > 0) {
        emit(msg.driftDetected(driftReport));

        const driftDbFindings = await prisma.$transaction(
          driftReport.items.map((driftItem) => {
            const finding = driftItemToFinding(driftItem, snapshot);
            return prisma.axiomFinding.create({
              data: {
                runId,
                category: finding.category,
                severity: finding.severity,
                title: finding.title,
                description: finding.description,
                affectedResources: finding.affectedResources,
                region: finding.region,
                provider: finding.provider as any,
                confidence: finding.confidence,
                monthlyLow: driftItem.impact.costImpactMonthly ?? 0,
                monthlyHigh: driftItem.impact.costImpactMonthly ?? 0,
                yearlyLow: (driftItem.impact.costImpactMonthly ?? 0) * 12,
                yearlyHigh: (driftItem.impact.costImpactMonthly ?? 0) * 12,
                data: finding.data as object,
              },
            });
          }),
        );

        for (let i = 0; i < driftReport.items.length; i++) {
          driftFindings.push({
            ...driftItemToFinding(driftReport.items[i], snapshot),
            id: driftDbFindings[i].id,
          });
        }

        await auditEvent(runId, organizationId, userId, "drift_detected", {
          provider,
          totalDrifts: driftReport.summary.totalDrifts,
          highestSeverity: driftReport.summary.highestSeverity,
          requiresAction: driftReport.summary.requiresAction,
        });
      }
    }

    // ── Step 4: Run signal engine ───────────────────────────────────────

    const costSummary = deriveCostSignals(snapshot);

    if (costSummary.signals.length === 0 && driftFindings.length === 0) {
      emit(msg.noActionNeeded());
      return completeRun(runId, provider, "No issues found. Your infrastructure is well-optimized.");
    }

    // ── Step 5: Convert signals into agent findings ─────────────────────

    const domainFindings = signalsToFindings(costSummary.signals, snapshot);
    const dbFindings = await prisma.$transaction(
      domainFindings.map((f, i) => {
        const signal = costSummary.signals[i];
        return prisma.axiomFinding.create({
          data: {
            runId,
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

    // Use DB IDs for downstream linkage, then filter out ignored findings
    const allFindings: AgentFinding[] = domainFindings.map((f, i) => ({
      ...f,
      id: dbFindings[i].id,
    }));
    const findings = [...filterIgnoredFindings(allFindings, prefs), ...driftFindings];

    // ── Step 6: Prioritize findings (preference-aware) ─────────────────

    findings.sort((a, b) => priorityScoreWithPrefs(b, 0, prefs) - priorityScoreWithPrefs(a, 0, prefs));

    // ── Step 7: Generate recommendations ────────────────────────────────

    const executionPlan = generateExecutionPlan(snapshot);
    const computeResources = snapshot.resources.filter(
      (r) => r.resourceType === "compute",
    ) as ComputeResource[];
    const confidence = computeConfidence(!!snapshot.monthlySpend, computeResources);

    const rawRecs = findings.map((f, i) => {
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

    // ── Step 7b: Outcome-aware safety gate ──────────────────────────────
    //    Downgrade auto-fix → approval_required for resources with prior failures
    const outcomeAdjustedRecs = rawRecs.map((rec) => {
      if (rec.disposition !== "auto_fix_candidate" || !rec.actionType) return rec;
      const finding = findings.find((f) => f.id === rec.findingId);
      if (!finding) return rec;
      const hasPriorFailure = finding.affectedResources.some((rid) =>
        hasResourceFailureHistory(outcomeHistory, rid, rec.actionType!),
      );
      if (hasPriorFailure) {
        return {
          ...rec,
          disposition: "approval_required" as ActionDisposition,
          dispositionReason: `Downgraded from auto-fix: prior failure recorded for this resource and action type.`,
        };
      }
      return rec;
    });

    // ── Step 7c: Apply autopilot gate to recommendations ───────────────
    const domainRecs = autopilotPolicy.canGeneratePlan
      ? applyAutopilotToRecommendations(outcomeAdjustedRecs, autopilotMode)
      : outcomeAdjustedRecs.map((r) => ({ ...r, disposition: "report_only" as ActionDisposition, actionable: false, autopilotDecision: undefined }));

    const dbRecs = await prisma.$transaction(
      domainRecs.map((rec, i) =>
        prisma.axiomRecommendation.create({
          data: {
            runId,
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

    const recommendations: AgentRecommendation[] = domainRecs.map((rec, i) => ({
      ...rec,
      id: dbRecs[i].id,
    }));

    // ── Step 8: Build execution plan + create approval items ────────────
    //    Skipped entirely in observe_only mode (no plans generated)

    if (!autopilotPolicy.canGeneratePlan) {
      const summaryMsg = msg.findingsSummary(findings, recommendations, executionPlan.totalEstimatedSavings, null);
      emit(summaryMsg);

      await prisma.axiomAgentRun.update({
        where: { id: runId },
        data: { status: "completed", summary: summaryMsg.body, completedAt: new Date() },
      });

      const savingsIdentified: SavingsEstimate = {
        monthlyLow: costSummary.totalAnnualSavings.low / 12,
        monthlyHigh: costSummary.totalAnnualSavings.high / 12,
        yearlyLow: costSummary.totalAnnualSavings.low,
        yearlyHigh: costSummary.totalAnnualSavings.high,
      };

      return {
        runId,
        status: "completed",
        provider,
        findingCount: findings.length,
        driftCount: driftFindings.length,
        recommendationCount: recommendations.length,
        autoFixCount: 0,
        approvalRequiredCount: 0,
        reportOnlyCount: recommendations.length,
        savingsIdentified,
        nextAction: "Switch to Recommend mode to generate action plans.",
        summary: summaryMsg.body,
        error: null,
      };
    }

    const dryRun = simulateDryRun(executionPlan);
    const prechecks = runAllPrechecks(executionPlan.items);
    const rollbackPlans = generateAllRollbackPlans(executionPlan.items);
    const actionPlan = classifyActions(executionPlan, dryRun, prechecks, rollbackPlans, recommendations);

    if (executionPlan.items.length > 0) {
      const dbPlan = await prisma.axiomExecutionPlan.create({
        data: {
          runId,
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
          const disposition = rec?.disposition ?? "approval_required";
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

      // ── Step 8b: Create per-item approval tracking ─────────────────────
      try {
        await createApprovalItems(runId);
      } catch {
        // Non-critical — approval items can be created later via the API
      }
    }

    // ── Step 9: Save results and finalize ───────────────────────────────

    const autoFixCount = recommendations.filter((r) => r.disposition === "auto_fix_candidate").length;
    const approvalRequiredCount = recommendations.filter((r) => r.disposition === "approval_required").length;
    const reportOnlyCount = recommendations.filter((r) => r.disposition === "report_only").length;
    const nextAction = deriveNextAction(actionPlan, recommendations);

    const summaryMsg = msg.findingsSummary(
      findings,
      recommendations,
      executionPlan.totalEstimatedSavings,
      nextAction,
    );
    emit(summaryMsg);

    if (autoFixCount > 0 || approvalRequiredCount > 0) {
      emit(msg.approvalRequest(actionPlan, provider));
    }

    await prisma.axiomAgentRun.update({
      where: { id: runId },
      data: { status: "completed", summary: summaryMsg.body, completedAt: new Date() },
    });

    await auditEvent(runId, organizationId, userId, "agent_run_completed", {
      provider,
      findingCount: findings.length,
      autoFixCount,
      approvalRequiredCount,
      reportOnlyCount,
    });

    // ── Step 9b: Record scan outcome for future memory ─────────────────

    const savingsIdentified: SavingsEstimate = {
      monthlyLow: costSummary.totalAnnualSavings.low / 12,
      monthlyHigh: costSummary.totalAnnualSavings.high / 12,
      yearlyLow: costSummary.totalAnnualSavings.low,
      yearlyHigh: costSummary.totalAnnualSavings.high,
    };

    await recordScanOutcome({
      organizationId,
      cloudAccountId: connectedAccountId,
      runId,
      findingCount: findings.length,
      driftCount: driftFindings.length,
      savingsIdentified: { monthly: savingsIdentified.monthlyHigh, yearly: savingsIdentified.yearlyHigh },
    });

    // ── Step 10: Return user-facing summary ─────────────────────────────

    return {
      runId,
      status: "completed",
      provider,
      findingCount: findings.length,
      driftCount: driftFindings.length,
      recommendationCount: recommendations.length,
      autoFixCount,
      approvalRequiredCount,
      reportOnlyCount,
      savingsIdentified,
      nextAction,
      summary: summaryMsg.body,
      error: null,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return failRun(runId, emit, errMsg);
  }
}

// ---------------------------------------------------------------------------
// handleApproval — apply approved execution plan items
// ---------------------------------------------------------------------------

export async function handleApproval(input: ApprovalInput): Promise<AgentRunResult> {
  const { runId, userId, decision, approvedItemIds, rejectedItemIds, note, onMessage } = input;
  const emit = onMessage ?? (() => {});

  const run = await prisma.axiomAgentRun.findUniqueOrThrow({
    where: { id: runId },
    include: { executionPlan: { include: { items: true } } },
  });

  // Record the approval decision
  await prisma.axiomApprovalRequest.create({
    data: {
      runId,
      userId,
      decision: decision as any,
      approvedItemIds: approvedItemIds,
      rejectedItemIds: rejectedItemIds ?? [],
      note,
    },
  });

  if (decision === "reject_all" || approvedItemIds.length === 0) {
    await setStatus(runId, "completed");
    await auditEvent(runId, run.organizationId, userId, "approval_rejected", { decision });
    return loadRunResult(runId, run.cloudAccountId);
  }

  // Load approved plan items from DB
  const allItems = run.executionPlan?.items ?? [];
  const approvedSet = new Set(approvedItemIds);
  const approvedDbItems = allItems.filter((item) => approvedSet.has(item.id));

  if (approvedDbItems.length === 0) {
    await setStatus(runId, "completed");
    return loadRunResult(runId, run.cloudAccountId);
  }

  await setStatus(runId, "running");
  emit(msg.applyStarted(approvedDbItems.length));

  const results: AgentApplyResult[] = [];
  let realizedMonthlyHigh = 0;
  let anyFailed = false;

  for (const dbItem of approvedDbItems) {
    const execItem = dbItemToExecItem(dbItem);
    const result = await applyAndVerify(execItem, userId, run.organizationId, runId);
    results.push(result);

    if (result.status === "verified" || result.status === "applied") {
      realizedMonthlyHigh += dbItem.monthlyHigh;
    }
    if (result.status === "failed") {
      anyFailed = true;
      break;
    }
  }

  const savingsRealized: SavingsEstimate = {
    monthlyLow: realizedMonthlyHigh * 0.8,
    monthlyHigh: realizedMonthlyHigh,
    yearlyLow: realizedMonthlyHigh * 0.8 * 12,
    yearlyHigh: realizedMonthlyHigh * 12,
  };

  const verified = results.filter((r) => r.status === "verified" || r.status === "applied").length;
  const finalStatus: AgentRunStatus =
    anyFailed && verified > 0
      ? "partially_completed"
      : anyFailed
        ? "failed"
        : "completed";

  emit(msg.applyComplete(results, { monthly: savingsRealized.monthlyHigh, yearly: savingsRealized.yearlyHigh }));

  await prisma.axiomAgentRun.update({
    where: { id: runId },
    data: { status: finalStatus, completedAt: new Date() },
  });

  await auditEvent(runId, run.organizationId, userId, "approval_applied", {
    decision,
    appliedCount: verified,
    failedCount: results.filter((r) => r.status === "failed").length,
  });

  await recordActionOutcomes({
    organizationId: run.organizationId,
    cloudAccountId: run.cloudAccountId,
    runId,
    actions: results.map((r, i) => ({
      actionType: approvedDbItems[i].actionType,
      resourceIds: (approvedDbItems[i].resourceIds as string[]) ?? [],
      status: r.status,
      savingsRealized: r.status === "verified" || r.status === "applied" ? approvedDbItems[i].monthlyHigh : 0,
      failureReason: r.status === "failed" ? r.message : undefined,
    })),
  });

  return loadRunResult(runId, run.cloudAccountId);
}

// ---------------------------------------------------------------------------
// Single item apply + verify with audit event
// ---------------------------------------------------------------------------

async function applyAndVerify(
  item: ExecutionPlanItem,
  userId: string,
  organizationId: string,
  runId: string,
): Promise<AgentApplyResult> {
  const beforeState =
    item.actionType === "resize_compute" || item.actionType === "decommission_compute"
      ? captureComputeState(item)
      : captureStorageState(item);

  // Create audit event before applying
  let auditEventId: string | null = null;
  try {
    const event = await prisma.axiomAuditEvent.create({
      data: {
        runId,
        userId,
        organizationId,
        planItemId: item.id,
        provider: item.provider as any,
        actionType: item.actionType as any,
        resourceIds: item.resourceIds,
        region: item.region,
        beforeState: beforeState as object,
        riskLevel: item.riskLevel as any,
        monthlyLow: item.estimatedSavings.monthly,
        monthlyHigh: item.estimatedSavings.monthly,
        yearlyLow: item.estimatedSavings.yearly,
        yearlyHigh: item.estimatedSavings.yearly,
        metadata: { source: "agent" },
      },
    });
    auditEventId = event.id;
  } catch {
    // Audit write failure should not block apply
  }

  // Precheck
  const precheck = runPrechecks(item);
  if (!precheck.passed) {
    await updateAuditStatus(auditEventId, "precheck_failed", precheck.blockers.join("; "));
    return {
      itemId: item.id,
      status: "failed",
      message: `Precheck failed: ${precheck.blockers.join("; ")}`,
      auditEventId,
    };
  }

  // Apply
  const handlers = getHandlersForProvider(item.provider);
  const handler = handlers[item.actionType];
  if (!handler) {
    await updateAuditStatus(auditEventId, "failed", `No handler for ${item.actionType}`);
    return { itemId: item.id, status: "failed", message: `No handler for ${item.actionType}`, auditEventId };
  }

  try {
    const applyResult = await handler.apply(item);
    if (!applyResult.success) {
      await updateAuditStatus(auditEventId, "failed", applyResult.message);
      return { itemId: item.id, status: "failed", message: applyResult.message, auditEventId };
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await updateAuditStatus(auditEventId, "failed", errMsg);
    return { itemId: item.id, status: "failed", message: errMsg, auditEventId };
  }

  // Mark applied
  if (auditEventId) {
    try {
      await prisma.axiomAuditEvent.update({
        where: { id: auditEventId },
        data: {
          status: "applied",
          afterState: { recommendedState: item.recommendedState },
          appliedAt: new Date(),
        },
      });
    } catch {}
  }

  // Verify
  const verification = verifyAppliedAction(item);
  if (verification.verified && auditEventId) {
    try {
      await prisma.axiomAuditEvent.update({
        where: { id: auditEventId },
        data: { status: "verified", verifiedAt: new Date() },
      });
    } catch {}
  }

  return {
    itemId: item.id,
    status: verification.verified ? "verified" : "applied",
    message: verification.verified ? "Applied and verified" : "Applied but verification incomplete",
    auditEventId,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function signalsToFindings(signals: CostSignal[], snapshot: CloudSnapshot): AgentFinding[] {
  return signals.map((signal, i) => {
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
}

function classifyActions(
  executionPlan: ReturnType<typeof generateExecutionPlan>,
  dryRun: ReturnType<typeof simulateDryRun>,
  prechecks: ReturnType<typeof runAllPrechecks>,
  rollbackPlans: ReturnType<typeof generateAllRollbackPlans>,
  recommendations: AgentRecommendation[],
): AgentActionPlan {
  const autoFixCandidates: ExecutionPlanItem[] = [];
  const approvalRequired: ExecutionPlanItem[] = [];
  const reportOnly: ExecutionPlanItem[] = [];

  for (const item of executionPlan.items) {
    const rec = recommendations.find((r) => r.actionType === item.actionType);
    const disposition: ActionDisposition = rec?.disposition ?? "approval_required";

    switch (disposition) {
      case "auto_fix_candidate":
        autoFixCandidates.push(item);
        break;
      case "approval_required":
        approvalRequired.push(item);
        break;
      case "report_only":
      case "blocked":
        reportOnly.push(item);
        break;
    }
  }

  return { executionPlan, dryRun, prechecks, rollbackPlans, autoFixCandidates, approvalRequired, reportOnly };
}

function deriveNextAction(plan: AgentActionPlan, recommendations: AgentRecommendation[]): string | null {
  if (plan.autoFixCandidates.length > 0) {
    const savings = plan.autoFixCandidates.reduce((s, i) => s + i.estimatedSavings.monthly, 0);
    return `Apply ${plan.autoFixCandidates.length} safe fix${plan.autoFixCandidates.length === 1 ? "" : "es"} to save $${savings}/mo.`;
  }

  if (plan.approvalRequired.length > 0) {
    const top = plan.approvalRequired[0];
    const rec = recommendations.find((r) => r.actionType === top.actionType);
    return rec
      ? `Review and approve: ${rec.title}`
      : `Review ${plan.approvalRequired.length} action${plan.approvalRequired.length === 1 ? "" : "s"} awaiting approval.`;
  }

  if (plan.reportOnly.length > 0) {
    return `Review ${plan.reportOnly.length} item${plan.reportOnly.length === 1 ? "" : "s"} that need manual assessment.`;
  }

  return null;
}

function dbItemToExecItem(dbItem: {
  id: string;
  provider: string;
  actionType: string;
  resourceIds: unknown;
  region: string;
  currentState: string;
  recommendedState: string;
  riskLevel: string;
  monthlyHigh: number;
  yearlyHigh: number;
}): ExecutionPlanItem {
  return {
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
}

function driftItemToFinding(item: DriftItem, snapshot: CloudSnapshot): AgentFinding {
  const categoryMap: Record<string, AgentFinding["category"]> = {
    config_mutation: "security",
    security_regression: "security",
    resilience_regression: "resilience",
    cost_deviation: "cost",
    resource_lifecycle: "security",
    compliance_violation: "compliance",
    plan_drift: "compliance",
  };

  return {
    id: item.id,
    category: categoryMap[item.category] ?? "security",
    severity: item.severity as AgentFinding["severity"],
    title: `[Drift] ${item.title}`,
    description: item.description,
    affectedResources: [item.resourceId],
    region: item.region,
    provider: snapshot.provider,
    confidence: "high",
    estimatedSavings: item.impact.costImpactMonthly
      ? { monthly: item.impact.costImpactMonthly, yearly: item.impact.costImpactMonthly * 12 }
      : null,
    data: {
      driftCategory: item.category,
      driftSource: item.source,
      fieldChanges: item.fieldChanges,
      impact: item.impact,
      remediation: item.remediation,
    },
  };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function setStatus(runId: string, status: AgentRunStatus): Promise<void> {
  await prisma.axiomAgentRun.update({ where: { id: runId }, data: { status } });
}

async function updateAuditStatus(
  auditEventId: string | null,
  status: string,
  errorMessage?: string,
): Promise<void> {
  if (!auditEventId) return;
  try {
    await prisma.axiomAuditEvent.update({
      where: { id: auditEventId },
      data: { status: status as any, errorMessage },
    });
  } catch {}
}

async function auditEvent(
  runId: string,
  organizationId: string,
  userId: string,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { action, actor: "system", metadata: { runId, organizationId, userId, ...metadata } },
    });
  } catch {}
}

async function failRun(
  runId: string,
  emit: (m: AgentMessage) => void,
  errorMessage: string,
): Promise<AgentRunResult> {
  emit(msg.agentError(errorMessage));
  await prisma.axiomAgentRun.update({
    where: { id: runId },
    data: { status: "failed", errorMessage, completedAt: new Date() },
  });
  return {
    runId,
    status: "failed",
    provider: "",
    findingCount: 0,
    driftCount: 0,
    recommendationCount: 0,
    autoFixCount: 0,
    approvalRequiredCount: 0,
    reportOnlyCount: 0,
    savingsIdentified: { monthlyLow: 0, monthlyHigh: 0, yearlyLow: 0, yearlyHigh: 0 },
    nextAction: null,
    summary: "",
    error: errorMessage,
  };
}

async function completeRun(
  runId: string,
  provider: string,
  summary: string,
): Promise<AgentRunResult> {
  await prisma.axiomAgentRun.update({
    where: { id: runId },
    data: { status: "completed", summary, completedAt: new Date() },
  });
  return {
    runId,
    status: "completed",
    provider,
    findingCount: 0,
    driftCount: 0,
    recommendationCount: 0,
    autoFixCount: 0,
    approvalRequiredCount: 0,
    reportOnlyCount: 0,
    savingsIdentified: { monthlyLow: 0, monthlyHigh: 0, yearlyLow: 0, yearlyHigh: 0 },
    nextAction: null,
    summary,
    error: null,
  };
}

async function loadRunResult(runId: string, cloudAccountId: string): Promise<AgentRunResult> {
  const run = await prisma.axiomAgentRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      findings: true,
      recommendations: true,
      executionPlan: { include: { items: true } },
    },
  });

  const autoFixCount = run.recommendations.filter((r) => r.disposition === "auto_fix_candidate").length;
  const approvalRequiredCount = run.recommendations.filter((r) => r.disposition === "approval_required").length;
  const reportOnlyCount = run.recommendations.filter((r) => r.disposition === "report_only").length;
  const driftCount = run.findings.filter((f) => {
    const data = f.data as Record<string, unknown> | null;
    return data?.driftCategory != null;
  }).length;

  const account = await prisma.cloudAccount.findUnique({ where: { id: cloudAccountId } });
  const provider = account?.provider ?? "aws";

  const totalMonthlyLow = run.findings.reduce((s, f) => s + f.monthlyLow, 0);
  const totalMonthlyHigh = run.findings.reduce((s, f) => s + f.monthlyHigh, 0);
  const totalYearlyLow = run.findings.reduce((s, f) => s + f.yearlyLow, 0);
  const totalYearlyHigh = run.findings.reduce((s, f) => s + f.yearlyHigh, 0);

  return {
    runId: run.id,
    status: run.status as AgentRunStatus,
    provider: provider as string,
    findingCount: run.findings.length,
    driftCount,
    recommendationCount: run.recommendations.length,
    autoFixCount,
    approvalRequiredCount,
    reportOnlyCount,
    savingsIdentified: {
      monthlyLow: totalMonthlyLow,
      monthlyHigh: totalMonthlyHigh,
      yearlyLow: totalYearlyLow,
      yearlyHigh: totalYearlyHigh,
    },
    nextAction: null,
    summary: run.summary ?? "",
    error: run.errorMessage,
  };
}
