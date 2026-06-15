/**
 * Proof-of-value 30-day rollup — Phase 630.
 *
 * The contract-conversion document. After a trial customer's first
 * 30 days, generates a structured report:
 *   · how many engineers fired (autonomous + manual)
 *   · how many reports produced (ai_generated / fallback / error)
 *   · AI spend gross + billed (with margin)
 *   · top wins surfaced (top-cost engineer, schema-engineer-style
 *     proposals counted, anomaly spikes detected)
 *   · safety triad activity (pre-flights, verdict mix)
 *   · autonomy KPI (last 7d)
 *
 * Pure projection over existing tables — no new persistence.
 *
 * Server-only.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { buildEngineerCostRollup } from "./engineerCostRollup";

export interface ProofOfValueReport {
  workspaceId: string;
  windowDays: number;
  generatedAt: Date;

  engineers: {
    autonomousFired: number; // distinct no-input engineer kinds with at least 1 row
    operatorInputUsed: number; // distinct operator-input engineer kinds touched
    totalReports: number;
    aiGenerated: number;
    fallbackRules: number;
    error: number;
  };

  spend: {
    grossCents: number;
    billedCents: number; // 2× margin default — operator can override per plan
    marginMultiplier: number;
    topEngineerByCost: { engineName: string; cents: number } | null;
  };

  safety: {
    preflightsRun: number;
    allow: number;
    review: number;
    block: number;
    boundaryCatastrophic: number;
    boundaryPlatform: number;
    policyRefuse: number;
    approverReject: number;
  };

  signal: {
    anomalySpikes: number; // anomaly_engineer reports with at least 1 ai_generated row
    schemaProposals: number; // engineer_schema_proposal rows
    refactorPlans: number; // engineer_refactor_plan rows
    migrationRunbooks: number; // engineer_migration_runbook rows
    incidentSummaries: number; // engineer_incident_triage rows
    councilVerdicts: number; // engineer_council_verdicts rows
  };

  autonomy: {
    last7dPct: number | null;
    last7dAiGenerated: number;
    last7dTotal: number;
  };

  narrative: string;
}

const DOMAIN_KIND_TO_NAME: Record<string, string> = {
  engineer_compliance_report: "compliance_engineer",
  engineer_detector_signals: "detector_engineer",
  engineer_incident_triage: "incident_engineer",
  engineer_secrets_hygiene_candidates: "secrets_hygiene_engineer",
  engineer_finops_recommendations: "finops_engineer",
  engineer_anomaly_notices: "anomaly_engineer",
  engineer_auditor_observations: "auditor_engineer",
  engineer_alert_noise_classification: "alert_noise_engineer",
  engineer_verifier_verdicts: "verifier_engineer",
  engineer_pipeline_repair_playbook: "pipeline_repair_engineer",
  engineer_memory_consolidation: "memory_consolidator_engineer",
  engineer_meta_reasoner_resolution: "meta_reasoner_engineer",
  engineer_council_verdicts: "council_engineer",
  engineer_improvement_proposals: "improvement_engineer",
};

const OPERATOR_INPUT_KINDS = new Set([
  "engineer_spec_writer_spec",
  "engineer_test_coverage_proposal",
  "engineer_refactor_plan",
  "engineer_release_notes_draft",
  "engineer_schema_proposal",
  "engineer_migration_runbook",
  "engineer_intent_workflow",
  "engineer_reasoner_hypothesis",
  "engineer_simulator_verdict",
  "engineer_workflow_plan",
  "engineer_operator_copilot_reply",
  "engineer_approval_packet",
  "engineer_boundary_classification",
  "engineer_policy_decision",
]);

function fmtUsd(cents: number): string {
  if (cents === 0) return "$0.00";
  if (cents < 100) return `$${(cents / 100).toFixed(4)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function buildNarrative(r: Omit<ProofOfValueReport, "narrative">): string {
  const parts: string[] = [];
  parts.push(`Workforce ${r.windowDays}-day rollup for workspace ${r.workspaceId}.`);
  parts.push(`${r.engineers.totalReports} reports produced across ${r.engineers.autonomousFired} autonomous engineers + ${r.engineers.operatorInputUsed} operator-input engineers (${r.engineers.aiGenerated} ai_generated · ${r.engineers.fallbackRules} fallback · ${r.engineers.error} error).`);
  parts.push(`AI spend ${fmtUsd(r.spend.grossCents)} gross, billed ${fmtUsd(r.spend.billedCents)} at ${r.spend.marginMultiplier}× margin.`);
  if (r.spend.topEngineerByCost) {
    parts.push(`Top engineer by cost: ${r.spend.topEngineerByCost.engineName} (${fmtUsd(r.spend.topEngineerByCost.cents)}).`);
  }
  if (r.signal.schemaProposals + r.signal.refactorPlans + r.signal.migrationRunbooks + r.signal.anomalySpikes > 0) {
    const wins: string[] = [];
    if (r.signal.schemaProposals > 0) wins.push(`${r.signal.schemaProposals} schema proposal${r.signal.schemaProposals === 1 ? "" : "s"}`);
    if (r.signal.refactorPlans > 0) wins.push(`${r.signal.refactorPlans} refactor plan${r.signal.refactorPlans === 1 ? "" : "s"}`);
    if (r.signal.migrationRunbooks > 0) wins.push(`${r.signal.migrationRunbooks} migration runbook${r.signal.migrationRunbooks === 1 ? "" : "s"}`);
    if (r.signal.anomalySpikes > 0) wins.push(`${r.signal.anomalySpikes} anomaly spike${r.signal.anomalySpikes === 1 ? "" : "s"} detected`);
    parts.push(`Concrete output: ${wins.join(", ")}.`);
  }
  if (r.safety.preflightsRun > 0) {
    parts.push(`Safety triad: ${r.safety.preflightsRun} pre-flight${r.safety.preflightsRun === 1 ? "" : "s"} (${r.safety.allow} allow · ${r.safety.review} review · ${r.safety.block} block).`);
  }
  if (r.autonomy.last7dPct !== null) {
    parts.push(`Autonomy (last 7d): ${r.autonomy.last7dPct}% (${r.autonomy.last7dAiGenerated}/${r.autonomy.last7dTotal} reports produced by AI vs fallback/error).`);
  }
  return parts.join(" ");
}

export async function buildProofOfValueReport(
  organizationId: string,
  windowDays = 30,
): Promise<ProofOfValueReport> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const allDomainKinds = [...Object.keys(DOMAIN_KIND_TO_NAME), ...Array.from(OPERATOR_INPUT_KINDS)];

  const [groupedRows, last7dRows, costRollup, safetyRows] = await Promise.all([
    prisma.aiRationaleEnrichment.groupBy({
      by: ["targetKind", "outcome"],
      where: {
        organizationId,
        targetKind: { in: allDomainKinds },
        updatedAt: { gte: since },
      },
      _count: { _all: true },
    }).catch(() => [] as Array<{ targetKind: string; outcome: string; _count: { _all: number } }>),
    prisma.aiRationaleEnrichment.groupBy({
      by: ["outcome"],
      where: {
        organizationId,
        targetKind: { startsWith: "engineer_" },
        updatedAt: { gte: since7d },
      },
      _count: { _all: true },
    }).catch(() => [] as Array<{ outcome: string; _count: { _all: number } }>),
    buildEngineerCostRollup(organizationId, windowDays).catch(() => null),
    prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId,
        targetKind: {
          in: [
            "engineer_approval_packet",
            "engineer_boundary_classification",
            "engineer_policy_decision",
          ],
        },
        updatedAt: { gte: since },
      },
      select: { targetKind: true, targetId: true, nextActionsJson: true },
    }).catch(() => []),
  ]);

  // Engineer report aggregates.
  let totalReports = 0;
  let aiGenerated = 0;
  let fallbackRules = 0;
  let errorCount = 0;
  const autonomousKindsSeen = new Set<string>();
  const operatorKindsSeen = new Set<string>();

  for (const r of groupedRows) {
    totalReports += r._count._all;
    if (r.outcome === "ai_generated") aiGenerated += r._count._all;
    else if (r.outcome === "fallback_rules") fallbackRules += r._count._all;
    else if (r.outcome === "error") errorCount += r._count._all;
    if (r.targetKind in DOMAIN_KIND_TO_NAME) autonomousKindsSeen.add(r.targetKind);
    if (OPERATOR_INPUT_KINDS.has(r.targetKind)) operatorKindsSeen.add(r.targetKind);
  }

  // Spend.
  const grossCents = costRollup?.totalCents ?? 0;
  const marginMultiplier = 2; // default — operator can override per plan later.
  const billedCents = Math.round(grossCents * marginMultiplier);
  const topEngineerByCost = costRollup && costRollup.rows.length > 0
    ? { engineName: costRollup.rows[0].engineName, cents: costRollup.rows[0].totalCents }
    : null;

  // Safety verdicts.
  const safety = {
    preflightsRun: 0,
    allow: 0,
    review: 0,
    block: 0,
    boundaryCatastrophic: 0,
    boundaryPlatform: 0,
    policyRefuse: 0,
    approverReject: 0,
  };
  // Pre-flight composed slugs end in __approver/__boundary/__policy. Each
  // pre-flight produces exactly one approver row, so counting those gives
  // total pre-flights.
  for (const r of safetyRows) {
    const payload = Array.isArray(r.nextActionsJson) ? (r.nextActionsJson as unknown[]) : [];
    if (r.targetKind === "engineer_approval_packet") {
      if (r.targetId.endsWith("__approver")) safety.preflightsRun += 1;
      let decision: string | null = null;
      for (const e of payload) {
        if (typeof e === "string" && e.startsWith("decision|")) {
          decision = e.slice("decision|".length);
          break;
        }
      }
      if (decision === "approve") safety.allow += 1;
      else if (decision === "reject") { safety.block += 1; safety.approverReject += 1; }
      else if (decision === "revise" || decision === "escalate") safety.review += 1;
    } else if (r.targetKind === "engineer_boundary_classification") {
      for (const e of payload) {
        if (typeof e === "string" && e.startsWith("tier|")) {
          const v = e.slice("tier|".length);
          if (v === "catastrophic") safety.boundaryCatastrophic += 1;
          else if (v === "platform") safety.boundaryPlatform += 1;
          break;
        }
      }
    } else if (r.targetKind === "engineer_policy_decision") {
      for (const e of payload) {
        if (typeof e === "string" && e.startsWith("decision|")) {
          const v = e.slice("decision|".length);
          if (v === "refuse") safety.policyRefuse += 1;
          break;
        }
      }
    }
  }

  // Signal counts — how many real wins by kind.
  const countKind = (kind: string) => groupedRows.filter((r) => r.targetKind === kind).reduce((a, r) => a + r._count._all, 0);
  const signal = {
    anomalySpikes: countKind("engineer_anomaly_notices"),
    schemaProposals: countKind("engineer_schema_proposal"),
    refactorPlans: countKind("engineer_refactor_plan"),
    migrationRunbooks: countKind("engineer_migration_runbook"),
    incidentSummaries: countKind("engineer_incident_triage"),
    councilVerdicts: countKind("engineer_council_verdicts"),
  };

  // Autonomy KPI over the 7d window.
  let last7dAi = 0;
  let last7dTotal = 0;
  for (const r of last7dRows) {
    last7dTotal += r._count._all;
    if (r.outcome === "ai_generated") last7dAi += r._count._all;
  }
  const last7dPct = last7dTotal > 0 ? Math.round((last7dAi / last7dTotal) * 100) : null;

  const draft: Omit<ProofOfValueReport, "narrative"> = {
    workspaceId: organizationId,
    windowDays,
    generatedAt: new Date(),
    engineers: {
      autonomousFired: autonomousKindsSeen.size,
      operatorInputUsed: operatorKindsSeen.size,
      totalReports,
      aiGenerated,
      fallbackRules,
      error: errorCount,
    },
    spend: { grossCents, billedCents, marginMultiplier, topEngineerByCost },
    safety,
    signal,
    autonomy: { last7dPct, last7dAiGenerated: last7dAi, last7dTotal },
  };

  return { ...draft, narrative: buildNarrative(draft) };
}
