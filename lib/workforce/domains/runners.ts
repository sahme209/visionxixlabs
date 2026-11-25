/**
 * Domain runner registry — Phase 611.
 *
 * Maps no-input engineer ids to a single run+persist call so the
 * cron sweep can iterate the registry generically without hard-
 * coding each call site.
 *
 * Operator-input engineers (specs, refactor plans, schema proposals,
 * migration runbooks, etc.) are intentionally omitted — they can't
 * run without operator form payload.
 *
 * Each runner's runAndPersist() returns the canonical
 * "ai_generated | fallback_rules | error" outcome so the sweep can
 * roll up tick stats without inspecting the specific report shape.
 *
 * Server-only.
 */

import "server-only";

import { runComplianceEngineer, persistComplianceReport } from "@/lib/workforce/domains/complianceEngineer";
import { runDetectorEngineer, persistDetectorReport } from "@/lib/workforce/domains/detectorEngineer";
import { runIncidentEngineer, persistIncidentReport } from "@/lib/workforce/domains/incidentEngineer";
import { runSecretsHygieneEngineer, persistSecretsHygieneReport } from "@/lib/workforce/domains/secretsHygieneEngineer";
import { runFinopsEngineer, persistFinopsReport } from "@/lib/workforce/domains/finopsEngineer";
import { runAnomalyEngineer, persistAnomalyReport } from "@/lib/workforce/domains/anomalyEngineer";
import { runAuditorEngineer, persistAuditorReport } from "@/lib/workforce/domains/auditorEngineer";
import { runAlertNoiseEngineer, persistAlertNoiseReport } from "@/lib/workforce/domains/alertNoiseEngineer";
import { runVerifierEngineer, persistVerifierReport } from "@/lib/workforce/domains/verifierEngineer";
import { runPipelineRepairEngineer, persistPipelineRepairReport } from "@/lib/workforce/domains/pipelineRepairEngineer";
import { runMemoryConsolidatorEngineer, persistMemoryConsolidationReport } from "@/lib/workforce/domains/memoryConsolidatorEngineer";
import { runMetaReasonerEngineer, persistMetaReasonerReport } from "@/lib/workforce/domains/metaReasonerEngineer";
import { runCouncilEngineer, persistCouncilReport } from "@/lib/workforce/domains/councilEngineer";
import { runImprovementEngineer, persistImprovementReport } from "@/lib/workforce/domains/improvementEngineer";

export type DomainOutcome = "ai_generated" | "fallback_rules" | "error";

export interface DomainRunSummary {
  outcome: DomainOutcome;
  modelHint: string | null;
  errorMessage: string | null;
}

export interface DomainRunner {
  engineerId: string;
  /** Approximate priority — lower numbers run first within a tick.
   *  Used for chains: meta_reasoner=20 runs before council=21 so
   *  council consumes a fresh meta payload. */
  sweepPriority: number;
  /** Minimum minutes between sweep runs. The hourly cron + manual
   *  sweep both skip an engineer whose persisted report row is
   *  younger than this floor — avoids burning AI cycles on
   *  composition-style engineers that don't need hourly cadence.
   *  Phase 626. */
  minIntervalMinutes: number;
  /** Runs the engineer + persists the report in a single unit so the
   *  cron sweep doesn't double-bill AI calls. */
  runAndPersist(organizationId: string, actorUserId?: string): Promise<DomainRunSummary>;
}

function summary(r: { outcome: DomainOutcome; modelHint: string | null; errorMessage: string | null }): DomainRunSummary {
  return { outcome: r.outcome, modelHint: r.modelHint, errorMessage: r.errorMessage };
}

/**
 * Cadence floors per engineer (Phase 626):
 *  · High-frequency signal engineers (~60m) — anomaly, alert_noise,
 *    verifier, pipeline_repair. These watch live telemetry and need
 *    the hourly cadence to surface fresh spikes.
 *  · Medium-frequency state engineers (~120m) — compliance, detector,
 *    incident, secrets_hygiene, finops, auditor. Their underlying
 *    state moves slower; every-other-hour is plenty.
 *  · Composition engineers (~240m / 4h) — meta_reasoner, council,
 *    improvement, memory_consolidator. These summarize OTHER
 *    engineers' output; firing more often than the upstream updates
 *    burns AI on identical snapshots.
 */
export const DOMAIN_RUNNERS: ReadonlyArray<DomainRunner> = [
  {
    engineerId: "compliance_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 120,
    async runAndPersist(orgId, actorUserId) {
      const r = await runComplianceEngineer(orgId, actorUserId);
      await persistComplianceReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "detector_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 120,
    async runAndPersist(orgId, actorUserId) {
      const r = await runDetectorEngineer(orgId, actorUserId);
      await persistDetectorReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "incident_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 120,
    async runAndPersist(orgId, actorUserId) {
      const r = await runIncidentEngineer(orgId, actorUserId);
      await persistIncidentReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "secrets_hygiene_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 120,
    async runAndPersist(orgId, actorUserId) {
      const r = await runSecretsHygieneEngineer(orgId, actorUserId);
      await persistSecretsHygieneReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "finops_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 120,
    async runAndPersist(orgId, actorUserId) {
      const r = await runFinopsEngineer(orgId, actorUserId);
      await persistFinopsReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "anomaly_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 60,
    async runAndPersist(orgId, actorUserId) {
      const r = await runAnomalyEngineer(orgId, actorUserId);
      await persistAnomalyReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "auditor_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 120,
    async runAndPersist(orgId, actorUserId) {
      const r = await runAuditorEngineer(orgId, actorUserId);
      await persistAuditorReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "alert_noise_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 60,
    async runAndPersist(orgId, actorUserId) {
      const r = await runAlertNoiseEngineer(orgId, actorUserId);
      await persistAlertNoiseReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "verifier_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 60,
    async runAndPersist(orgId, actorUserId) {
      const r = await runVerifierEngineer(orgId, actorUserId);
      await persistVerifierReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "pipeline_repair_engineer",
    sweepPriority: 10,
    minIntervalMinutes: 60,
    async runAndPersist(orgId, actorUserId) {
      const r = await runPipelineRepairEngineer(orgId, actorUserId);
      await persistPipelineRepairReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "meta_reasoner_engineer",
    // Reads cross-engineer rationales — run after the per-domain
    // engineers but before council so council has a fresh payload.
    sweepPriority: 20,
    minIntervalMinutes: 240,
    async runAndPersist(orgId, actorUserId) {
      const r = await runMetaReasonerEngineer(orgId, actorUserId);
      await persistMetaReasonerReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "council_engineer",
    // Reads the latest meta_reasoner output — sweep AFTER
    // meta_reasoner so verdicts reflect just-computed tensions.
    sweepPriority: 21,
    minIntervalMinutes: 240,
    async runAndPersist(orgId, actorUserId) {
      const r = await runCouncilEngineer(orgId, actorUserId);
      await persistCouncilReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "improvement_engineer",
    // Reasons about platform telemetry — neutral late priority.
    sweepPriority: 22,
    minIntervalMinutes: 240,
    async runAndPersist(orgId, actorUserId) {
      const r = await runImprovementEngineer(orgId, actorUserId);
      await persistImprovementReport(orgId, r);
      return summary(r);
    },
  },
  {
    engineerId: "memory_consolidator_engineer",
    // Reads all engineer rationales — sweep LAST so the snapshot is
    // post-tick (catches the engineers that just landed above).
    sweepPriority: 25,
    minIntervalMinutes: 240,
    async runAndPersist(orgId, actorUserId) {
      const r = await runMemoryConsolidatorEngineer(orgId, actorUserId);
      await persistMemoryConsolidationReport(orgId, r);
      return summary(r);
    },
  },
];

export function findDomainRunner(engineerId: string): DomainRunner | undefined {
  return DOMAIN_RUNNERS.find((r) => r.engineerId === engineerId);
}
