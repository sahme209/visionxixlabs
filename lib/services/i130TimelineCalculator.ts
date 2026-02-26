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

/**
 * I-130 Timeline Calculator
 * Fetches approval data from Firestore and computes median processing times
 * Matches iOS I130TimelineCalculator functionality
 */

interface I130ApprovalData {
  id: string;
  formType: string;
  beneficiaryCountry: string;
  priorityDate: Date;
  approvalDate: Date;
  serviceCenter?: string;
  notes?: string;
  createdAt?: Date;
}

interface ProcessingStats {
  medianDays: number;
  p25Days: number;
  p75Days: number;
  sampleCount: number;
}

class I130TimelineCalculator {
  private static instance: I130TimelineCalculator;
  private approvalDataCache: I130ApprovalData[] = [];
  private cacheTimestamp: Date | null = null;
  private readonly cacheTTL = 3600 * 1000; // 1 hour in milliseconds
  private isLoadingData = false;

  // Aggregated stats cache
  private globalStats: ProcessingStats | null = null;
  private countryStats: Map<string, ProcessingStats> = new Map();
  private serviceCenterStats: Map<string, ProcessingStats> = new Map();
  private countryServiceCenterStats: Map<string, ProcessingStats> = new Map(); // Key: "country|serviceCenter"

  private constructor() {
    // Load data on initialization
    this.loadApprovalData();
  }

  static getInstance(): I130TimelineCalculator {
    if (!I130TimelineCalculator.instance) {
      I130TimelineCalculator.instance = new I130TimelineCalculator();
    }
    return I130TimelineCalculator.instance;
  }

  /**
   * Estimate USCIS Approval date from Priority Date
   * Returns: { estimatedDate, medianDays, sampleCount, source }
   */
  estimateApprovalDate(
    priorityDate: Date,
    country?: string,
    serviceCenter?: string
  ): {
    estimatedDate: Date;
    medianDays: number;
    sampleCount: number;
    source: string;
  } {
    const calendar = new Date();

    // Try most specific grouping first: country + service center
    if (country && serviceCenter) {
      const key = `${country}|${serviceCenter}`;
      const stats = this.countryServiceCenterStats.get(key);
      if (stats && stats.sampleCount >= 3) {
        const estimatedDate = new Date(priorityDate);
        estimatedDate.setDate(estimatedDate.getDate() + stats.medianDays);
        return {
          estimatedDate,
          medianDays: stats.medianDays,
          sampleCount: stats.sampleCount,
          source: `Country + Service Center (${country}, ${serviceCenter})`,
        };
      }
    }

    // Try country-specific stats
    if (country) {
      const stats = this.countryStats.get(country);
      if (stats && stats.sampleCount >= 5) {
        const estimatedDate = new Date(priorityDate);
        estimatedDate.setDate(estimatedDate.getDate() + stats.medianDays);
        return {
          estimatedDate,
          medianDays: stats.medianDays,
          sampleCount: stats.sampleCount,
          source: `Country-specific (${country})`,
        };
      }
    }

    // Try service center-specific stats
    if (serviceCenter) {
      const stats = this.serviceCenterStats.get(serviceCenter);
      if (stats && stats.sampleCount >= 5) {
        const estimatedDate = new Date(priorityDate);
        estimatedDate.setDate(estimatedDate.getDate() + stats.medianDays);
        return {
          estimatedDate,
          medianDays: stats.medianDays,
          sampleCount: stats.sampleCount,
          source: `Service Center-specific (${serviceCenter})`,
        };
      }
    }

    // Fallback to global stats
    if (this.globalStats && this.globalStats.sampleCount >= 3) {
      const estimatedDate = new Date(priorityDate);
      estimatedDate.setDate(estimatedDate.getDate() + this.globalStats.medianDays);
      return {
        estimatedDate,
        medianDays: this.globalStats.medianDays,
        sampleCount: this.globalStats.sampleCount,
        source: "Global (all cases)",
      };
    }

    // Final fallback: default median (400 days based on historical data)
    const defaultMedian = 400;
    const estimatedDate = new Date(priorityDate);
    estimatedDate.setDate(estimatedDate.getDate() + defaultMedian);
    return {
      estimatedDate,
      medianDays: defaultMedian,
      sampleCount: 0,
      source: "Default estimate",
    };
  }

  /**
   * Get processing statistics for a specific group
   */
  getProcessingStats(
    country?: string,
    serviceCenter?: string
  ): ProcessingStats | null {
    // Try most specific grouping first
    if (country && serviceCenter) {
      const key = `${country}|${serviceCenter}`;
      return this.countryServiceCenterStats.get(key) || null;
    }

    // Try country-specific
    if (country) {
      return this.countryStats.get(country) || null;
    }

    // Try service center-specific
    if (serviceCenter) {
      return this.serviceCenterStats.get(serviceCenter) || null;
    }

    // Return global stats
    return this.globalStats;
  }

  /**
   * Load approval data from Firestore
   */
  async loadApprovalData(): Promise<void> {
    // Only run on client side
    if (typeof window === "undefined") {
      console.log("[I130TimelineCalculator] Skipping load - server side");
      return;
    }

    // Prevent concurrent loads
    if (this.isLoadingData) return;
    this.isLoadingData = true;

    try {
      // Use cache if still valid
      if (
        this.cacheTimestamp &&
        Date.now() - this.cacheTimestamp.getTime() < this.cacheTTL &&
        this.approvalDataCache.length > 0
      ) {
        this.isLoadingData = false;
        return;
      }

      // Check if db is properly initialized
      if (!db || typeof db === "object" && Object.keys(db).length === 0) {
        console.warn("[I130TimelineCalculator] Firestore not initialized, skipping load");
        this.isLoadingData = false;
        return;
      }

      const snapshot = await getDocs(
        query(
          collection(db, "i130Approvals"),
          where("formType", "==", "I-130"),
          orderBy("createdAt", "desc"),
          limit(1000)
        )
      );

      this.approvalDataCache = snapshot.docs
        .map((doc) => this.decodeI130ApprovalData(doc.data(), doc.id))
        .filter((data): data is I130ApprovalData => data !== null);

      this.cacheTimestamp = new Date();

      // Recompute aggregated stats
      this.recomputeStats();

      console.log(
        `[I130TimelineCalculator] ✅ Loaded ${this.approvalDataCache.length} approval records`
      );
    } catch (error) {
      console.error(
        `[I130TimelineCalculator] ❌ Error loading approval data:`,
        error
      );
    } finally {
      this.isLoadingData = false;
    }
  }

  /**
   * Recompute aggregated statistics from cached data
   */
  private recomputeStats(): void {
    // Filter out non-standard cases (expedite, appeal, denial)
    const standardCases = this.approvalDataCache.filter(
      (record) => !this.isNonStandard(record)
    );

    // Global stats (all standard cases)
    const globalDurations = standardCases.map((record) => {
      const days =
        (record.approvalDate.getTime() - record.priorityDate.getTime()) /
        (1000 * 60 * 60 * 24);
      return Math.round(days);
    });
    this.globalStats = this.computeStats(globalDurations);

    // Country-specific stats
    this.countryStats.clear();
    const countryGroups = new Map<string, I130ApprovalData[]>();
    for (const record of standardCases) {
      const country = record.beneficiaryCountry;
      if (!countryGroups.has(country)) {
        countryGroups.set(country, []);
      }
      countryGroups.get(country)!.push(record);
    }

    for (const [country, cases] of countryGroups.entries()) {
      const durations = cases.map((record) => {
        const days =
          (record.approvalDate.getTime() - record.priorityDate.getTime()) /
          (1000 * 60 * 60 * 24);
        return Math.round(days);
      });
      if (durations.length >= 3) {
        this.countryStats.set(country, this.computeStats(durations));
      }
    }

    // Service center-specific stats
    this.serviceCenterStats.clear();
    const serviceCenterGroups = new Map<string, I130ApprovalData[]>();
    for (const record of standardCases) {
      const serviceCenter = record.serviceCenter || "Unknown";
      if (!serviceCenterGroups.has(serviceCenter)) {
        serviceCenterGroups.set(serviceCenter, []);
      }
      serviceCenterGroups.get(serviceCenter)!.push(record);
    }

    for (const [serviceCenter, cases] of serviceCenterGroups.entries()) {
      const durations = cases.map((record) => {
        const days =
          (record.approvalDate.getTime() - record.priorityDate.getTime()) /
          (1000 * 60 * 60 * 24);
        return Math.round(days);
      });
      if (durations.length >= 3) {
        this.serviceCenterStats.set(serviceCenter, this.computeStats(durations));
      }
    }

    // Country + Service Center combined stats
    this.countryServiceCenterStats.clear();
    const combinedGroups = new Map<string, I130ApprovalData[]>();
    for (const record of standardCases) {
      const country = record.beneficiaryCountry;
      const serviceCenter = record.serviceCenter || "Unknown";
      const key = `${country}|${serviceCenter}`;
      if (!combinedGroups.has(key)) {
        combinedGroups.set(key, []);
      }
      combinedGroups.get(key)!.push(record);
    }

    for (const [key, cases] of combinedGroups.entries()) {
      const durations = cases.map((record) => {
        const days =
          (record.approvalDate.getTime() - record.priorityDate.getTime()) /
          (1000 * 60 * 60 * 24);
        return Math.round(days);
      });
      if (durations.length >= 3) {
        this.countryServiceCenterStats.set(key, this.computeStats(durations));
      }
    }

    console.log(
      `[I130TimelineCalculator] ✅ Recomputed stats: Global(${this.globalStats?.sampleCount || 0}), Countries(${this.countryStats.size}), Service Centers(${this.serviceCenterStats.size}), Combined(${this.countryServiceCenterStats.size})`
    );
  }

  /**
   * Compute statistics from durations array
   */
  private computeStats(durations: number[]): ProcessingStats {
    if (durations.length === 0) {
      return {
        medianDays: 400,
        p25Days: 350,
        p75Days: 450,
        sampleCount: 0,
      };
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const count = sorted.length;

    const medianDays = sorted[Math.floor(count / 2)];
    const p25Days = sorted[Math.floor(count / 4)];
    const p75Days = sorted[Math.floor((count * 3) / 4)];

    return {
      medianDays,
      p25Days,
      p75Days,
      sampleCount: count,
    };
  }

  /**
   * Decode I130ApprovalData from Firestore document data
   */
  private decodeI130ApprovalData(
    data: any,
    id: string
  ): I130ApprovalData | null {
    if (
      !data.formType ||
      !data.priorityDate ||
      !data.approvalDate ||
      !data.beneficiaryCountry
    ) {
      return null;
    }

    const priorityDate =
      data.priorityDate instanceof Timestamp
        ? data.priorityDate.toDate()
        : data.priorityDate.toDate
        ? data.priorityDate.toDate()
        : new Date(data.priorityDate);

    const approvalDate =
      data.approvalDate instanceof Timestamp
        ? data.approvalDate.toDate()
        : data.approvalDate.toDate
        ? data.approvalDate.toDate()
        : new Date(data.approvalDate);

    const createdAt = data.createdAt
      ? data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt.toDate
        ? data.createdAt.toDate()
        : new Date(data.createdAt)
      : undefined;

    return {
      id,
      formType: data.formType,
      beneficiaryCountry: data.beneficiaryCountry,
      priorityDate,
      approvalDate,
      serviceCenter: data.serviceCenter,
      notes: data.notes,
      createdAt,
    };
  }

  /**
   * Check if a case is non-standard (expedite, appeal, denial)
   */
  private isNonStandard(record: I130ApprovalData): boolean {
    const notes = (record.notes || "").toLowerCase();
    return (
      notes.includes("expedite") ||
      notes.includes("appeal") ||
      notes.includes("denial") ||
      notes.includes("reopen")
    );
  }
}

export const i130TimelineCalculator = I130TimelineCalculator.getInstance();
