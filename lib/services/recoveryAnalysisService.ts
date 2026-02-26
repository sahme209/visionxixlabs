import { VisaPauseService, RecoveryMetrics, CountryRecoveryData } from "./visaPauseService";

export interface RecoveryPrediction {
  optimistic: Date;
  realistic: Date;
  pessimistic: Date;
  confidence: "high" | "medium" | "low";
  recoveryRateAtProcessing: number; // Recovery rate when user's case will be processed
}

export interface HistoricalPausePattern {
  year: number;
  duration: number; // Days
  recoveryTime: number; // Days to full recovery
  recoveryRate: number; // Average recovery rate per week
}

/**
 * Recovery Analysis Service - Advanced predictions and analysis
 */
export class RecoveryAnalysisService {
  // Historical pause patterns (for reference)
  private static readonly HISTORICAL_PAUSES: HistoricalPausePattern[] = [
    { year: 2017, duration: 120, recoveryTime: 180, recoveryRate: 2.5 },
    { year: 2020, duration: 90, recoveryTime: 150, recoveryRate: 3.0 },
  ];

  /**
   * Predict recovery timeline for user's case
   */
  static async predictRecoveryTimeline(
    userPriorityDate: Date,
    estimatedApprovalDate: Date,
    country: string
  ): Promise<RecoveryPrediction> {
    try {
      const recoveryMetrics = await VisaPauseService.getRecoveryMetrics();
      const countryData = await VisaPauseService.getCountryRecoveryData(country);

      const recoveryRate = countryData?.recoveryRate ?? recoveryMetrics.recoveryRate;
      const weeklyChange = countryData?.weeklyChange ?? recoveryMetrics.weeklyChange;

      // Calculate days until estimated approval
      const now = new Date();
      const daysUntilApproval = Math.ceil(
        (estimatedApprovalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate recovery rate when case will be processed
      const recoveryRateAtProcessing = Math.min(
        100,
        recoveryRate + (weeklyChange / 7) * (daysUntilApproval / 7)
      );

      // Optimistic: Recovery accelerates (weeklyChange * 1.5)
      const optimisticWeeklyChange = weeklyChange * 1.5;
      const optimisticRecoveryRate = Math.min(
        100,
        recoveryRate + (optimisticWeeklyChange / 7) * (daysUntilApproval / 7)
      );
      const optimisticDelay = this.calculateDelay(optimisticRecoveryRate, daysUntilApproval);
      const optimistic = new Date(estimatedApprovalDate.getTime() + optimisticDelay * 24 * 60 * 60 * 1000);

      // Realistic: Current trend continues
      const realisticDelay = this.calculateDelay(recoveryRateAtProcessing, daysUntilApproval);
      const realistic = new Date(estimatedApprovalDate.getTime() + realisticDelay * 24 * 60 * 60 * 1000);

      // Pessimistic: Recovery slows (weeklyChange * 0.5)
      const pessimisticWeeklyChange = Math.max(0, weeklyChange * 0.5);
      const pessimisticRecoveryRate = Math.min(
        100,
        recoveryRate + (pessimisticWeeklyChange / 7) * (daysUntilApproval / 7)
      );
      const pessimisticDelay = this.calculateDelay(pessimisticRecoveryRate, daysUntilApproval);
      const pessimistic = new Date(estimatedApprovalDate.getTime() + pessimisticDelay * 24 * 60 * 60 * 1000);

      // Confidence based on data quality
      const confidence = recoveryRate > 80 && weeklyChange > 1 ? "high" : 
                        recoveryRate > 50 && weeklyChange > 0 ? "medium" : "low";

      return {
        optimistic,
        realistic,
        pessimistic,
        confidence,
        recoveryRateAtProcessing: Math.round(recoveryRateAtProcessing * 10) / 10,
      };
    } catch (error) {
      console.error("Error predicting recovery timeline:", error);
      // Return default predictions
      const defaultDelay = 45;
      return {
        optimistic: new Date(estimatedApprovalDate.getTime() + (defaultDelay - 15) * 24 * 60 * 60 * 1000),
        realistic: new Date(estimatedApprovalDate.getTime() + defaultDelay * 24 * 60 * 60 * 1000),
        pessimistic: new Date(estimatedApprovalDate.getTime() + (defaultDelay + 15) * 24 * 60 * 60 * 1000),
        confidence: "medium",
        recoveryRateAtProcessing: 65,
      };
    }
  }

  /**
   * Calculate delay in days based on recovery rate
   */
  private static calculateDelay(recoveryRate: number, daysUntilApproval: number): number {
    // If recovery is at 100%, no delay
    if (recoveryRate >= 100) return 0;

    // Calculate delay factor (inverse of recovery rate)
    const delayFactor = (100 - recoveryRate) / 100;

    // Apply delay factor to days until approval
    // Higher delay factor = more delay
    return Math.round(daysUntilApproval * delayFactor * 0.3); // 0.3 is a scaling factor
  }

  /**
   * Get historical pause patterns for context
   */
  static getHistoricalPatterns(): HistoricalPausePattern[] {
    return this.HISTORICAL_PAUSES;
  }

  /**
   * Estimate catch-up timeline (when system will catch up to pre-pause levels)
   */
  static async estimateCatchUpTimeline(): Promise<{
    estimatedDate: Date;
    monthsRemaining: number;
    confidence: "high" | "medium" | "low";
  }> {
    try {
      const recoveryMetrics = await VisaPauseService.getRecoveryMetrics();

      if (recoveryMetrics.estimatedFullRecovery) {
        const now = new Date();
        const monthsRemaining = Math.ceil(
          (recoveryMetrics.estimatedFullRecovery.getTime() - now.getTime()) / 
          (1000 * 60 * 60 * 24 * 30)
        );

        return {
          estimatedDate: recoveryMetrics.estimatedFullRecovery,
          monthsRemaining,
          confidence: recoveryMetrics.recoveryRate > 70 ? "high" : 
                     recoveryMetrics.recoveryRate > 50 ? "medium" : "low",
        };
      }

      // Fallback calculation
      const monthsRemaining = Math.ceil((100 - recoveryMetrics.recoveryRate) / Math.max(recoveryMetrics.weeklyChange / 7 * 4, 1));
      const estimatedDate = new Date();
      estimatedDate.setMonth(estimatedDate.getMonth() + monthsRemaining);

      return {
        estimatedDate,
        monthsRemaining,
        confidence: "medium",
      };
    } catch (error) {
      console.error("Error estimating catch-up timeline:", error);
      return {
        estimatedDate: new Date("2026-05-01"),
        monthsRemaining: 4,
        confidence: "low",
      };
    }
  }
}
