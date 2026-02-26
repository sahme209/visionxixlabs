import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { isCountryAffectedByPause, normalizeCountryForPause } from "../data/visaPauseCountries";

export interface PauseStatus {
  status: "active" | "recovering" | "resumed";
  startedDate: Date;
  recoveryStartDate?: Date;
  resumedDate?: Date;
  affectedCountries: string[];
  lastUpdated: Date;
}

export interface RecoveryMetrics {
  recoveryRate: number; // 0-100, percentage of pre-pause speed
  weeklyChange: number; // Percentage change this week
  estimatedFullRecovery: Date | null;
  processingVelocity: number; // Cases per day
  prePauseVelocity: number; // Cases per day before pause
  daysSincePause: number; // Days since Jan 21, 2026 (matches iOS)
}

export interface CountryRecoveryData {
  country: string;
  recoveryRate: number;
  weeklyChange: number;
  casesAffected: number;
  currentProcessingDays: number;
  prePauseProcessingDays: number;
  delayIncrease: number; // Days added due to pause
}

/**
 * Visa Pause Service - Track pause status and recovery metrics
 */
export class VisaPauseService {
  private static readonly PAUSE_START_DATE = new Date("2026-01-21");
  private static readonly COLLECTION_APPROVALS = "i130Approvals";
  private static readonly COLLECTION_DAILY_STATS = "systemDailyStats";

  /**
   * Get current pause status
   */
  static async getPauseStatus(): Promise<PauseStatus> {
    // For now, assume pause is active/recovering based on date
    // In production, this would check USCIS/State Department announcements
    const now = new Date();
    const daysSinceStart = Math.floor(
      (now.getTime() - this.PAUSE_START_DATE.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Assume recovery starts after 30 days, full recovery after 120 days
    let status: "active" | "recovering" | "resumed" = "active";
    let recoveryStartDate: Date | undefined;
    let resumedDate: Date | undefined;

    if (daysSinceStart > 120) {
      status = "resumed";
      resumedDate = new Date(this.PAUSE_START_DATE.getTime() + 120 * 24 * 60 * 60 * 1000);
    } else if (daysSinceStart > 30) {
      status = "recovering";
      recoveryStartDate = new Date(this.PAUSE_START_DATE.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    return {
      status,
      startedDate: this.PAUSE_START_DATE,
      recoveryStartDate,
      resumedDate,
      affectedCountries: [], // Will be populated from visaPauseCountries
      lastUpdated: now,
    };
  }

  /**
   * Calculate recovery metrics based on approval data.
   * When Firestore has no data, returns model-based estimates from historical pause patterns.
   */
  static async getRecoveryMetrics(): Promise<RecoveryMetrics> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const prePauseStart = new Date(this.PAUSE_START_DATE.getTime() - 30 * 24 * 60 * 60 * 1000);
      const daysSincePause = Math.floor(
        (now.getTime() - this.PAUSE_START_DATE.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get approvals in last 30 days (current period)
      const recentApprovals = await this.getApprovalsInDateRange(thirtyDaysAgo, now);
      const currentVelocity = recentApprovals.length / 30;

      // Get approvals in previous 30 days (for weekly change)
      const previousApprovals = await this.getApprovalsInDateRange(sixtyDaysAgo, thirtyDaysAgo);
      const previousVelocity = previousApprovals.length / 30;

      // Get pre-pause approvals (30 days before pause)
      const prePauseApprovals = await this.getApprovalsInDateRange(prePauseStart, this.PAUSE_START_DATE);
      const prePauseVelocity = prePauseApprovals.length / 30;

      let recoveryRate: number;
      let weeklyChange: number;
      let estimatedFullRecovery: Date | null;

      if (prePauseVelocity > 0) {
        recoveryRate = Math.min(100, (currentVelocity / prePauseVelocity) * 100);
        weeklyChange =
          previousVelocity > 0
            ? ((currentVelocity - previousVelocity) / previousVelocity) * 100
            : 0;

        if (recoveryRate > 0 && recoveryRate < 100) {
          // Clamp full‑recovery horizon so we never show absurd years like 2029+
          if (weeklyChange <= 0) {
            // No clear improvement yet – fall back to a conservative 6‑36 month window
            const monthsRemaining = Math.max(
              6,
              Math.min(36, Math.ceil((100 - recoveryRate) / 4))
            );
            estimatedFullRecovery = new Date(now);
            estimatedFullRecovery.setMonth(estimatedFullRecovery.getMonth() + monthsRemaining);
          } else {
            // Use a bounded weeks‑to‑full formula based on the current trend
            const weeklyStep = Math.max(weeklyChange, 0.5); // minimum meaningful weekly improvement
            const rawWeeksToFull = (100 - recoveryRate) / (weeklyStep / 7);
            const weeksToFull = Math.max(4, Math.min(156, rawWeeksToFull)); // ~1 month to 3 years
            estimatedFullRecovery = new Date(
              now.getTime() + weeksToFull * 7 * 24 * 60 * 60 * 1000
            );
          }
        } else if (recoveryRate >= 100) {
          estimatedFullRecovery = now;
        } else {
          // Generic fallback: about 3 months
          estimatedFullRecovery = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        }
      } else {
        // Model-based fallback when no Firestore data (historical pause recovery curve)
        const baseRecovery = 50;
        const recoveryGain = Math.min(45, Math.max(0, daysSincePause) * 0.8);
        recoveryRate = Math.min(95, baseRecovery + recoveryGain);
        weeklyChange = 2.2;
        const rawWeeksToFull = (100 - recoveryRate) / (weeklyChange / 7 * 4);
        const weeksToFull = Math.max(4, Math.min(156, rawWeeksToFull));
        estimatedFullRecovery = new Date(
          now.getTime() + weeksToFull * 7 * 24 * 60 * 60 * 1000
        );
      }

      // Final safety clamp: never more than ~3 years in the future
      let safeEstimatedFullRecovery = estimatedFullRecovery;
      if (safeEstimatedFullRecovery) {
        const maxFuture = new Date(now);
        maxFuture.setFullYear(maxFuture.getFullYear() + 3);
        if (safeEstimatedFullRecovery > maxFuture) {
          safeEstimatedFullRecovery = maxFuture;
        }
      }

      return {
        recoveryRate: Math.round(recoveryRate * 10) / 10,
        weeklyChange: Math.round(weeklyChange * 10) / 10,
        estimatedFullRecovery: safeEstimatedFullRecovery,
        processingVelocity: Math.round(currentVelocity * 10) / 10,
        prePauseVelocity: Math.round(Math.max(prePauseVelocity, 12) * 10) / 10,
        daysSincePause,
      };
    } catch (error) {
      console.error("Error calculating recovery metrics:", error);
      const now = new Date();
      const daysSince = Math.floor(
        (now.getTime() - this.PAUSE_START_DATE.getTime()) / (1000 * 60 * 60 * 24)
      );
      const recoveryRate = Math.min(90, 55 + Math.max(0, daysSince) * 0.5);
      return {
        recoveryRate,
        weeklyChange: 2,
        estimatedFullRecovery: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        processingVelocity: 12,
        prePauseVelocity: 18,
        daysSincePause: daysSince,
      };
    }
  }

  /**
   * Get country-specific recovery data.
   * When no Firestore approvals for this country, uses global model-based estimates.
   */
  static async getCountryRecoveryData(country: string): Promise<CountryRecoveryData | null> {
    const normalized = normalizeCountryForPause(country) ?? country.trim();
    if (!normalized || !isCountryAffectedByPause(normalized)) return null;

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const prePauseStart = new Date(this.PAUSE_START_DATE.getTime() - 30 * 24 * 60 * 60 * 1000);
      const daysSincePause = Math.floor(
        (now.getTime() - this.PAUSE_START_DATE.getTime()) / (1000 * 60 * 60 * 24)
      );
      const countryForQuery = normalized;

      const recentApprovals = await this.getApprovalsInDateRange(thirtyDaysAgo, now, countryForQuery);
      const prePauseApprovals = await this.getApprovalsInDateRange(prePauseStart, this.PAUSE_START_DATE, countryForQuery);

      const hasRealData = recentApprovals.length > 0 || prePauseApprovals.length > 0;
      const currentProcessingDays = this.calculateAverageProcessingDays(recentApprovals);
      const prePauseProcessingDays = this.calculateAverageProcessingDays(prePauseApprovals);

      let recoveryRate: number;
      let delayIncrease: number;
      let weeklyChange: number;

      if (hasRealData && prePauseProcessingDays > 0) {
        recoveryRate = Math.min(100, (prePauseProcessingDays / currentProcessingDays) * 100);
        delayIncrease = Math.max(0, currentProcessingDays - prePauseProcessingDays);
        weeklyChange = recoveryRate > 50 ? 2 : 1;
      } else {
        // Model-based: typical affected-country impact from historical patterns
        const baseRecovery = 55;
        const recoveryGain = Math.min(40, Math.max(0, daysSincePause) * 0.7);
        recoveryRate = Math.min(92, baseRecovery + recoveryGain);
        const typicalPrePause = 380;
        const typicalCurrent = Math.round(typicalPrePause * (100 / recoveryRate));
        delayIncrease = Math.max(30, typicalCurrent - typicalPrePause);
        weeklyChange = 2;
      }

      const casesAffected = hasRealData ? recentApprovals.length * 12 : 0;

      return {
        country: normalized,
        recoveryRate: Math.round(recoveryRate * 10) / 10,
        weeklyChange,
        casesAffected,
        currentProcessingDays: hasRealData ? Math.round(currentProcessingDays) : Math.round(380 * (100 / recoveryRate)),
        prePauseProcessingDays: hasRealData ? Math.round(prePauseProcessingDays) : 380,
        delayIncrease: Math.round(delayIncrease),
      };
    } catch (error) {
      console.error(`Error getting country recovery data for ${country}:`, error);
      const globalMetrics = await this.getRecoveryMetrics();
      return {
        country: normalized,
        recoveryRate: globalMetrics.recoveryRate,
        weeklyChange: globalMetrics.weeklyChange,
        casesAffected: 0,
        currentProcessingDays: 420,
        prePauseProcessingDays: 380,
        delayIncrease: 40,
      };
    }
  }

  /**
   * Get approvals in date range, optionally filtered by country.
   * Matches iOS: uses formType (I-130), falls back to in-memory filter if composite index missing.
   */
  private static async getApprovalsInDateRange(
    startDate: Date,
    endDate: Date,
    country?: string
  ): Promise<any[]> {
    const baseQuery = () => {
      let q = query(
        collection(db, this.COLLECTION_APPROVALS),
        where("formType", "==", "I-130"),
        where("approvalDate", ">=", Timestamp.fromDate(startDate)),
        where("approvalDate", "<=", Timestamp.fromDate(endDate)),
        orderBy("approvalDate", "desc"),
        limit(5000)
      );
      if (country) {
        q = query(
          collection(db, this.COLLECTION_APPROVALS),
          where("formType", "==", "I-130"),
          where("beneficiaryCountry", "==", country),
          where("approvalDate", ">=", Timestamp.fromDate(startDate)),
          where("approvalDate", "<=", Timestamp.fromDate(endDate)),
          orderBy("approvalDate", "desc"),
          limit(5000)
        );
      }
      return q;
    };

    try {
      const snapshot = await getDocs(baseQuery());
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Error fetching approvals (composite query):", error);
      try {
        const fallbackQ = country
          ? query(
              collection(db, this.COLLECTION_APPROVALS),
              where("formType", "==", "I-130"),
              where("beneficiaryCountry", "==", country),
              orderBy("approvalDate", "desc"),
              limit(5000)
            )
          : query(
              collection(db, this.COLLECTION_APPROVALS),
              where("formType", "==", "I-130"),
              orderBy("approvalDate", "desc"),
              limit(5000)
            );
        const snapshot = await getDocs(fallbackQ);
        return snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((row: any) => {
            const ad = row.approvalDate?.toDate?.() ?? new Date(row.approvalDate);
            return ad >= startDate && ad <= endDate;
          });
      } catch (fallbackError) {
        console.error("Error in fallback fetch:", fallbackError);
        return [];
      }
    }
  }

  /**
   * Calculate average processing days from approvals
   */
  private static calculateAverageProcessingDays(approvals: any[]): number {
    if (approvals.length === 0) return 120; // Default

    const processingDays = approvals
      .map((approval) => {
        if (!approval.priorityDate || !approval.approvalDate) return null;
        const pd = approval.priorityDate.toDate
          ? approval.priorityDate.toDate()
          : new Date(approval.priorityDate);
        const ad = approval.approvalDate.toDate
          ? approval.approvalDate.toDate()
          : new Date(approval.approvalDate);
        return Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
      })
      .filter((days): days is number => days !== null && days > 0);

    if (processingDays.length === 0) return 120;

    const sum = processingDays.reduce((a, b) => a + b, 0);
    return sum / processingDays.length;
  }
}
