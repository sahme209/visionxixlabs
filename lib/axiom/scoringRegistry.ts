import {
  computeCloudIntelligence,
  computeCloudOperatorScores,
  type CloudIntelligence,
  type CloudOperatorScores,
  type OperatorProfileInput,
} from "@/lib/cloudStudio/scoring";
import {
  generateInfrastructureAdvantageModel,
  type AxiomProfile,
  type AxiomResult,
} from "@/lib/axiom/infrastructureAdvantage";

/**
 * Base deterministic cloud intelligence scoring, reused across flows.
 */
export function computeBaseCloudIntelligence(
  serviceType: string,
  form: Record<string, unknown>,
  output?: Record<string, unknown> | null
): CloudIntelligence {
  return computeCloudIntelligence(serviceType, form, output ?? null);
}

/**
 * Operator-level scores used by Cloud Operator and Axiom.
 * Delegates to the existing Cloud Operator scoring engine.
 */
export function computeOperatorScores(profile: OperatorProfileInput): CloudOperatorScores {
  return computeCloudOperatorScores(profile);
}

/**
 * Infrastructure Advantage Model™ scores and 30-day plan.
 * Delegates to the Axiom meta-engine while preserving deterministic scoring.
 */
export function computeInfrastructureAdvantageScore(
  profile: AxiomProfile,
  existingScores?: CloudOperatorScores | null
): AxiomResult {
  return generateInfrastructureAdvantageModel(profile, existingScores ?? null);
}

