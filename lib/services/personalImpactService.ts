import { RecoveryAnalysisService } from "./recoveryAnalysisService";
import { VisaPauseService } from "./visaPauseService";
import { TimelineCalculator } from "../calculations/timeline";

export interface PersonalImpact {
  originalEstimate: Date;
  currentEstimate: Date;
  delayDays: number;
  recoveryAdjustedEstimate: Date;
  recoveryPredictions: {
    optimistic: Date;
    realistic: Date;
    pessimistic: Date;
  };
  impactPercentage: number; // How much delay affects user (0-100)
}

/**
 * Personal Impact Service - Calculate how pause affects user's specific case
 */
export class PersonalImpactService {
  /**
   * Calculate personal impact for user's case
   */
  static async calculatePersonalImpact(
    formType: string,
    priorityDate: Date,
    country: string
  ): Promise<PersonalImpact> {
    try {
      // Calculate original (pre-pause) estimate
      const originalEstimate = TimelineCalculator.estimateApprovalDate(
        formType,
        priorityDate
      );

      // Get recovery metrics
      const recoveryMetrics = await VisaPauseService.getRecoveryMetrics();
      const countryData = await VisaPauseService.getCountryRecoveryData(country);

      // Calculate current estimate (with pause impact)
      const recoveryRate = Math.max(10, Math.min(100, countryData?.recoveryRate ?? recoveryMetrics.recoveryRate));
      const delayFactor = (100 - recoveryRate) / 100;
      const daysUntilOriginal = Math.ceil(
        (originalEstimate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      const rawDelay = daysUntilOriginal > 0
        ? daysUntilOriginal * delayFactor * 0.35
        : 45 * delayFactor;
      const estimatedDelayDays = Math.max(0, Math.round(rawDelay));
      const currentEstimate = new Date(
        originalEstimate.getTime() + estimatedDelayDays * 24 * 60 * 60 * 1000
      );

      // Get recovery predictions
      const recoveryPredictions = await RecoveryAnalysisService.predictRecoveryTimeline(
        priorityDate,
        currentEstimate,
        country
      );

      // Calculate recovery-adjusted estimate (updates as recovery progresses)
      const recoveryAdjustedEstimate = recoveryPredictions.realistic;

      // Calculate impact percentage (how much of remaining wait is pause-related)
      const impactPercentage = daysUntilOriginal > 0
        ? Math.min(100, Math.round((estimatedDelayDays / daysUntilOriginal) * 1000) / 10)
        : Math.min(100, estimatedDelayDays > 0 ? 25 : 0);

      return {
        originalEstimate,
        currentEstimate,
        delayDays: estimatedDelayDays,
        recoveryAdjustedEstimate,
        recoveryPredictions: {
          optimistic: recoveryPredictions.optimistic,
          realistic: recoveryPredictions.realistic,
          pessimistic: recoveryPredictions.pessimistic,
        },
        impactPercentage: Math.round(impactPercentage * 10) / 10,
      };
    } catch (error) {
      console.error("Error calculating personal impact:", error);
      // Return default values
      const defaultEstimate = new Date(priorityDate);
      defaultEstimate.setMonth(defaultEstimate.getMonth() + 12);
      const delayedEstimate = new Date(defaultEstimate);
      delayedEstimate.setDate(delayedEstimate.getDate() + 45);

      return {
        originalEstimate: defaultEstimate,
        currentEstimate: delayedEstimate,
        delayDays: 45,
        recoveryAdjustedEstimate: delayedEstimate,
        recoveryPredictions: {
          optimistic: new Date(delayedEstimate.getTime() - 15 * 24 * 60 * 60 * 1000),
          realistic: delayedEstimate,
          pessimistic: new Date(delayedEstimate.getTime() + 15 * 24 * 60 * 60 * 1000),
        },
        impactPercentage: 30,
      };
    }
  }
}
