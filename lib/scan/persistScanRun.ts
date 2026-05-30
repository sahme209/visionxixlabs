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
import type { PreviewFinding } from "@/lib/cloud/aws/awsPreviewScanner";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

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
  /** Optional summary surfaced on the AxiomAgentRun row for quick reads. */
  summary?: string;
  /** Honest source tag from the scanner — only "live" runs persist findings. */
  source: "live" | "partial" | "preview";
}

interface PersistOutcome {
  runId: string;
  cloudAccountId: string;
  findingCount: number;
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

export async function persistScanRun(input: PersistInput): Promise<PersistOutcome | null> {
  // Only persist real / live findings — preview noise would pollute the
  // canonical tables and create false signal on the dashboard.
  if (input.source === "preview") return null;

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

    if (input.findings.length > 0) {
      await prisma.axiomFinding.createMany({
        data: input.findings.map((f) => ({
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
        })),
      });
    }

    return {
      runId: run.id,
      cloudAccountId: cloudAccount.id,
      findingCount: input.findings.length,
    };
  } catch (err) {
    console.warn("[persistScanRun] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
