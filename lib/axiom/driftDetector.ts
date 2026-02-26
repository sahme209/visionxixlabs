import type { AxiomProfile } from "./infrastructureAdvantage";

export type DriftSignals = {
  hasDrift: boolean;
  driftLevel: "low" | "medium" | "high";
  signals: string[];
  recommendedNextActions: string[];
};

type PreviousProfile = {
  hostingProvider?: string | null;
  monthlySpend?: string | null;
  hasCiCd?: string | null;
  publicExposure?: string | null;
  complianceNeeds?: string | null;
  trafficLevel?: string | null;
};

function spendBucket(spend: string | number | null | undefined): string {
  if (spend == null || spend === "") return "unknown";
  const n = typeof spend === "string" ? parseInt(spend, 10) : spend;
  if (Number.isNaN(n)) return "unknown";
  if (n < 1000) return "small";
  if (n < 10000) return "medium";
  return "large";
}

/**
 * Phase 4: Deterministic drift detection.
 * Compares current profile vs last snapshot's profile reference.
 * Token-safe; no AI calls.
 */
export function detectDrift(
  currentProfile: AxiomProfile,
  lastSnapshotRaw: Record<string, unknown> | null | undefined
): DriftSignals {
  const signals: string[] = [];
  const recommendedNextActions: string[] = [];

  const raw = lastSnapshotRaw ?? {};
  const prev: PreviousProfile = (raw.operatorProfile as Record<string, unknown>) ?? raw;
  if (!prev.hostingProvider && !prev.monthlySpend && !prev.hasCiCd) {
    return {
      hasDrift: false,
      driftLevel: "low",
      signals: [],
      recommendedNextActions: [],
    };
  }

  const providerChanged =
    prev.hostingProvider &&
    currentProfile.hostingProvider &&
    String(prev.hostingProvider).trim().toLowerCase() !==
      String(currentProfile.hostingProvider).trim().toLowerCase();
  if (providerChanged) {
    signals.push("Cloud provider has changed since last assessment.");
    recommendedNextActions.push("Re-run full infrastructure analysis for the new provider.");
  }

  const prevSpendBucket = spendBucket(prev.monthlySpend as string | null);
  const currSpendBucket = spendBucket(currentProfile.monthlySpend);
  if (prevSpendBucket !== "unknown" && currSpendBucket !== prevSpendBucket) {
    signals.push(
      `Monthly spend bucket changed from ${prevSpendBucket} to ${currSpendBucket}.`
    );
    recommendedNextActions.push("Review cost optimization recommendations.");
  }

  const cicdRegression =
    prev.hasCiCd === "yes" &&
    currentProfile.hasCiCd === "no";
  if (cicdRegression) {
    signals.push("CI/CD has been removed or disabled since last assessment.");
    recommendedNextActions.push("Re-establish CI/CD to reduce deployment friction.");
  }

  const publicExposureChanged =
    prev.publicExposure &&
    currentProfile.publicExposure &&
    String(prev.publicExposure).trim() !== String(currentProfile.publicExposure).trim();
  if (publicExposureChanged) {
    signals.push("Public exposure level has changed.");
    recommendedNextActions.push("Review security and IAM recommendations.");
  }

  const complianceChanged =
    prev.complianceNeeds &&
    currentProfile.complianceNeeds &&
    String(prev.complianceNeeds).trim().toLowerCase() !==
      String(currentProfile.complianceNeeds).trim().toLowerCase();
  if (complianceChanged) {
    signals.push("Compliance requirements have changed.");
    recommendedNextActions.push("Update security posture to meet new compliance needs.");
  }

  const trafficLevelChanged =
    prev.trafficLevel &&
    currentProfile.trafficLevel &&
    String(prev.trafficLevel).trim() !== String(currentProfile.trafficLevel).trim();
  if (trafficLevelChanged) {
    signals.push("Traffic level has changed since last assessment.");
    recommendedNextActions.push("Re-evaluate scaling and capacity planning.");
  }

  const hasDrift = signals.length > 0;
  let driftLevel: "low" | "medium" | "high" = "low";
  if (signals.length >= 3 || cicdRegression || providerChanged) {
    driftLevel = "high";
  } else if (signals.length >= 1) {
    driftLevel = "medium";
  }

  return {
    hasDrift,
    driftLevel,
    signals,
    recommendedNextActions,
  };
}
