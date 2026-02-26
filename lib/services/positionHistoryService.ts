// Position History Service - Web Implementation
// Ported from iOS: Managers/PositionHistoryManager.swift

import { db } from "@/lib/firebase";
import { collection, doc, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";

export interface PositionSnapshot {
  id: string;
  formType: string;
  position: number | null;
  percentile: number | null;
  daysRemaining: number;
  currentPD: Date | null;
  calculatedAt: Date;
}

export interface PositionMovementMetrics {
  positionChange7Days: number | null; // Positive = moved up in queue
  positionChange30Days: number | null;
  percentileChange7Days: number | null; // Positive = moved up (lower percentile)
  percentileChange30Days: number | null;
  trend: MovementTrend;
  lastUpdated: Date;
  
  movementDescription: string;
  trendDescription: string;
}

export enum MovementTrend {
  IMPROVING_FAST = "improvingFast",
  IMPROVING = "improving",
  STABLE = "stable",
  DEGRADING = "degrading",
  DEGRADING_FAST = "degradingFast",
}

class PositionHistoryService {
  private collectionName = "positionHistory";

  /**
   * Save a position snapshot for a user
   */
  async savePositionSnapshot(
    userId: string,
    formType: string,
    position: number | null,
    percentile: number | null,
    daysRemaining: number,
    currentPD: Date | null,
    calculatedAt: Date = new Date()
  ): Promise<void> {
    const docRef = collection(
      db,
      this.collectionName,
      userId,
      "snapshots"
    );

    const data: any = {
      formType,
      daysRemaining,
      calculatedAt: Timestamp.fromDate(calculatedAt),
    };

    if (position !== null) {
      data.position = position;
    }

    if (percentile !== null) {
      data.percentile = percentile;
    }

    if (currentPD) {
      data.currentPD = Timestamp.fromDate(currentPD);
    }

    await addDoc(docRef, data);
  }

  private isIndexError(e: unknown): boolean {
    const err = e as { code?: string; message?: string };
    return (
      err?.code === "failed-precondition" ||
      (typeof err?.message === "string" && err.message.toLowerCase().includes("index"))
    );
  }

  /**
   * Get position history for a user
   */
  async getPositionHistory(
    userId: string,
    formType: string,
    limitCount: number = 30
  ): Promise<PositionSnapshot[]> {
    try {
      const q = query(
        collection(db, this.collectionName, userId, "snapshots"),
        where("formType", "==", formType),
        orderBy("calculatedAt", "desc"),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => this.parseSnapshot(d.id, d.data())).filter(Boolean) as PositionSnapshot[];
    } catch (e) {
      if (!this.isIndexError(e)) throw e;
      const fallback = query(
        collection(db, this.collectionName, userId, "snapshots"),
        where("formType", "==", formType)
      );
      const snapshot = await getDocs(fallback);
      const list = snapshot.docs
        .map((d) => this.parseSnapshot(d.id, d.data()))
        .filter(Boolean) as PositionSnapshot[];
      list.sort((a, b) => b.calculatedAt.getTime() - a.calculatedAt.getTime());
      return list.slice(0, limitCount);
    }
  }

  /**
   * Calculate movement metrics from history
   */
  calculateMovementMetrics(
    current: PositionSnapshot,
    history: PositionSnapshot[]
  ): PositionMovementMetrics | null {
    if (history.length === 0) return null;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Find snapshots from different time periods
    const weekAgoSnapshot = history.find(
      (s) => s.calculatedAt <= sevenDaysAgo
    );
    const monthAgoSnapshot = history.find(
      (s) => s.calculatedAt <= thirtyDaysAgo
    );

    let positionChange7Days: number | null = null;
    let positionChange30Days: number | null = null;
    let percentileChange7Days: number | null = null;
    let percentileChange30Days: number | null = null;

    // Calculate position changes
    if (
      weekAgoSnapshot &&
      current.position !== null &&
      weekAgoSnapshot.position !== null
    ) {
      positionChange7Days = weekAgoSnapshot.position - current.position; // Positive = moved up
    }

    if (
      monthAgoSnapshot &&
      current.position !== null &&
      monthAgoSnapshot.position !== null
    ) {
      positionChange30Days = monthAgoSnapshot.position - current.position;
    }

    // Calculate percentile changes
    if (
      weekAgoSnapshot &&
      current.percentile !== null &&
      weekAgoSnapshot.percentile !== null
    ) {
      percentileChange7Days = weekAgoSnapshot.percentile - current.percentile; // Positive = moved up
    }

    if (
      monthAgoSnapshot &&
      current.percentile !== null &&
      monthAgoSnapshot.percentile !== null
    ) {
      percentileChange30Days = monthAgoSnapshot.percentile - current.percentile;
    }

    // Calculate trend
    let trend: MovementTrend;
    if (positionChange7Days !== null) {
      if (positionChange7Days > 50) {
        trend = MovementTrend.IMPROVING_FAST;
      } else if (positionChange7Days > 10) {
        trend = MovementTrend.IMPROVING;
      } else if (positionChange7Days < -50) {
        trend = MovementTrend.DEGRADING_FAST;
      } else if (positionChange7Days < -10) {
        trend = MovementTrend.DEGRADING;
      } else {
        trend = MovementTrend.STABLE;
      }
    } else {
      trend = MovementTrend.STABLE;
    }

    const movementDescription =
      positionChange7Days !== null
        ? positionChange7Days > 0
          ? `Moved up ${positionChange7Days} position${positionChange7Days === 1 ? "" : "s"} this week`
          : positionChange7Days < 0
          ? `Moved back ${Math.abs(positionChange7Days)} position${Math.abs(positionChange7Days) === 1 ? "" : "s"} this week`
          : "Position unchanged this week"
        : "Position tracking started";

    const trendDescription = this.getTrendDescription(trend);

    return {
      positionChange7Days,
      positionChange30Days,
      percentileChange7Days,
      percentileChange30Days,
      trend,
      lastUpdated: current.calculatedAt,
      movementDescription,
      trendDescription,
    };
  }

  /**
   * Get historical timeline for visualization
   */
  async getHistoricalTimeline(
    userId: string,
    formType: string,
    daysBack: number = 90
  ): Promise<PositionSnapshot[]> {
    const cutoffDate = new Date(
      Date.now() - daysBack * 24 * 60 * 60 * 1000
    );

    try {
      const q = query(
        collection(db, this.collectionName, userId, "snapshots"),
        where("formType", "==", formType),
        where("calculatedAt", ">", Timestamp.fromDate(cutoffDate)),
        orderBy("calculatedAt", "asc")
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => this.parseSnapshot(d.id, d.data())).filter(Boolean) as PositionSnapshot[];
    } catch (e) {
      if (!this.isIndexError(e)) throw e;
      const fallback = query(
        collection(db, this.collectionName, userId, "snapshots"),
        where("formType", "==", formType)
      );
      const snapshot = await getDocs(fallback);
      const list = snapshot.docs
        .map((d) => this.parseSnapshot(d.id, d.data()))
        .filter(Boolean) as PositionSnapshot[];
      return list
        .filter((s) => s.calculatedAt > cutoffDate)
        .sort((a, b) => a.calculatedAt.getTime() - b.calculatedAt.getTime());
    }
  }

  private parseSnapshot(id: string, data: any): PositionSnapshot | null {
    if (!data.formType || !data.calculatedAt) {
      return null;
    }

    return {
      id,
      formType: data.formType,
      position: data.position ?? null,
      percentile: data.percentile ?? null,
      daysRemaining: data.daysRemaining ?? 0,
      currentPD: data.currentPD?.toDate() ?? null,
      calculatedAt: data.calculatedAt.toDate(),
    };
  }

  private getTrendDescription(trend: MovementTrend): string {
    switch (trend) {
      case MovementTrend.IMPROVING_FAST:
        return "Improving quickly";
      case MovementTrend.IMPROVING:
        return "Improving steadily";
      case MovementTrend.STABLE:
        return "Stable";
      case MovementTrend.DEGRADING:
        return "Slightly slower";
      case MovementTrend.DEGRADING_FAST:
        return "Processing slower";
    }
  }
}

export const positionHistoryService = new PositionHistoryService();
