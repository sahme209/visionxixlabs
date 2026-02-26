// Cases Added Per Date Service - Web Implementation
// Fetches cases added per date for chart display

import { db } from "@/lib/firebase";
import { collection, collectionGroup, query, where, getDocs, Timestamp, orderBy, limit, QueryDocumentSnapshot } from "firebase/firestore";

export interface CasesAddedDataPoint {
  date: Date;
  count: number;
  dateString: string;
  displayDate: string;
  fullDisplayDate: string;
}

class CasesAddedPerDateService {
  /**
   * Get cases added per date for a specific form type
   * Includes BOTH backend (admin-fed) and frontend (user-submitted) cases
   */
  async getCasesAddedPerDate(
    formType: "I-130" | "I-129F",
    daysBack: number = 90
  ): Promise<CasesAddedDataPoint[]> {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysBack);

    const casesByDate: Record<string, number> = {};
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    try {
      // 1. Query BACKEND cases (admin-fed) from i130Approvals/i129fApprovals
      // Use composite index: formType + createdAt (desc), filter by date in memory
      let backendSnapshot;
      try {
        const backendQuery = query(
          collection(db, collectionName),
          where("formType", "==", formType),
          orderBy("createdAt", "desc"),
          limit(2000)
        );
        const allDocs = await getDocs(backendQuery);
        // Filter by date in memory
        backendSnapshot = {
          docs: allDocs.docs.filter((doc: QueryDocumentSnapshot) => {
            const data = doc.data();
            const createdAt = data.createdAt as Timestamp | undefined;
            if (createdAt) {
              return createdAt.toDate() > startDate;
            }
            return false;
          }),
        } as any;
      } catch (error: any) {
        // Handle index errors - try without orderBy and filter in memory
        if (error?.code === "failed-precondition" || error?.message?.includes("index")) {
          try {
            const fallbackQuery = query(
              collection(db, collectionName),
              where("formType", "==", formType),
              limit(2000)
            );
            const allDocs = await getDocs(fallbackQuery);
            // Filter by date in memory and sort by createdAt desc
            const filtered = allDocs.docs.filter((doc: QueryDocumentSnapshot) => {
              const data = doc.data();
              const createdAt = data.createdAt as Timestamp | undefined;
              if (createdAt) {
                return createdAt.toDate() > startDate;
              }
              return false;
            });
            filtered.sort((a, b) => {
              const aCreated = a.data().createdAt as Timestamp | undefined;
              const bCreated = b.data().createdAt as Timestamp | undefined;
              if (!aCreated || !bCreated) return 0;
              return bCreated.toDate().getTime() - aCreated.toDate().getTime();
            });
            backendSnapshot = { docs: filtered } as any;
          } catch (fallbackError: any) {
            // If fallback also fails (likely permissions), skip backend cases
            console.warn("[CasesAddedPerDateService] Fallback query failed, skipping backend cases:", fallbackError?.message);
            backendSnapshot = { docs: [] } as any;
          }
        } else if (error?.code === "permission-denied" || error?.message?.includes("permission") || error?.message?.includes("PERMISSION_DENIED")) {
          // Handle permission errors gracefully - skip backend cases (expected behavior)
          console.debug("[CasesAddedPerDateService] Permission denied for backend cases, using user data only");
          backendSnapshot = { docs: [] } as any;
        } else {
          // For other errors, log and skip backend cases
          console.warn("[CasesAddedPerDateService] Error querying backend cases, skipping:", error?.message);
          backendSnapshot = { docs: [] } as any;
        }
      }

      backendSnapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
        const data = doc.data();
        const createdAt = data.createdAt as Timestamp | undefined;

        if (createdAt) {
          const createdAtDate = createdAt.toDate();
          const dateString = dateFormatter.format(createdAtDate).replace(/\//g, "-");
          casesByDate[dateString] = (casesByDate[dateString] || 0) + 1;
        }
      });

      // 2. Query FRONTEND cases (user-submitted) from userCases collection
      // Use collectionGroup to query all "cases" subcollections across all users
      let userCasesSnapshot;
      try {
        const userCasesQuery = query(
          collectionGroup(db, "cases"),
          where("formType", "==", formType),
          where("lastUpdated", ">", Timestamp.fromDate(startDate))
        );
        userCasesSnapshot = await getDocs(userCasesQuery);
      } catch (error: any) {
        // Handle index errors - try without lastUpdated filter and filter in memory
        if (error?.code === "failed-precondition" || error?.message?.includes("index")) {
          try {
            const fallbackQuery = query(
              collectionGroup(db, "cases"),
              where("formType", "==", formType)
            );
            const allDocs = await getDocs(fallbackQuery);
            // Filter by date in memory
            userCasesSnapshot = {
              docs: allDocs.docs.filter((doc: QueryDocumentSnapshot) => {
                const data = doc.data();
                const lastUpdated = data.lastUpdated as Timestamp | undefined;
                if (lastUpdated) {
                  return lastUpdated.toDate() > startDate;
                }
                return false;
              }),
            } as any;
          } catch (fallbackError: any) {
            // If fallback also fails (likely permissions), skip user cases
            console.warn("[CasesAddedPerDateService] Fallback query failed, skipping user cases:", fallbackError?.message);
            userCasesSnapshot = { docs: [] } as any;
          }
        } else if (error?.code === "permission-denied" || error?.message?.includes("permission") || error?.message?.includes("PERMISSION_DENIED")) {
          // Handle permission errors gracefully - skip user cases (expected behavior)
          console.debug("[CasesAddedPerDateService] Permission denied for userCases, using backend data only");
          userCasesSnapshot = { docs: [] } as any;
        } else {
          // For other errors, log and skip user cases
          console.warn("[CasesAddedPerDateService] Error querying userCases, skipping:", error?.message);
          userCasesSnapshot = { docs: [] } as any;
        }
      }

      userCasesSnapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
        const data = doc.data();
        const lastUpdated = data.lastUpdated as Timestamp | undefined;

        if (lastUpdated) {
          const lastUpdatedDate = lastUpdated.toDate();
          const dateString = dateFormatter.format(lastUpdatedDate).replace(/\//g, "-");
          casesByDate[dateString] = (casesByDate[dateString] || 0) + 1;
        }
      });

      // Create data points for all days in range (including zeros)
      const result: CasesAddedDataPoint[] = [];
      for (let dayOffset = 0; dayOffset < daysBack; dayOffset++) {
        const date = new Date(today);
        date.setDate(date.getDate() - dayOffset);
        const dateString = dateFormatter.format(date).replace(/\//g, "-");
        const count = casesByDate[dateString] || 0;

        const displayFormatter = new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        });
        const fullDisplayFormatter = new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

        result.push({
          date,
          count,
          dateString,
          displayDate: displayFormatter.format(date),
          fullDisplayDate: fullDisplayFormatter.format(date),
        });
      }

      // Sort by date (oldest first)
      return result.sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      console.error("[CasesAddedPerDateService] Error fetching cases:", error);
      // Return partial data if backend query succeeded but userCases failed
      if (Object.keys(casesByDate).length > 0) {
        const result: CasesAddedDataPoint[] = [];
        for (let dayOffset = 0; dayOffset < daysBack; dayOffset++) {
          const date = new Date(today);
          date.setDate(date.getDate() - dayOffset);
          const dateString = dateFormatter.format(date).replace(/\//g, "-");
          const count = casesByDate[dateString] || 0;

          const displayFormatter = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
          });
          const fullDisplayFormatter = new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });

          result.push({
            date,
            count,
            dateString,
            displayDate: displayFormatter.format(date),
            fullDisplayDate: fullDisplayFormatter.format(date),
          });
        }
        return result.sort((a, b) => a.date.getTime() - b.date.getTime());
      }
      return [];
    }
  }

  /**
   * Get combined data for both I-130 and I-129F
   */
  async getCombinedCasesAddedPerDate(
    daysBack: number = 90
  ): Promise<CasesAddedDataPoint[]> {
    const [i130Data, i129fData] = await Promise.all([
      this.getCasesAddedPerDate("I-130", daysBack),
      this.getCasesAddedPerDate("I-129F", daysBack),
    ]);

    // Combine counts by date
    const combined: Record<string, CasesAddedDataPoint> = {};
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    // Add I-130 data
    i130Data.forEach((point) => {
      const key = point.dateString;
      if (!combined[key]) {
        combined[key] = {
          ...point,
          count: 0,
        };
      }
      combined[key].count += point.count;
    });

    // Add I-129F data
    i129fData.forEach((point) => {
      const key = point.dateString;
      if (!combined[key]) {
        combined[key] = {
          ...point,
          count: 0,
        };
      }
      combined[key].count += point.count;
    });

    return Object.values(combined).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }
}

export const casesAddedPerDateService = new CasesAddedPerDateService();
