import { doc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ProcessingTimesData {
  bodyText: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  version: number | null;
}

/**
 * Service to observe current processing times from Firestore
 * Matches iOS CurrentProcessingTimesService.swift
 */
export class CurrentProcessingTimesService {
  private static instance: CurrentProcessingTimesService;
  private listener: Unsubscribe | null = null;
  private subscribers: Set<(data: ProcessingTimesData) => void> = new Set();
  private currentData: ProcessingTimesData = {
    bodyText: null,
    updatedAt: null,
    updatedBy: null,
    version: null,
  };

  private constructor() {
    // Don't initialize Firestore during module load (SSG)
    // Will be initialized when subscribe() is called (client-side only)
  }

  static getInstance(): CurrentProcessingTimesService {
    if (!CurrentProcessingTimesService.instance) {
      CurrentProcessingTimesService.instance = new CurrentProcessingTimesService();
    }
    return CurrentProcessingTimesService.instance;
  }

  /**
   * Observe the processing times document for real-time updates
   * Matches iOS observeProcessingTimes()
   */
  private observeProcessingTimes() {
    // Only initialize on client-side
    if (typeof window === "undefined") {
      console.log("[CurrentProcessingTimesService] Skipping - server-side");
      return;
    }

    // Check if db is properly initialized
    if (!db) {
      console.error("[CurrentProcessingTimesService] ❌ Firestore db not initialized");
      return;
    }

    // Clean up existing listener
    if (this.listener) {
      this.listener();
      this.listener = null;
    }

    const docRef = doc(db, "currentProcessingTimes", "global");
    console.log("[CurrentProcessingTimesService] 🔄 Setting up listener for currentProcessingTimes/global");

    this.listener = onSnapshot(
      docRef,
      (snapshot) => {
        console.log("[CurrentProcessingTimesService] 📥 Snapshot received:", {
          exists: snapshot.exists(),
          hasData: !!snapshot.data(),
        });

        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log("[CurrentProcessingTimesService] ✅ Data received:", {
            hasBodyText: !!data.bodyText,
            bodyTextLength: data.bodyText?.length || 0,
            updatedAt: data.updatedAt?.toDate()?.toISOString() || null,
            version: data.version,
          });

          this.currentData = {
            bodyText: data.bodyText || null,
            updatedAt: data.updatedAt?.toDate() || null,
            updatedBy: data.updatedBy || null,
            version: data.version || null,
          };
        } else {
          console.warn("[CurrentProcessingTimesService] ⚠️ Document does not exist: currentProcessingTimes/global");
          this.currentData = {
            bodyText: null,
            updatedAt: null,
            updatedBy: null,
            version: null,
          };
        }

        // Notify all subscribers
        this.subscribers.forEach((callback) => {
          try {
            callback(this.currentData);
          } catch (error) {
            console.error("[CurrentProcessingTimesService] Error in subscriber callback:", error);
          }
        });
      },
      (error) => {
        console.error("[CurrentProcessingTimesService] ❌ Error in onSnapshot:", error);
        console.error("[CurrentProcessingTimesService] Error code:", error.code);
        console.error("[CurrentProcessingTimesService] Error message:", error.message);
        
        // Try direct fetch as fallback
        this.fetchDirectly();
      }
    );
  }

  /**
   * Fallback: Direct fetch if listener fails
   */
  private async fetchDirectly() {
    if (typeof window === "undefined" || !db) {
      return;
    }

    try {
      console.log("[CurrentProcessingTimesService] 🔄 Attempting direct fetch...");
      const { getDoc } = await import("firebase/firestore");
      const docRef = doc(db, "currentProcessingTimes", "global");
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        this.currentData = {
          bodyText: data.bodyText || null,
          updatedAt: data.updatedAt?.toDate() || null,
          updatedBy: data.updatedBy || null,
          version: data.version || null,
        };
        console.log("[CurrentProcessingTimesService] ✅ Direct fetch successful");
        
        // Notify subscribers
        this.subscribers.forEach((callback) => {
          try {
            callback(this.currentData);
          } catch (error) {
            console.error("[CurrentProcessingTimesService] Error in subscriber callback:", error);
          }
        });
      } else {
        console.warn("[CurrentProcessingTimesService] ⚠️ Document not found in direct fetch");
      }
    } catch (error) {
      console.error("[CurrentProcessingTimesService] ❌ Direct fetch failed:", error);
    }
  }

  /**
   * Subscribe to processing times updates
   */
  subscribe(callback: (data: ProcessingTimesData) => void): () => void {
    this.subscribers.add(callback);
    
    // Immediately call with current data
    try {
      callback(this.currentData);
    } catch (error) {
      console.error("[CurrentProcessingTimesService] Error in initial callback:", error);
    }

    // Start observing if not already started (client-side only)
    if (typeof window !== "undefined") {
      if (!this.listener) {
        console.log("[CurrentProcessingTimesService] 🚀 Starting observation...");
        this.observeProcessingTimes();
      } else {
        console.log("[CurrentProcessingTimesService] ℹ️ Listener already active");
      }
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      console.log("[CurrentProcessingTimesService] 👋 Subscriber removed, remaining:", this.subscribers.size);
    };
  }

  /**
   * Get current data synchronously
   */
  getCurrentData(): ProcessingTimesData {
    return this.currentData;
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.listener) {
      this.listener();
      this.listener = null;
    }
    this.subscribers.clear();
  }
}

// Export singleton instance
export const currentProcessingTimesService = CurrentProcessingTimesService.getInstance();
