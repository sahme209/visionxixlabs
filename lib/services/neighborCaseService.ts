import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { normalizeCountryForPause } from "../data/visaPauseCountries";
import { VisaPauseService } from "./visaPauseService";

export interface NeighborCase {
  priorityDate: Date;
  approvalDate: Date;
  country: string;
  serviceCenter?: string;
  processingDays: number;
  daysAgo: number; // Days since approval
}

export interface NeighborCaseSummary {
  thisWeek: number;
  lastWeek: number;
  trend: "accelerating" | "stable" | "decelerating";
  recentApprovals: NeighborCase[];
  userPosition: number | null; // Approximate position in queue
  isEstimated?: boolean; // true when using model-based data (no Firestore approvals)
}

/**
 * Neighbor Case Service - Track similar cases getting approved
 */
export class NeighborCaseService {
  private static readonly COLLECTION_APPROVALS = "i130Approvals";
  private static readonly SIMILARITY_WINDOW_DAYS = 30; // ±30 days from user's PD

  /**
   * Get neighbor cases (similar Priority Dates) that were recently approved
   */
  static async getNeighborCases(
    userPriorityDate: Date,
    userCountry: string,
    limitCount: number = 10
  ): Promise<NeighborCaseSummary> {
    const countryForQuery = normalizeCountryForPause(userCountry) ?? (userCountry.trim() || userCountry);

    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const pdStart = new Date(userPriorityDate);
      pdStart.setDate(pdStart.getDate() - this.SIMILARITY_WINDOW_DAYS);
      const pdEnd = new Date(userPriorityDate);
      pdEnd.setDate(pdEnd.getDate() + this.SIMILARITY_WINDOW_DAYS);

      const thisWeekApprovals = await this.getApprovalsInRange(
        sevenDaysAgo, now, countryForQuery, pdStart, pdEnd
      );
      const lastWeekApprovals = await this.getApprovalsInRange(
        fourteenDaysAgo, sevenDaysAgo, countryForQuery, pdStart, pdEnd
      );

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentApprovals = await this.getApprovalsInRange(
        thirtyDaysAgo, now, countryForQuery, pdStart, pdEnd, limitCount
      );

      const userPosition = await this.estimateUserPosition(
        userPriorityDate, countryForQuery, pdStart, pdEnd
      );

      const trend: "accelerating" | "stable" | "decelerating" =
        thisWeekApprovals.length > lastWeekApprovals.length
          ? "accelerating"
          : thisWeekApprovals.length === lastWeekApprovals.length
          ? "stable"
          : "decelerating";

      const hasRealData = thisWeekApprovals.length > 0 || lastWeekApprovals.length > 0 || recentApprovals.length > 0;

      if (hasRealData) {
        return {
          thisWeek: thisWeekApprovals.length,
          lastWeek: lastWeekApprovals.length,
          trend,
          recentApprovals: recentApprovals.map((a) => ({
            priorityDate: a.priorityDate,
            approvalDate: a.approvalDate,
            country: a.country,
            serviceCenter: a.serviceCenter,
            processingDays: a.processingDays,
            daysAgo: Math.floor((now.getTime() - a.approvalDate.getTime()) / (1000 * 60 * 60 * 24)),
          })),
          userPosition,
        };
      }

      return await this.buildModelBasedSummary(userPriorityDate, countryForQuery, now);
    } catch (error) {
      console.error("Error getting neighbor cases:", error);
      try {
        return await this.buildModelBasedSummary(userPriorityDate, countryForQuery, new Date());
      } catch (fallbackError) {
        return {
          thisWeek: 0,
          lastWeek: 0,
          trend: "stable",
          recentApprovals: [],
          userPosition: null,
        };
      }
    }
  }

  private static async buildModelBasedSummary(
    userPriorityDate: Date,
    country: string,
    now: Date
  ): Promise<NeighborCaseSummary> {
    const [metrics, countryData] = await Promise.all([
      VisaPauseService.getRecoveryMetrics(),
      VisaPauseService.getCountryRecoveryData(country),
    ]);

    const velocity = metrics.processingVelocity || 8;
    const thisWeek = Math.max(1, Math.round(velocity * 0.8 * 7 / 30));
    const lastWeek = Math.max(1, Math.round(velocity * 0.7 * 7 / 30));
    const trend: "accelerating" | "stable" | "decelerating" =
      metrics.weeklyChange > 0 ? "accelerating" : metrics.weeklyChange < 0 ? "decelerating" : "stable";

    const daysSincePD = Math.floor((now.getTime() - userPriorityDate.getTime()) / (1000 * 60 * 60 * 24));
    const typicalProcessing = countryData?.currentProcessingDays ?? 400;
    const estimatedPosition = Math.round(500 + (daysSincePD / typicalProcessing) * 800);

    const recentApprovals: NeighborCase[] = [];
    const baseProcessing = countryData?.currentProcessingDays ?? 390;
    const daysAgoList = [5, 12, 20];
    for (let i = 0; i < 3; i++) {
      const approvalDate = new Date(now);
      approvalDate.setDate(approvalDate.getDate() - daysAgoList[i]);
      const pd = new Date(approvalDate);
      pd.setDate(pd.getDate() - (baseProcessing + i * 10));
      recentApprovals.push({
        priorityDate: pd,
        approvalDate,
        country,
        processingDays: baseProcessing + i * 10,
        daysAgo: daysAgoList[i],
      });
    }

    return {
      thisWeek,
      lastWeek,
      trend,
      recentApprovals,
      userPosition: estimatedPosition > 0 ? estimatedPosition : null,
      isEstimated: true,
    };
  }

  /**
   * Get approvals in date range, filtered by country and Priority Date range
   */
  private static async getApprovalsInRange(
    approvalStart: Date,
    approvalEnd: Date,
    country: string,
    pdStart: Date,
    pdEnd: Date,
    limitCount?: number
  ): Promise<Array<{
    priorityDate: Date;
    approvalDate: Date;
    country: string;
    serviceCenter?: string;
    processingDays: number;
  }>> {
    try {
      let q = query(
        collection(db, this.COLLECTION_APPROVALS),
        where("beneficiaryCountry", "==", country),
        where("approvalDate", ">=", Timestamp.fromDate(approvalStart)),
        where("approvalDate", "<=", Timestamp.fromDate(approvalEnd)),
        orderBy("approvalDate", "desc")
      );

      if (limitCount) {
        q = query(q, limit(limitCount));
      }

      const snapshot = await getDocs(q);
      const approvals = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const pd = data.priorityDate?.toDate
            ? data.priorityDate.toDate()
            : new Date(data.priorityDate);
          const ad = data.approvalDate?.toDate
            ? data.approvalDate.toDate()
            : new Date(data.approvalDate);

          // Filter by Priority Date range
          if (pd < pdStart || pd > pdEnd) return null;

          const processingDays = Math.floor(
            (ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            priorityDate: pd,
            approvalDate: ad,
            country: data.beneficiaryCountry,
            serviceCenter: data.serviceCenter,
            processingDays,
          };
        })
        .filter((approval): approval is NonNullable<typeof approval> => approval !== null);

      return approvals;
    } catch (error) {
      console.error("Error fetching approvals in range:", error);
      return [];
    }
  }

  /**
   * Estimate user's approximate position in queue
   */
  private static async estimateUserPosition(
    userPriorityDate: Date,
    country: string,
    pdStart: Date,
    pdEnd: Date
  ): Promise<number | null> {
    try {
      // Get all pending cases (cases with PD before user's PD but not yet approved)
      // This is a simplified estimation
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Get approved cases with PD before user's PD
      const q = query(
        collection(db, this.COLLECTION_APPROVALS),
        where("beneficiaryCountry", "==", country),
        where("priorityDate", "<=", Timestamp.fromDate(userPriorityDate)),
        where("priorityDate", ">=", Timestamp.fromDate(oneYearAgo)),
        orderBy("priorityDate", "desc"),
        limit(1000)
      );

      const snapshot = await getDocs(q);
      const approvedBeforeUser = snapshot.docs.length;

      // Rough estimate: assume 10x multiplier for pending cases
      const estimatedPosition = approvedBeforeUser * 10;

      return estimatedPosition > 0 ? estimatedPosition : null;
    } catch (error) {
      console.error("Error estimating user position:", error);
      return null;
    }
  }
}
