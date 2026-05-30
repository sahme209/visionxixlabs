/**
 * Persist a completed cloud scan to the canonical tables.
 *
 * Until this helper, /api/aws/scan returned live findings in the
 * response body and let them evaporate — the AxiomAgentRun and
 * AxiomFinding tables only ever filled up when an agent loop ran,
 * never from a direct scan. As a result the dashboard showed
 * 'Connected accounts' but the findings views were always empty,
 * which made the platform feel like a mock even after a real AWS
 * connection.
 *
 * This module wraps every successful scan in:
 *   1. CloudAccount upsert (organizationId + provider + externalAccountId)
 *   2. AxiomAgentRun row with status=completed and snapshotData
 *   3. AxiomFinding rows for every preview finding
 *   4. CloudAccount.lastScannedAt update
 *
 * Failures here are warn-only: the scan response is unchanged so the
 * caller still sees their findings, but the next read from the
 * canonical tables will be empty. This is the same degradation
 * pattern used by other bridges in the codebase.
 */

import { prisma } from "@/lib/db";
import type { PreviewFinding, PreviewRecommendation } from "@/lib/cloud/aws/awsPreviewScanner";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import { notifyScanComplete } from "@/lib/notifications/scanCompleteNotifier";

type Severity = "info" | "low" | "medium" | "high" | "critical";
type Category = "cost" | "resilience" | "security" | "performance" | "compliance";
type Provider = "aws" | "azure" | "gcp";

interface PersistInput {
  organizationId: OrganizationId;
  userId: UserId;
  provider: Provider;
  /** AWS account id, Azure subscription id, or GCP project id — what CloudAccount.externalAccountId expects. */
  externalAccountId: string;
  /** Region used as a default tag for findings that don't carry one. */
  region: string;
  trigger?: "manual" | "scheduled" | "drift" | "onboarding" | "webhook";
  snapshot: unknown;
  findings: ReadonlyArray<PreviewFinding>;
  /** Optional recommendations — when present, persisted alongside findings
   *  via AxiomRecommendation (and actionable ones flow into AxiomApprovalItem). */
  recommendations?: ReadonlyArray<PreviewRecommendation>;
  /** Optional summary surfaced on the AxiomAgentRun row for quick reads. */
  summary?: string;
  /** Honest source tag from the scanner — only "live"/"partial" runs
   *  persist findings. "preview" and "demo" runs are skipped so the
   *  canonical tables don't accumulate non-real signal. Accepts the
   *  full DataSource union so callers can pass through outcome.source
   *  without a narrowing dance. */
  source: "live" | "partial" | "preview" | "demo" | "synthetic" | "unknown";
}

interface PersistOutcome {
  runId: string;
  cloudAccountId: string;
  findingCount: number;
  recommendationCount: number;
}

/** Infer a category from a rule code so dashboard filters work. */
function inferCategory(ruleCode: string | undefined | null): Category {
  const code = (ruleCode ?? "").toLowerCase();
  if (/cost|rightsiz|idle|underutiliz|waste/.test(code)) return "cost";
  if (/backup|replica|failover|az_redund|resilien|recovery/.test(code)) return "resilience";
  if (/perf|latency|slow_query/.test(code)) return "performance";
  if (/compli|cis|nist|pci|hipaa|sox/.test(code)) return "compliance";
  return "security";
}

function clampSeverity(input: string | undefined | null): Severity {
  const s = (input ?? "").toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low" || s === "info") return s;
  return "info";
}

type ActionDispositionEnum = "auto_fix_candidate" | "approval_required" | "informational";
type RiskLevelEnum = "low" | "medium" | "high";

/** Translate a scanner action class into a disposition that maps to the
 *  ActionDisposition Prisma enum. Auto-fix candidates can be applied
 *  without a human gate (e.g. delete-empty-bucket). Approval-required
 *  recommendations enter the approval queue. */
function dispositionFor(actionClass: string): ActionDispositionEnum {
  switch (actionClass) {
    case "cost_optimization":
    case "scaling":
      return "auto_fix_candidate";
    case "security_remediation":
    case "iam_modification":
      return "approval_required";
    case "drift_correction":
      return "approval_required";
    default:
      return "informational";
  }
}

function riskFor(actionClass: string): RiskLevelEnum {
  switch (actionClass) {
    case "security_remediation":
    case "iam_modification":
      return "high";
    case "drift_correction":
      return "medium";
    case "cost_optimization":
    case "scaling":
    default:
      return "low";
  }
}

type ActionTypeEnum = "resize_compute" | "apply_storage_policy" | "purchase_commitment" | "decommission_compute";

/** Map the scanner's actionClass to the Prisma ActionType enum so the
 *  downstream Terraform plan renderer picks the right resource block.
 *  The mapping is intentionally narrow — when a class has no obvious
 *  Terraform analogue we fall through to apply_storage_policy and let
 *  the renderer print a 'review manually' comment. */
function actionTypeFor(actionClass: string, recommendedState: string): ActionTypeEnum {
  switch (actionClass) {
    case "cost_optimization":
      // Resize is the common case; if the recommended state literally
      // says 'decommission' the renderer needs to surface a destroy plan.
      return /decommission|delete|remove/i.test(recommendedState)
        ? "decommission_compute"
        : "resize_compute";
    case "scaling":
      return "resize_compute";
    case "security_remediation":
    case "iam_modification":
    case "drift_correction":
    default:
      return "apply_storage_policy";
  }
}

export async function persistScanRun(input: PersistInput): Promise<PersistOutcome | null> {
  // Only persist real / live findings. preview / demo / synthetic /
  // unknown sources are skipped so the canonical tables don't accumulate
  // non-real signal on the dashboard.
  if (
    input.source === "preview" ||
    input.source === "demo" ||
    input.source === "synthetic" ||
    input.source === "unknown"
  ) {
    return null;
  }

  try {
    const cloudAccount = await prisma.cloudAccount.upsert({
      where: {
        organizationId_provider_externalAccountId: {
          organizationId: input.organizationId,
          provider: input.provider,
          externalAccountId: input.externalAccountId,
        },
      },
      update: {
        regions: { set: [input.region] },
        lastScannedAt: new Date(),
      },
      create: {
        organizationId: input.organizationId,
        provider: input.provider,
        externalAccountId: input.externalAccountId,
        regions: [input.region],
        lastScannedAt: new Date(),
      },
    });

    const now = new Date();
    const run = await prisma.axiomAgentRun.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
        cloudAccountId: cloudAccount.id,
        trigger: input.trigger ?? "manual",
        status: "completed",
        startedAt: now,
        completedAt: now,
        snapshotData: input.snapshot as object,
        summary: input.summary ?? `${input.findings.length} finding${input.findings.length === 1 ? "" : "s"} from ${input.provider}/${input.externalAccountId}`,
      },
    });

    // Per-row create so we can map PreviewFinding.id → AxiomFinding.id.
    // Recommendations carry a PreviewFinding.id reference which must
    // be translated to the just-created AxiomFinding row.
    const previewIdToDbId = new Map<string, string>();
    for (const f of input.findings) {
      const created = await prisma.axiomFinding.create({
        data: {
          runId: run.id,
          category: inferCategory(f.ruleCode),
          severity: clampSeverity(f.risk),
          title: f.title,
          description: f.description,
          affectedResources: f.resourceRef ? [f.resourceRef] : [],
          region: input.region,
          provider: input.provider,
          confidence: "medium",
          data: {
            ruleCode: f.ruleCode,
            snapshotId: f.snapshotId,
            source: f.source,
          },
        },
        select: { id: true },
      });
      previewIdToDbId.set(f.id, created.id);
    }

    // Persist recommendations + auto-create approval items for those
    // that need a human gate. Only proceed when the scanner returned
    // recommendations (some paths run inventory-only).
    let recommendationCount = 0;
    if (input.recommendations && input.recommendations.length > 0) {
      for (const r of input.recommendations) {
        const findingDbId = previewIdToDbId.get(r.findingId);
        if (!findingDbId) continue; // orphan rec — skip rather than fail the whole scan
        const disposition = dispositionFor(r.actionClass);
        const risk = riskFor(r.actionClass);
        const matchedFinding = input.findings.find((f) => f.id === r.findingId);
        const recommendedStateText = matchedFinding?.description ?? r.title;
        const action = actionTypeFor(r.actionClass, recommendedStateText);
        const rec = await prisma.axiomRecommendation.create({
          data: {
            runId: run.id,
            findingId: findingDbId,
            title: r.title,
            rationale: r.description,
            disposition,
            dispositionReason: `Scanner classified as ${r.actionClass.replace(/_/g, " ")}.`,
            actionType: action,
            riskLevel: risk,
            effort: "low",
            actionable: disposition !== "informational",
            monthlyLow: r.monthlySavingsUsd ?? 0,
            monthlyHigh: r.monthlySavingsUsd ?? 0,
            yearlyLow: (r.monthlySavingsUsd ?? 0) * 12,
            yearlyHigh: (r.monthlySavingsUsd ?? 0) * 12,
          },
          select: { id: true },
        });
        recommendationCount++;

        // Approval-required recommendations enter the approval queue.
        // We don't have AxiomExecutionPlan rows yet (that machinery
        // lives in the executor pipeline), so we wire the approval
        // item to planItemId=rec.id as a stand-in until the planner
        // runs. The approval center reads by organizationId + status,
        // so the stand-in id never causes a join failure.
        if (disposition === "approval_required") {
          try {
            await prisma.axiomApprovalItem.create({
              data: {
                organizationId: input.organizationId,
                runId: run.id,
                planItemId: rec.id,
                title: r.title,
                actionType: action,
                provider: input.provider,
                region: input.region,
                resourceIds: input.findings.find((f) => f.id === r.findingId)?.resourceRef
                  ? [input.findings.find((f) => f.id === r.findingId)!.resourceRef]
                  : [],
                currentState: "current",
                recommendedState: "recommended",
                riskLevel: risk,
                disposition: "approval_required",
                dispositionReason: `Scanner: ${r.actionClass.replace(/_/g, " ")}`,
                monthlyLow: r.monthlySavingsUsd ?? 0,
                monthlyHigh: r.monthlySavingsUsd ?? 0,
                yearlyLow: (r.monthlySavingsUsd ?? 0) * 12,
                yearlyHigh: (r.monthlySavingsUsd ?? 0) * 12,
                rollbackAvailable: false,
              },
            });
          } catch (approvalErr) {
            console.warn(
              "[persistScanRun] approval item create failed:",
              approvalErr instanceof Error ? approvalErr.message : approvalErr,
            );
          }
        }
      }
    }

    // Auto-create a daily scheduled scan after the first manual scan.
    // The cron worker at /api/cron/scheduled-scan-tick polls these
    // every 15 minutes. Users don't have to opt in — they get
    // automatic re-scans, and can disable via toggle later.
    if (input.trigger === "manual" || input.trigger === undefined) {
      try {
        const existing = await prisma.axiomScheduledRun.findFirst({
          where: {
            organizationId: input.organizationId,
            cloudAccountId: cloudAccount.id,
          },
          select: { id: true },
        });
        if (!existing) {
          const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await prisma.axiomScheduledRun.create({
            data: {
              organizationId: input.organizationId,
              cloudAccountId: cloudAccount.id,
              frequency: "daily",
              cronExpression: "0 9 * * *",
              timezone: "UTC",
              nextRunAt: tomorrow,
              enabled: true,
            },
          });
        }
      } catch (schedErr) {
        // Schedule creation is best-effort — the manual scan
        // already succeeded so we never fail the parent for this.
        console.warn(
          "[persistScanRun] schedule auto-create failed:",
          schedErr instanceof Error ? schedErr.message : schedErr,
        );
      }
    }

    // Fire the outbound notification — best-effort, never blocks
    // the scan response. Only configured channels (Slack / Teams /
    // webhook / email via env opt-in) receive anything; otherwise
    // this is a no-op.
    void notifyScanComplete({
      tenantId: input.organizationId,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      findings: input.findings.map((f) => ({
        severity: clampSeverity(f.risk),
      })),
      resourceCount: Array.isArray((input.snapshot as { resources?: unknown[] })?.resources)
        ? (input.snapshot as { resources: unknown[] }).resources.length
        : 0,
      trigger: input.trigger ?? "manual",
      runId: run.id,
    });

    return {
      runId: run.id,
      cloudAccountId: cloudAccount.id,
      findingCount: input.findings.length,
      recommendationCount,
    };
  } catch (err) {
    console.warn("[persistScanRun] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
