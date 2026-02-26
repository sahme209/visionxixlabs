/**
 * Service to fetch embassy wait times from U.S. State Department website
 * Uses Next.js API route to avoid CORS issues
 */

interface EmbassyWaitTime {
  city: string;
  b1b2WaitTimeMonths?: number;
  b1b2NextAvailableMonths?: number;
  fMjNextAvailableMonths?: number;
  petitionBasedNextAvailableMonths?: number;
  crewTransitNextAvailableMonths?: number;
  i129fWaitTimeDays?: number;
}

class StateDepartmentWaitTimeService {
  private static instance: StateDepartmentWaitTimeService;
  private cache: Map<string, EmbassyWaitTime> = new Map();
  private cacheTimestamp: Date | null = null;
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  private constructor() {}

  static getInstance(): StateDepartmentWaitTimeService {
    if (!StateDepartmentWaitTimeService.instance) {
      StateDepartmentWaitTimeService.instance = new StateDepartmentWaitTimeService();
    }
    return StateDepartmentWaitTimeService.instance;
  }

  /**
   * Get wait time for a specific embassy/city
   * @param embassy Embassy name (e.g., "London, UK" or "London")
   * @returns Wait time in days for I-129F visa category, or null if not found
   */
  async getWaitTime(embassy: string): Promise<number | null> {
    // Extract city name (e.g., "London, UK" -> "London")
    const city = embassy.includes(",") ? embassy.split(",")[0].trim() : embassy.trim();

    // Check cache
    if (this.cacheTimestamp && Date.now() - this.cacheTimestamp.getTime() < this.CACHE_TTL) {
      const cached = this.cache.get(city.toLowerCase());
      if (cached?.i129fWaitTimeDays) {
        return cached.i129fWaitTimeDays;
      }
      // Try fuzzy match
      for (const [cachedCity, waitTime] of this.cache.entries()) {
        if (
          city.toLowerCase().includes(cachedCity) ||
          cachedCity.includes(city.toLowerCase())
        ) {
          if (waitTime.i129fWaitTimeDays) {
            return waitTime.i129fWaitTimeDays;
          }
        }
      }
    }

    try {
      // Fetch from API route
      const response = await fetch(`/api/embassy-wait-times?city=${encodeURIComponent(city)}`);

      if (!response.ok) {
        console.error(`[StateDeptWaitTime] Failed to fetch: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (data.waitTime) {
        // Update cache
        this.cache.set(city.toLowerCase(), data.waitTime);
        this.cacheTimestamp = new Date();

        return data.waitTime.i129fWaitTimeDays || null;
      }

      return null;
    } catch (error) {
      console.error("[StateDeptWaitTime] Error fetching wait time:", error);
      return null;
    }
  }

  /**
   * Load all wait times (for dropdown/listing purposes)
   */
  async loadAllWaitTimes(): Promise<EmbassyWaitTime[]> {
    try {
      const response = await fetch("/api/embassy-wait-times");

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      if (data.waitTimes && Array.isArray(data.waitTimes)) {
        // Update cache
        this.cache.clear();
        for (const wt of data.waitTimes) {
          this.cache.set(wt.city.toLowerCase(), wt);
        }
        this.cacheTimestamp = new Date();

        return data.waitTimes;
      }

      return [];
    } catch (error) {
      console.error("[StateDeptWaitTime] Error loading all wait times:", error);
      return [];
    }
  }
}

export const stateDepartmentWaitTimeService = StateDepartmentWaitTimeService.getInstance();
