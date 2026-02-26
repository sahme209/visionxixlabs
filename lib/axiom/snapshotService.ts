import { prisma } from "@/lib/db";
import { SCORING_VERSION } from "@/lib/axiom/scoringRegistry";

type SnapshotInput = {
  leadId: string;
  tier: string;
  provider?: string | null;
  infrastructureScore?: number | null;
  estimatedAnnualSavings?: number | null;
  riskExposureLevel?: string | null;
  deploymentFrictionIndex?: number | null;
  complexityTier?: string | null;
  automationReadinessScore?: number | null;
  scoringVersion?: string | null;
  raw?: Record<string, unknown> | null;
};

/**
 * Phase 4: Append-only snapshot for Axiom trend history.
 * Call after successful cloud-operator or cloud-studio trigger.
 */
export async function insertAxiomSnapshot(input: SnapshotInput): Promise<void> {
  try {
    await prisma.axiomScoreSnapshot.create({
      data: {
        leadId: input.leadId,
        tier: input.tier,
        provider: input.provider ?? null,
        infrastructureScore: input.infrastructureScore ?? null,
        estimatedAnnualSavings: input.estimatedAnnualSavings ?? null,
        riskExposureLevel: input.riskExposureLevel ?? null,
        deploymentFrictionIndex: input.deploymentFrictionIndex ?? null,
        complexityTier: input.complexityTier ?? null,
        automationReadinessScore: input.automationReadinessScore ?? null,
        scoringVersion: input.scoringVersion ?? SCORING_VERSION,
        raw: (input.raw as object) ?? null,
      },
    });
  } catch (e) {
    console.error("[axiom snapshot] insert failed:", e);
    // Non-fatal; do not throw
  }
}
