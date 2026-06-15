/**
 * Workforce daily digest — Phase 627.
 *
 * Once per day per workspace, rolls up:
 *   · counts of engineer.action_blocked / requires_approval / failure
 *     audit events in the last 24h
 *   · counts of fresh critical safety-triad verdicts in the last 24h
 *     (approver=reject/escalate, boundary=catastrophic/platform,
 *     policy=refuse, council=request_more_data)
 *   · counts of domain engineer reports in the last 24h
 *
 * Persists a per-workspace singleton AiRationaleEnrichment row at
 * targetKind="workforce_daily_digest", targetId=workspaceId. Operators
 * (or future external consumers — Slack, email) can read it as the
 * authoritative "what happened yesterday" rollup.
 *
 * Server-only.
 */

import "server-only";

import { prisma } from "@/lib/db";

export const WORKFORCE_DAILY_DIGEST_TARGET_KIND = "workforce_daily_digest";

export interface DigestCounts {
  audit: {
    blocked: number;
    requiresApproval: number;
    failure: number;
    totalAttempted: number;
  };
  safety: {
    approverReject: number;
    approverEscalate: number;
    boundaryCatastrophic: number;
    boundaryPlatform: number;
    policyRefuse: number;
    councilRequestMoreData: number;
  };
  reports: {
    aiGenerated: number;
    fallbackRules: number;
    error: number;
    distinctEngineers: number;
  };
}

export interface DigestReadback {
  counts: DigestCounts;
  narrative: string;
  outcome: "calm" | "active" | "critical";
  updatedAt: Date;
}

function classifyOutcome(counts: DigestCounts): "calm" | "active" | "critical" {
  const blocks = counts.audit.blocked +
    counts.safety.approverReject +
    counts.safety.boundaryCatastrophic +
    counts.safety.policyRefuse;
  if (blocks > 0) return "critical";
  const active = counts.audit.requiresApproval +
    counts.safety.councilRequestMoreData +
    counts.audit.failure +
    counts.reports.aiGenerated +
    counts.reports.fallbackRules;
  if (active > 0) return "active";
  return "calm";
}

function buildNarrative(counts: DigestCounts, outcome: "calm" | "active" | "critical"): string {
  if (outcome === "calm") {
    return `Workforce daily digest — calm 24 hours. No engineer actions blocked, no safety verdicts triggered, no domain reports recorded. Workforce is idle or fully suppressed.`;
  }
  const parts: string[] = [];
  parts.push(`Workforce daily digest (last 24h):`);
  parts.push(`${counts.reports.distinctEngineers} engineer${counts.reports.distinctEngineers === 1 ? "" : "s"} produced ${counts.reports.aiGenerated + counts.reports.fallbackRules + counts.reports.error} domain reports.`);
  if (counts.audit.blocked > 0) {
    parts.push(`${counts.audit.blocked} engineer action${counts.audit.blocked === 1 ? "" : "s"} blocked.`);
  }
  if (counts.audit.requiresApproval > 0) {
    parts.push(`${counts.audit.requiresApproval} action${counts.audit.requiresApproval === 1 ? "" : "s"} routed for approval.`);
  }
  const safetyCritical = counts.safety.approverReject + counts.safety.boundaryCatastrophic + counts.safety.policyRefuse;
  if (safetyCritical > 0) {
    parts.push(`${safetyCritical} critical safety verdict${safetyCritical === 1 ? "" : "s"} landed (review the criticals page).`);
  }
  return parts.join(" ");
}

export async function buildDailyDigest(organizationId: string): Promise<DigestCounts> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    blockedRows,
    requiresApprovalRows,
    failureRows,
    safetyRows,
    reportRows,
  ] = await Promise.all([
    prisma.secureAuditRecord.count({
      where: {
        organizationId,
        action: "engineer.action_blocked",
        occurredAt: { gte: since24h },
      },
    }).catch(() => 0),
    prisma.secureAuditRecord.count({
      where: {
        organizationId,
        action: "engineer.action_requires_approval",
        occurredAt: { gte: since24h },
      },
    }).catch(() => 0),
    prisma.secureAuditRecord.count({
      where: {
        organizationId,
        action: "engineer.action_attempted",
        outcome: "failure",
        occurredAt: { gte: since24h },
      },
    }).catch(() => 0),
    prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId,
        targetKind: {
          in: [
            "engineer_approval_packet",
            "engineer_boundary_classification",
            "engineer_policy_decision",
            "engineer_council_verdicts",
          ],
        },
        updatedAt: { gte: since24h },
      },
      select: { targetKind: true, nextActionsJson: true },
    }).catch(() => []),
    prisma.aiRationaleEnrichment.groupBy({
      by: ["targetKind", "outcome"],
      where: {
        organizationId,
        targetKind: { startsWith: "engineer_" },
        updatedAt: { gte: since24h },
      },
      _count: { _all: true },
    }).catch(() => [] as Array<{ targetKind: string; outcome: string; _count: { _all: number } }>),
  ]);

  // Parse safety rows for critical decisions.
  const safety = {
    approverReject: 0,
    approverEscalate: 0,
    boundaryCatastrophic: 0,
    boundaryPlatform: 0,
    policyRefuse: 0,
    councilRequestMoreData: 0,
  };
  for (const r of safetyRows) {
    if (!Array.isArray(r.nextActionsJson)) continue;
    const payload = r.nextActionsJson as unknown[];
    if (r.targetKind === "engineer_approval_packet") {
      for (const e of payload) {
        if (typeof e === "string" && e.startsWith("decision|")) {
          const v = e.slice("decision|".length);
          if (v === "reject") safety.approverReject += 1;
          else if (v === "escalate") safety.approverEscalate += 1;
        }
      }
    } else if (r.targetKind === "engineer_boundary_classification") {
      for (const e of payload) {
        if (typeof e === "string" && e.startsWith("tier|")) {
          const v = e.slice("tier|".length);
          if (v === "catastrophic") safety.boundaryCatastrophic += 1;
          else if (v === "platform") safety.boundaryPlatform += 1;
        }
      }
    } else if (r.targetKind === "engineer_policy_decision") {
      for (const e of payload) {
        if (typeof e === "string" && e.startsWith("decision|") && e.endsWith("|refuse")) {
          safety.policyRefuse += 1;
        } else if (typeof e === "string" && e === "decision|refuse") {
          safety.policyRefuse += 1;
        }
      }
    } else if (r.targetKind === "engineer_council_verdicts") {
      for (const e of payload) {
        if (typeof e === "string" && e.startsWith("verdict|") && e.includes("|request_more_data|")) {
          safety.councilRequestMoreData += 1;
        }
      }
    }
  }

  const reports = { aiGenerated: 0, fallbackRules: 0, error: 0, distinctEngineers: 0 };
  const distinctKinds = new Set<string>();
  for (const r of reportRows) {
    distinctKinds.add(r.targetKind);
    if (r.outcome === "ai_generated") reports.aiGenerated += r._count._all;
    else if (r.outcome === "fallback_rules") reports.fallbackRules += r._count._all;
    else if (r.outcome === "error") reports.error += r._count._all;
  }
  reports.distinctEngineers = distinctKinds.size;

  return {
    audit: {
      blocked: blockedRows,
      requiresApproval: requiresApprovalRows,
      failure: failureRows,
      totalAttempted: blockedRows + requiresApprovalRows + failureRows,
    },
    safety,
    reports,
  };
}

export async function persistDailyDigest(organizationId: string, counts: DigestCounts): Promise<void> {
  const outcome = classifyOutcome(counts);
  const narrative = buildNarrative(counts, outcome);
  const payload: string[] = [
    `outcome|${outcome}`,
    `audit_blocked|${counts.audit.blocked}`,
    `audit_requires_approval|${counts.audit.requiresApproval}`,
    `audit_failure|${counts.audit.failure}`,
    `safety_approver_reject|${counts.safety.approverReject}`,
    `safety_approver_escalate|${counts.safety.approverEscalate}`,
    `safety_boundary_catastrophic|${counts.safety.boundaryCatastrophic}`,
    `safety_boundary_platform|${counts.safety.boundaryPlatform}`,
    `safety_policy_refuse|${counts.safety.policyRefuse}`,
    `safety_council_request_more_data|${counts.safety.councilRequestMoreData}`,
    `reports_ai_generated|${counts.reports.aiGenerated}`,
    `reports_fallback_rules|${counts.reports.fallbackRules}`,
    `reports_error|${counts.reports.error}`,
    `reports_distinct_engineers|${counts.reports.distinctEngineers}`,
  ];
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: WORKFORCE_DAILY_DIGEST_TARGET_KIND,
          targetId: organizationId,
        },
      },
      create: {
        organizationId,
        targetKind: WORKFORCE_DAILY_DIGEST_TARGET_KIND,
        targetId: organizationId,
        narrative,
        riskFactorsJson: [] as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: outcome === "critical" ? "error" : outcome === "active" ? "ai_generated" : "fallback_rules",
        errorMessage: null,
        modelHint: null,
        engineVersion: "workforce-daily-digest-v1",
      },
      update: {
        narrative,
        nextActionsJson: payload as unknown as string[],
        outcome: outcome === "critical" ? "error" : outcome === "active" ? "ai_generated" : "fallback_rules",
      },
    });
  } catch (err) {
    console.warn("[dailyDigest] persist failed:", err instanceof Error ? err.message : err);
  }
}

export async function readDailyDigest(organizationId: string): Promise<DigestReadback | null> {
  try {
    const row = await prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: WORKFORCE_DAILY_DIGEST_TARGET_KIND,
          targetId: organizationId,
        },
      },
      select: { narrative: true, nextActionsJson: true, updatedAt: true },
    });
    if (!row) return null;
    const tags = new Map<string, string>();
    if (Array.isArray(row.nextActionsJson)) {
      for (const e of row.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        const idx = e.indexOf("|");
        if (idx === -1) continue;
        tags.set(e.slice(0, idx), e.slice(idx + 1));
      }
    }
    const num = (k: string) => {
      const v = tags.get(k);
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : 0;
    };
    const outcomeRaw = tags.get("outcome");
    const outcome: "calm" | "active" | "critical" =
      outcomeRaw === "critical" ? "critical" :
      outcomeRaw === "active" ? "active" : "calm";
    return {
      counts: {
        audit: {
          blocked: num("audit_blocked"),
          requiresApproval: num("audit_requires_approval"),
          failure: num("audit_failure"),
          totalAttempted: num("audit_blocked") + num("audit_requires_approval") + num("audit_failure"),
        },
        safety: {
          approverReject: num("safety_approver_reject"),
          approverEscalate: num("safety_approver_escalate"),
          boundaryCatastrophic: num("safety_boundary_catastrophic"),
          boundaryPlatform: num("safety_boundary_platform"),
          policyRefuse: num("safety_policy_refuse"),
          councilRequestMoreData: num("safety_council_request_more_data"),
        },
        reports: {
          aiGenerated: num("reports_ai_generated"),
          fallbackRules: num("reports_fallback_rules"),
          error: num("reports_error"),
          distinctEngineers: num("reports_distinct_engineers"),
        },
      },
      narrative: row.narrative,
      outcome,
      updatedAt: row.updatedAt,
    };
  } catch {
    return null;
  }
}
