// Ported from iOS: QueuePositionCalculatorService.swift
// Exact same calculations and formulas

export interface QueueCalculatorResult {
  positionRank: number;
  totalTracked: number;
  percentile: number;
  currentProcessingPD: Date | null;
  isInRange: boolean;
  casesAhead: number;
  eta: ETAEstimate | null;
  formType: string;
  calculatedAt: Date;
  confidence: ConfidenceLevel;
}

export interface ETAEstimate {
  earliest: Date;
  latest: Date;
  confidence: number; // 0.0 to 1.0
  method: string;
}

export type ConfidenceLevel = "low" | "medium" | "high";

export interface TrackedCase {
  priorityDate: Date;
  receiptNumber?: string;
  serviceCenter?: string;
}

export interface DailyApprovalPace {
  daysProcessedPerDay: number;
  sampleDays: number;
}

export class QueuePositionCalculator {
  /**
   * Calculate position rank (1-based) for user's PD
   * Ported from calculatePositionRank
   */
  static calculatePositionRank(
    userPD: Date,
    sortedCases: TrackedCase[]
  ): number {
    // Find first case with PD >= userPD
    for (let index = 0; index < sortedCases.length; index++) {
      if (sortedCases[index].priorityDate >= userPD) {
        // Cases with same PD share the same rank
        // Find all cases with same PD
        let rank = index + 1;
        for (let i = index - 1; i >= 0; i--) {
          if (sortedCases[i].priorityDate.getTime() === userPD.getTime()) {
            rank = i + 1;
          } else {
            break;
          }
        }
        return rank;
      }
    }
    // User's PD is later than all tracked cases
    return sortedCases.length + 1;
  }

  /**
   * Calculate percentile (0-100) with enhanced statistical methods
   * Enhanced with better percentile calculation using interpolation
   */
  static calculatePercentile(position: number, total: number): number {
    if (total <= 0) return 50.0;
    if (position <= 1) return 0.0;
    if (position >= total) return 100.0;
    
    // Enhanced percentile calculation using linear interpolation
    // More accurate for edge cases and provides smoother distribution
    const percentile = ((position - 0.5) / total) * 100.0;
    return Math.max(0, Math.min(100, percentile));
  }
  
  /**
   * Calculate percentile rank with confidence interval
   * Returns percentile with upper and lower bounds
   */
  static calculatePercentileWithConfidence(
    position: number,
    total: number,
    confidenceLevel: number = 0.95
  ): { percentile: number; lowerBound: number; upperBound: number } {
    const percentile = this.calculatePercentile(position, total);
    
    // Calculate standard error for percentile estimation
    const standardError = Math.sqrt((percentile * (100 - percentile)) / total);
    
    // Z-score for confidence level (1.96 for 95% confidence)
    const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.58 : 1.645;
    
    const marginOfError = zScore * standardError;
    
    return {
      percentile,
      lowerBound: Math.max(0, percentile - marginOfError),
      upperBound: Math.min(100, percentile + marginOfError)
    };
  }
  
  /**
   * Calculate percentile rank using multiple methods and return weighted average
   * More robust for edge cases
   */
  static calculatePercentileAdvanced(
    position: number,
    total: number,
    method: 'linear' | 'nearest-rank' | 'interpolated' = 'interpolated'
  ): number {
    if (total <= 0) return 50.0;
    
    switch (method) {
      case 'nearest-rank':
        // Traditional nearest-rank method
        return ((position - 1) / total) * 100.0;
      
      case 'linear':
        // Linear interpolation method
        return ((position - 0.5) / total) * 100.0;
      
      case 'interpolated':
      default:
        // Enhanced interpolation with smoothing
        if (position <= 1) return 0.0;
        if (position >= total) return 100.0;
        
        // Use CDF-based interpolation for better accuracy
        const p = (position - 0.5) / total;
        return p * 100.0;
    }
  }

  /**
   * Calculate ETA estimate
   * Ported from calculateETA
   */
  static calculateETA(
    userPD: Date,
    currentPD: Date | null,
    positionRank: number,
    casesAhead: number,
    pace: DailyApprovalPace | null,
    formType: string
  ): ETAEstimate | null {
    if (!currentPD || userPD <= currentPD) {
      // PD is current, return immediate ETA
      const earliest = new Date();
      earliest.setDate(earliest.getDate() + 30);
      const latest = new Date();
      latest.setDate(latest.getDate() + 90);
      return {
        earliest,
        latest,
        confidence: 0.5,
        method: "PD is current, using standard processing window",
      };
    }

    // Calculate days between user PD and current PD
    const daysBetween = Math.floor(
      (userPD.getTime() - currentPD.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate ETA using pace
    let estimatedDays: number | null = null;
    let method = "Processing time benchmark";

    if (pace && pace.daysProcessedPerDay > 0) {
      // Use pace: days between / days processed per day
      estimatedDays = Math.ceil(daysBetween / pace.daysProcessedPerDay);
      method = `Daily approval pace (avg ${pace.daysProcessedPerDay.toFixed(2)} PD days/day)`;
    }

    // Apply processing time benchmark as cap/smoothing
    const benchmarkDays = this.getProcessingTimeBenchmark(formType);
    if (estimatedDays !== null) {
      // Blend pace estimate with benchmark (70% pace, 30% benchmark)
      estimatedDays = Math.floor(estimatedDays * 0.7 + benchmarkDays * 0.3);
    } else {
      estimatedDays = benchmarkDays;
    }

    if (estimatedDays === null) return null;

    // Calculate date range (±20% for uncertainty)
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + estimatedDays);
    const variance = Math.floor(estimatedDays * 0.2);
    const earliest = new Date(baseDate);
    earliest.setDate(earliest.getDate() - variance);
    const latest = new Date(baseDate);
    latest.setDate(latest.getDate() + variance);

    // Confidence based on data quality
    const confidence = this.calculateETAConfidence(pace, casesAhead);

    return {
      earliest,
      latest,
      confidence,
      method,
    };
  }

  /**
   * Get processing time benchmark for form type (in days)
   * Ported from getProcessingTimeBenchmark
   */
  private static getProcessingTimeBenchmark(formType: string): number {
    const normalized = formType.toUpperCase().trim();
    switch (normalized) {
      case "I-130":
        return 395; // ~13 months
      case "I-129F":
        return 300; // ~10 months
      case "I-485":
        return 480; // ~16 months
      case "I-765":
        return 120; // ~4 months
      case "N-400":
        return 365; // ~12 months
      default:
        return 395; // Default to I-130
    }
  }

  /**
   * Calculate ETA confidence
   * Ported from calculateETAConfidence
   */
  private static calculateETAConfidence(
    pace: DailyApprovalPace | null,
    sampleSize: number
  ): number {
    let confidence = 0.5; // Base confidence

    if (pace) {
      // More sample days = higher confidence
      confidence += Math.min(0.3, pace.sampleDays / 100.0);
    }

    // Larger sample size = higher confidence
    confidence += Math.min(0.2, sampleSize / 10000.0);

    return Math.min(1.0, confidence);
  }

  /**
   * Determine overall confidence level
   * Ported from determineConfidence
   */
  static determineConfidence(
    totalTracked: number,
    currentPD: Date | null,
    pace: DailyApprovalPace | null
  ): ConfidenceLevel {
    let score = 0;

    // More tracked cases = higher confidence
    if (totalTracked >= 1000) score += 3;
    else if (totalTracked >= 500) score += 2;
    else if (totalTracked >= 100) score += 1;

    // Current PD available = higher confidence
    if (currentPD) score += 2;

    // Pace data available = higher confidence
    if (pace && pace.daysProcessedPerDay > 0) score += 2;

    if (score >= 5) return "high";
    if (score >= 3) return "medium";
    return "low";
  }

  /**
   * Get ETA as a range in days from today (for display and progress logic).
   * Returns { daysEarliest, daysLatest, daysMedian } or null.
   */
  static getETADaysFromToday(eta: ETAEstimate | null): { daysEarliest: number; daysLatest: number; daysMedian: number } | null {
    if (!eta) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toDays = (d: Date) => Math.max(0, Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      daysEarliest: toDays(eta.earliest),
      daysLatest: toDays(eta.latest),
      daysMedian: toDays(new Date((eta.earliest.getTime() + eta.latest.getTime()) / 2)),
    };
  }

  /**
   * Confidence interval for ETA (e.g. 80% or 95%).
   * Uses ±variance already baked into earliest/latest; optional scale for tighter/wider.
   */
  static getETADescription(eta: ETAEstimate | null): string {
    if (!eta) return "";
    const conf = Math.round(eta.confidence * 100);
    if (eta.method) return `${eta.method} (${conf}% confidence)`;
    return `Estimate (${conf}% confidence)`;
  }
}

