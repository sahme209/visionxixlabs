"use client";

import { collection, doc, getDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface EmbassyTiming {
  countryName: string;
  countryCode?: string;
  embassyCity?: string;
  minDays: number;
  maxDays: number;
  medianDays: number;
  sourceNote?: string;
  updatedAt: Date;
}

interface EmbassyTimingCache {
  [key: string]: EmbassyTiming;
}

class I130EmbassyTimingService {
  private static instance: I130EmbassyTimingService;
  private timingCache: EmbassyTimingCache = {};
  private listeners: Map<string, Unsubscribe> = new Map();
  private cacheTimestamp: Date | null = null;
  private readonly cacheTTL = 3600000; // 1 hour in milliseconds

  private constructor() {
    this.setupFirestoreListener();
  }

  static getInstance(): I130EmbassyTimingService {
    if (!I130EmbassyTimingService.instance) {
      I130EmbassyTimingService.instance = new I130EmbassyTimingService();
    }
    return I130EmbassyTimingService.instance;
  }

  /**
   * Normalize country name for cache key
   */
  private normalizeCountryName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, "_");
  }

  /**
   * Parse timing from Firestore document data
   */
  private parseTiming(data: any, docId: string): EmbassyTiming | null {
    if (!data.countryName || !data.minDays || !data.maxDays) {
      console.warn(`[I130EmbassyTiming] Missing required fields in document ${docId}`);
      return null;
    }

    // Validate range
    if (data.minDays <= 0 || data.maxDays <= 0 || data.minDays > data.maxDays) {
      console.warn(`[I130EmbassyTiming] Invalid minDays/maxDays in document ${docId}`);
      return null;
    }

    const medianDays = data.medianDays || Math.floor((data.minDays + data.maxDays) / 2);
    const updatedAt = data.updatedAt?.toDate?.() || new Date();

    return {
      countryName: data.countryName,
      countryCode: data.countryCode,
      embassyCity: data.embassyCity,
      minDays: data.minDays,
      maxDays: data.maxDays,
      medianDays,
      sourceNote: data.sourceNote,
      updatedAt,
    };
  }

  /**
   * Set up Firestore snapshot listener for the entire collection
   */
  private setupFirestoreListener(): void {
    const listener = onSnapshot(
      collection(db, "i130EmbassyTiming"),
      (snapshot) => {
        snapshot.forEach((document) => {
          const docId = document.id;
          const data = document.data();
          const timing = this.parseTiming(data, docId);

          if (timing) {
            // Store by countryCode if available
            if (timing.countryCode) {
              this.timingCache[timing.countryCode.toUpperCase()] = timing;
            }

            // Also store by normalized country name
            const normalizedName = this.normalizeCountryName(timing.countryName);
            this.timingCache[normalizedName] = timing;

            // Store by docId as well (for global, etc.)
            this.timingCache[docId] = timing;

            this.cacheTimestamp = new Date();
            console.log(
              `[I130EmbassyTiming] ✅ Updated cache for ${docId}: ${timing.countryName} (${timing.minDays}-${timing.maxDays} days)`
            );
          }
        });
      },
      (error) => {
        console.error(`[I130EmbassyTiming] ❌ Listener error:`, error);
      }
    );

    this.listeners.set("collection", listener);
  }

  /**
   * Fetch timing for a specific document ID
   */
  private async fetchTiming(docId: string): Promise<void> {
    try {
      const docRef = doc(db, "i130EmbassyTiming", docId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.warn(`[I130EmbassyTiming] ⚠️ No data for ${docId}`);
        return;
      }

      const timing = this.parseTiming(docSnap.data(), docId);
      if (timing) {
        // Store by countryCode if available
        if (timing.countryCode) {
          this.timingCache[timing.countryCode.toUpperCase()] = timing;
        }

        // Also store by normalized country name
        const normalizedName = this.normalizeCountryName(timing.countryName);
        this.timingCache[normalizedName] = timing;

        // Store by docId
        this.timingCache[docId] = timing;

        this.cacheTimestamp = new Date();
        console.log(`[I130EmbassyTiming] ✅ Fetched timing for ${docId}: ${timing.countryName}`);
      }
    } catch (error) {
      console.error(`[I130EmbassyTiming] ❌ Error fetching ${docId}:`, error);
    }
  }

  /**
   * Get cached timing for a country
   */
  private getCachedTiming(key: string): EmbassyTiming | undefined {
    // Check cache validity
    if (this.cacheTimestamp && Date.now() - this.cacheTimestamp.getTime() < this.cacheTTL) {
      return this.timingCache[key];
    }

    // Cache expired - return cached value anyway (better than nothing)
    return this.timingCache[key];
  }

  /**
   * Get timing with fallback chain: countryCode -> countryName -> global -> default
   * Matches iOS I130EmbassyTimingService.getTimingWithFallback
   */
  getTimingWithFallback(countryCode?: string, countryName?: string): {
    timing: EmbassyTiming;
    source: string;
  } {
    // Try countryCode first
    if (countryCode) {
      const upperCode = countryCode.toUpperCase();
      const timing = this.getCachedTiming(upperCode);
      if (timing) {
        const countryLabel = countryName || countryCode;
        return { timing, source: `Based on ${countryLabel} embassy timing` };
      }
    }

    // Try normalized country name
    if (countryName) {
      const normalized = this.normalizeCountryName(countryName);
      const timing = this.getCachedTiming(normalized);
      if (timing) {
        return { timing, source: `Based on ${countryName} embassy timing` };
      }
    }

    // Try global fallback
    const globalTiming = this.getCachedTiming("global");
    if (globalTiming) {
      return { timing: globalTiming, source: "Based on global timing" };
    }

    // Final fallback: conservative default (matches iOS default)
    const defaultTiming: EmbassyTiming = {
      countryName: countryName || "Unknown",
      countryCode,
      embassyCity: undefined,
      minDays: 90,
      maxDays: 180,
      medianDays: 135,
      sourceNote: "Default estimate",
      updatedAt: new Date(),
    };
    return { timing: defaultTiming, source: "Based on default timing" };
  }

  /**
   * Load initial data from Firestore
   */
  async loadInitialData(): Promise<void> {
    // Load global timing
    await this.fetchTiming("global");

    // Load common countries
    const commonCountries = ["PK", "IN", "CN", "MX", "PH", "VN", "NG", "GB", "CA"];
    for (const countryCode of commonCountries) {
      await this.fetchTiming(countryCode);
    }

    console.log("[I130EmbassyTiming] ✅ Initial data load complete");
  }

  /**
   * Clean up listeners
   */
  removeListeners(): void {
    for (const [, listener] of this.listeners) {
      listener();
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const embassyTimingService = I130EmbassyTimingService.getInstance();
