// Position Trend Analyzer - Web Implementation
// Ported from iOS: Managers/PositionTrendAnalyzer.swift

import { PositionSnapshot, PositionMovementMetrics } from "./positionHistoryService";

export interface PaceTrendAnalysis {
  averageWeeklyPace: number; // Positions moved per week (positive = improving)
  paceTrend: PaceTrend;
  daysUntilCurrent: number | null; // Estimated days until position becomes current
  weeklyPositions: number[];
  analysisDate: Date;
  
  paceDescription: string;
  trendDescription: string;
}

export enum PaceTrend {
  ACCELERATING = "accelerating",
  STABLE = "stable",
  DECELERATING = "decelerating",
}

export interface ComparisonInsight {
  userMovement: number;
  averageMovement: number;
  percentile: number; // Lower percentile = faster (better)
  comparison: MovementComparison;
  sampleSize: number;
  
  description: string;
}

export enum MovementComparison {
  FASTER_THAN_AVERAGE = "fasterThanAverage",
  AVERAGE = "average",
  SLOWER_THAN_AVERAGE = "slowerThanAverage",
}

class PositionTrendAnalyzer {
  /**
   * Analyze processing pace trend from position history
   */
  analyzePaceTrend(
    history: PositionSnapshot[],
    currentPosition: number | null,
    currentPD: Date | null
  ): PaceTrendAnalysis | null {
    if (history.length < 7 || currentPosition === null || currentPD === null) {
      return null;
    }

    // Group snapshots by week
    const groupedByWeek = new Map<number, PositionSnapshot[]>();
    
    history.forEach((snapshot) => {
      const week = this.getWeekOfYear(snapshot.calculatedAt);
      if (!groupedByWeek.has(week)) {
        groupedByWeek.set(week, []);
      }
      groupedByWeek.get(week)!.push(snapshot);
    });

    // Calculate average position per week
    const weeklyPositions: Array<{ week: number; avgPosition: number; date: Date }> = [];
    
    Array.from(groupedByWeek.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([week, snapshots]) => {
        const positions = snapshots
          .map((s) => s.position)
          .filter((p): p is number => p !== null);
        
        if (positions.length > 0) {
          const avgPosition = positions.reduce((a, b) => a + b, 0) / positions.length;
          const weekDate = snapshots[0]?.calculatedAt ?? new Date();
          weeklyPositions.push({ week, avgPosition, date: weekDate });
        }
      });

    if (weeklyPositions.length < 2) return null;

    // Calculate pace (positions moved per week)
    const weeklyPace: number[] = [];
    for (let i = 1; i < weeklyPositions.length; i++) {
      const prevPos = weeklyPositions[i - 1].avgPosition;
      const currPos = weeklyPositions[i].avgPosition;
      const pace = prevPos - currPos; // Positive = moving up (improving)
      weeklyPace.push(pace);
    }

    // Calculate average pace
    const avgPace = weeklyPace.reduce((a, b) => a + b, 0) / weeklyPace.length;

    // Determine if pace is accelerating or decelerating
    let paceTrend: PaceTrend;
    if (weeklyPace.length >= 2) {
      const recentPace =
        weeklyPace.slice(-2).reduce((a, b) => a + b, 0) / 2.0;
      const olderPace =
        weeklyPace.slice(0, -2).reduce((a, b) => a + b, 0) /
        Math.max(1, weeklyPace.length - 2);

      if (recentPace > olderPace * 1.2) {
        paceTrend = PaceTrend.ACCELERATING;
      } else if (recentPace < olderPace * 0.8) {
        paceTrend = PaceTrend.DECELERATING;
      } else {
        paceTrend = PaceTrend.STABLE;
      }
    } else {
      paceTrend = PaceTrend.STABLE;
    }

    // Calculate days until current based on current pace
    let daysUntilCurrent: number | null = null;
    if (avgPace > 0) {
      daysUntilCurrent = Math.ceil((currentPosition / avgPace) * 7.0); // Convert weekly pace to days
    }

    const paceDescription = this.getPaceDescription(avgPace);
    const trendDescription = this.getTrendDescription(paceTrend);

    return {
      averageWeeklyPace: avgPace,
      paceTrend,
      daysUntilCurrent,
      weeklyPositions: weeklyPositions.map((w) => w.avgPosition),
      analysisDate: new Date(),
      paceDescription,
      trendDescription,
    };
  }

  /**
   * Compare user's movement with similar cases
   */
  compareWithSimilarCases(
    userMovement: PositionMovementMetrics,
    similarCasesMovement: PositionMovementMetrics[]
  ): ComparisonInsight | null {
    if (similarCasesMovement.length === 0) return null;

    // Calculate average movement for similar cases
    const avgPositionChange =
      similarCasesMovement
        .map((m) => m.positionChange7Days ?? 0)
        .reduce((a, b) => a + b, 0) / similarCasesMovement.length;

    const userChange = userMovement.positionChange7Days ?? 0;

    // Determine percentile
    const fasterCount = similarCasesMovement.filter((movement) => {
      const change = movement.positionChange7Days ?? 0;
      return change < userChange; // Lower change = faster (moved up more)
    }).length;

    const percentile = (fasterCount / similarCasesMovement.length) * 100.0;

    let comparison: MovementComparison;
    if (userChange > avgPositionChange * 1.2) {
      comparison = MovementComparison.FASTER_THAN_AVERAGE;
    } else if (userChange < avgPositionChange * 0.8) {
      comparison = MovementComparison.SLOWER_THAN_AVERAGE;
    } else {
      comparison = MovementComparison.AVERAGE;
    }

    const description = this.getComparisonDescription(comparison, percentile);

    return {
      userMovement: userChange,
      averageMovement: avgPositionChange,
      percentile,
      comparison,
      sampleSize: similarCasesMovement.length,
      description,
    };
  }

  private getWeekOfYear(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private getPaceDescription(avgPace: number): string {
    if (avgPace > 50) {
      return `Processing ${Math.round(avgPace)} positions per week`;
    } else if (avgPace > 10) {
      return `Processing ${Math.round(avgPace)} positions per week`;
    } else if (avgPace > 0) {
      return `Processing slowly: ${Math.round(avgPace)} positions per week`;
    } else {
      return "Processing pace unclear";
    }
  }

  private getTrendDescription(trend: PaceTrend): string {
    switch (trend) {
      case PaceTrend.ACCELERATING:
        return "Pace is accelerating - processing is getting faster";
      case PaceTrend.STABLE:
        return "Pace is stable - consistent processing speed";
      case PaceTrend.DECELERATING:
        return "Pace is slowing - processing may be delayed";
    }
  }

  private getComparisonDescription(
    comparison: MovementComparison,
    percentile: number
  ): string {
    switch (comparison) {
      case MovementComparison.FASTER_THAN_AVERAGE:
        return `Your case is progressing faster than ${Math.round(percentile)}% of similar cases`;
      case MovementComparison.AVERAGE:
        return "Your case is progressing at an average pace compared to similar cases";
      case MovementComparison.SLOWER_THAN_AVERAGE:
        return `Your case is progressing slower than ${Math.round(100 - percentile)}% of similar cases`;
    }
  }
}

export const positionTrendAnalyzer = new PositionTrendAnalyzer();
