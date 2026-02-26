import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import {
  SystemDailyStats,
  SystemMonthlyStats,
  SystemCoverage,
  TrendsData,
  PDStats,
  RFEStats,
  CalendarApprovals,
  ScopeBuilder,
  buildScopeId,
  scopeFromProfile,
  ApprovalData,
  ServiceCenterStats,
  BacklogByCenterEntry,
  ProcessingTimeDistribution,
  WeeklyApprovalData,
  ApprovalTrendSummary,
  I130ApprovalData,
  I129FApprovalData,
  ApprovalOdds,
  TimelineEstimate,
  QueuePosition,
  NeighborComparison,
} from "./types";

// Build identifier to verify the active statsService bundle in the browser
export const STATS_SERVICE_BUILD_ID = "2026-01-20T22:30Z";
console.log("[StatsService] MODULE LOADED build=", STATS_SERVICE_BUILD_ID);

/**
 * Stats Service - Fetches aggregated stats data from Firestore
 * Matches iOS StatsDataService functionality
 */

/**
 * Fetch daily stats for a specific date
 */
export async function getSystemDailyStats(date: Date): Promise<SystemDailyStats | null> {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateString = formatter.format(date);

    const docRef = doc(db, "systemDailyStats", dateString);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      date: dateString,
      approvalsCount: data.approvalsCount ?? 0,
      approvalsCountYesterday: data.approvalsCountYesterday ?? undefined,
      priorityDateMovement: data.priorityDateMovement ?? undefined,
      activeCasesProcessed: data.activeCasesProcessed ?? undefined,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error("Error fetching daily stats:", error);
    return null;
  }
}

/**
 * Fetch monthly stats for a specific month (YYYY-MM)
 */
export async function getSystemMonthlyStats(month: string): Promise<SystemMonthlyStats | null> {
  try {
    const docRef = doc(db, "systemMonthlyStats", month);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      month: month,
      approvalsTotal: data.approvalsTotal ?? 0,
      approvalsLastMonth: data.approvalsLastMonth ?? undefined,
      dailyAverage: data.dailyAverage ?? 0,
      bestDay: data.bestDay ?? undefined,
      bestDayCount: data.bestDayCount ?? undefined,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error("Error fetching monthly stats:", error);
    return null;
  }
}

/**
 * Fetch coverage ratio for a scope
 */
export async function getSystemCoverage(scopeId: string): Promise<SystemCoverage | null> {
  try {
    const docRef = doc(db, "systemCoverage", scopeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      scopeId: scopeId,
      coverageRatio: data.coverageRatio ?? 0,
      sourceDescription: data.sourceDescription ?? "",
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error("Error fetching coverage:", error);
    return null;
  }
}

/**
 * Fetch trends data for a scope
 */
export async function getTrends(scopeId: string): Promise<TrendsData | null> {
  try {
    const docRef = doc(db, "trends", scopeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      scopeId: scopeId,
      approvalsPerDayPoints: data.approvalsPerDayPoints ?? [],
      etaPoints: data.etaPoints ?? undefined,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error("Error fetching trends:", error);
    return null;
  }
}

/**
 * Fetch PD stats for a scope
 */
export async function getPDStats(scopeId: string): Promise<PDStats | null> {
  try {
    const docRef = doc(db, "pdStats", scopeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      scopeId: scopeId,
      latestApprovedPD: data.latestApprovedPD ?? undefined,
      lastApprovedPD: data.lastApprovedPD ?? undefined,
      pacePdsPerDay: data.pacePdsPerDay ?? undefined,
      avgTimeDays: data.avgTimeDays ?? undefined,
      backlog: data.backlog ?? undefined,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error("Error fetching PD stats:", error);
    return null;
  }
}

/**
 * Fetch RFE stats for a scope
 */
export async function getRFEStats(scopeId: string): Promise<RFEStats | null> {
  try {
    const docRef = doc(db, "rfeStats", scopeId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      scopeId: scopeId,
      cohortSize: data.cohortSize ?? 0,
      rfeCount: data.rfeCount ?? 0,
      rfeRate: data.rfeRate ?? 0,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error("Error fetching RFE stats:", error);
    return null;
  }
}

/**
 * Fetch calendar approvals for a month
 */
export async function getCalendarApprovals(
  month: string,
  scopeId: string
): Promise<CalendarApprovals | null> {
  try {
    // Note: Calendar approvals may use a different structure
    // This is a placeholder - adjust based on your actual Firestore structure
    const docRef = doc(db, "calendarApprovals", `${month}_${scopeId}`);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      month: month,
      days: data.days ?? {},
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error("Error fetching calendar approvals:", error);
    return null;
  }
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(new Date());
}

// Re-export scope builder functions for convenience
export { buildScopeId, scopeFromProfile };

// MARK: - Approval Data Methods

/** Local date string YYYY-MM-DD for calendar/stats consistency. */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear(),
    m = d.getMonth(),
    day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Get I-130 approval data aggregated by date (last N days)
 * Matches iOS StatsDataService.getApprovalDataByDate()
 */
export async function getI130ApprovalDataByDate(
  daysBack: number = 180
): Promise<ApprovalData[]> {
  // Query using composite index: formType + createdAt (desc)
  let snapshot;
  try {
    const q = query(
      collection(db, "i130Approvals"),
      where("formType", "==", "I-130"),
      orderBy("createdAt", "desc"),
      limit(5000) // Pull more data for calendar and stats
    );
    snapshot = await getDocs(q);
  } catch (indexError: any) {
    // If index error, try without orderBy and sort in memory
    if (indexError.code === "failed-precondition" || indexError.message?.includes("index")) {
      try {
        const q2 = query(
          collection(db, "i130Approvals"),
          where("formType", "==", "I-130"),
          limit(5000)
        );
        snapshot = await getDocs(q2);
        // Sort by createdAt in memory (descending)
        snapshot = {
          ...snapshot,
          docs: [...snapshot.docs].sort((a, b) => {
            const aCreated = a.data().createdAt?.toDate?.() || (a.data().createdAt ? new Date(a.data().createdAt) : new Date(0));
            const bCreated = b.data().createdAt?.toDate?.() || (b.data().createdAt ? new Date(b.data().createdAt) : new Date(0));
            return bCreated.getTime() - aCreated.getTime();
          })
        } as any;
      } catch (retryError) {
        console.error("[StatsService] Fallback query also failed:", retryError);
        return [];
      }
    } else {
      throw indexError;
    }
  }

  try {
    console.log(`[StatsService] Fetched ${snapshot.docs.length} I-130 approvals`);
    const approvalsByDate: Map<string, number> = new Map();
    let skippedCount = 0;
    let processedCount = 0;

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      let approvalDate: Date | null = null;
      
      // Handle Firestore Timestamp first
      if (data.approvalDate?.toDate) {
        approvalDate = data.approvalDate.toDate();
      } else if (data.approvalDate?.seconds) {
        approvalDate = new Date(data.approvalDate.seconds * 1000);
      } else if (data.approvalDate) {
        approvalDate = new Date(data.approvalDate);
      }
      
      // Fallback to approvalDateText if approvalDate not found (support both field names)
      if (!approvalDate && data.approvalDateText) {
        approvalDate = new Date(data.approvalDateText);
      }
      
      // Skip if no approval date found
      if (!approvalDate) {
        skippedCount++;
        console.warn(`[StatsService] Skipping doc ${doc.id}: No approvalDate or approvalDateText found`);
        return;
      }

      // Validate date
      if (isNaN(approvalDate.getTime())) {
        skippedCount++;
        console.warn(`[StatsService] Invalid approval date for doc ${doc.id}:`, data.approvalDate || data.approvalDateText);
        return;
      }

      const dateString = toLocalDateString(approvalDate);
      approvalsByDate.set(dateString, (approvalsByDate.get(dateString) || 0) + 1);
      processedCount++;
    });

    // Create array for last N days (local date strings for calendar parity)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: ApprovalData[] = [];

    for (let i = 0; i < daysBack; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = toLocalDateString(date);
      const count = approvalsByDate.get(dateString) || 0;
      result.push({ date: dateString, approvals: count });
    }

    // Sort by date (oldest first)
    const sorted = result.sort((a, b) => a.date.localeCompare(b.date));
    const totalApprovals = Array.from(approvalsByDate.values()).reduce((a, b) => a + b, 0);
    console.log(`[StatsService] Processed ${processedCount} I-130 approvals, skipped ${skippedCount}, returning ${sorted.length} days of data, total approvals: ${totalApprovals}`);
    return sorted;
  } catch (error) {
    console.error("[StatsService] Error processing I-130 approval data:", error);
    return [];
  }
}

/**
 * Get I-129F approval data aggregated by date (last N days)
 * Matches iOS StatsDataService.getI129FApprovalDataByDate()
 */
export async function getI129FApprovalDataByDate(
  daysBack: number = 180
): Promise<ApprovalData[]> {
  console.log("[StatsService] ENTER getI129FApprovalDataByDate", {
    daysBack,
    build: STATS_SERVICE_BUILD_ID,
  });
  console.log("[StatsService] dummy env =", process.env.NEXT_PUBLIC_STATS_DUMMY);

  // Forced dummy test path to instantly verify new bundle is active
  if (process.env.NEXT_PUBLIC_STATS_DUMMY === "1") {
    console.log(
      "[StatsService] NEXT_PUBLIC_STATS_DUMMY=1 - returning dummy I-129F data for quick verification"
    );
    return [
      {
        date: "2026-01-20",
        approvals: 123,
      },
    ];
  }

  // Query using composite index: formType + createdAt (desc)
  let snapshot;
  try {
    const q = query(
      collection(db, "i129fApprovals"),
      where("formType", "==", "I-129F"),
      orderBy("createdAt", "desc"),
      limit(5000) // Pull more data for calendar and stats
    );
    snapshot = await getDocs(q);
  } catch (indexError: any) {
    // If index error, try without orderBy and sort in memory
    if (indexError.code === "failed-precondition" || indexError.message?.includes("index")) {
      try {
        const q2 = query(
          collection(db, "i129fApprovals"),
          where("formType", "==", "I-129F"),
          limit(5000)
        );
        snapshot = await getDocs(q2);
        // Sort by createdAt in memory (descending)
        snapshot = {
          ...snapshot,
          docs: [...snapshot.docs].sort((a, b) => {
            const aCreated = a.data().createdAt?.toDate?.() || (a.data().createdAt ? new Date(a.data().createdAt) : new Date(0));
            const bCreated = b.data().createdAt?.toDate?.() || (b.data().createdAt ? new Date(b.data().createdAt) : new Date(0));
            return bCreated.getTime() - aCreated.getTime();
          })
        } as any;
      } catch (retryError) {
        console.error("[StatsService] Fallback query also failed:", retryError);
        return [];
      }
    } else {
      throw indexError;
    }
  }

  try {
    console.log(`[StatsService] ===== I-129F DATA FETCH DEBUG =====`);
    console.log(`[StatsService] Collection: i129fApprovals`);
    console.log(`[StatsService] Query filter: formType == "I-129F"`);
    console.log(`[StatsService] Fetched ${snapshot.docs.length} total documents`);
    
    const approvalsByDate: Map<string, number> = new Map();
    let processedCount = 0;
    let skippedCount = 0;
    let skippedNoDate = 0;
    let skippedOutOfRange = 0;
    
    // Calculate date range once
    const todayForRange = new Date();
    todayForRange.setHours(0, 0, 0, 0);
    const cutoffDateForRange = new Date(todayForRange);
    cutoffDateForRange.setDate(cutoffDateForRange.getDate() - daysBack);
    cutoffDateForRange.setHours(0, 0, 0, 0);
    
    console.log(`[StatsService] Date range: ${cutoffDateForRange.toISOString().split('T')[0]} to ${todayForRange.toISOString().split('T')[0]} (${daysBack} days)`);
    console.log(`[StatsService] Today (UTC): ${todayForRange.toISOString()}`);
    console.log(`[StatsService] Cutoff (UTC): ${cutoffDateForRange.toISOString()}`);

    // Log first 5 docs before filtering
    console.log(`[StatsService] Sample of first 5 documents BEFORE filtering:`);
    snapshot.docs.slice(0, 5).forEach((doc: QueryDocumentSnapshot, idx: number) => {
      const data = doc.data();
      const noa1 = data.noa1Date || data.noa1;
      const noa2 = data.noa2Date || data.noa2;
      const createdAt = data.createdAt;
      console.log(`[StatsService]   Doc ${idx + 1} (${doc.id}): formType="${data.formType}", noa1=${noa1 ? (noa1.toDate ? noa1.toDate().toISOString() : String(noa1)) : 'null'}, noa2=${noa2 ? (noa2.toDate ? noa2.toDate().toISOString() : String(noa2)) : 'null'}, createdAt=${createdAt ? (createdAt.toDate ? createdAt.toDate().toISOString() : String(createdAt)) : 'null'}`);
    });

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      
      // If formType filter was applied in query, skip if it doesn't match
      // But if query didn't use formType filter, include all documents from i129fApprovals collection
      const formType = data.formType || data.form_type || "";
      if (formType && formType !== "I-129F" && formType !== "I129F") {
        skippedCount++;
        return; // Skip non-I-129F documents if formType is present
      }
      
      let noa2Date: Date | null = null;
      
      // Handle Firestore Timestamp - support multiple field name variations
      // Priority: noa2Date > noa2 > approvalDate > noa2_date (snake_case)
      const noa2Field = data.noa2Date || data.noa2 || data.approvalDate || data.noa2_date;
      
      if (noa2Field?.toDate) {
        noa2Date = noa2Field.toDate();
      } else if (noa2Field?.seconds) {
        noa2Date = new Date(noa2Field.seconds * 1000);
      } else if (noa2Field) {
        noa2Date = new Date(noa2Field);
      }
      
      // If noa2 is null, try to extract date from body text or use fallback dates
      if (!noa2Date || isNaN(noa2Date.getTime())) {
        // Try to parse date from body text (e.g., "NOA2: January 15, 2024")
        if (data.body && typeof data.body === 'string') {
          const bodyText = data.body;
          // Look for patterns like "NOA2: January 15, 2024" or "NOA2: 2024-01-15"
          const noa2Match = bodyText.match(/NOA2[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
          if (noa2Match && !noa2Match[1].toLowerCase().includes('pending')) {
            const parsedDate = new Date(noa2Match[1]);
            if (!isNaN(parsedDate.getTime())) {
              noa2Date = parsedDate;
            }
          }
        }
        
        // If still no date, try using noa1 date as fallback (for pending cases)
        if (!noa2Date || isNaN(noa2Date.getTime())) {
          const noa1Field = data.noa1Date || data.noa1 || data.noa1_date;
          if (noa1Field) {
            if (noa1Field?.toDate) {
              noa2Date = noa1Field.toDate();
            } else if (noa1Field?.seconds) {
              noa2Date = new Date(noa1Field.seconds * 1000);
            } else if (noa1Field) {
              noa2Date = new Date(noa1Field);
            }
          }
        }
        
        // Last fallback: use createdAt date
        // For pending cases (noa2 is null), use createdAt if noa1 wasn't available
        // This handles cases where the document was just created/imported
        if ((!noa2Date || isNaN(noa2Date.getTime())) && data.createdAt) {
          const createdAtField = data.createdAt;
          let createdAtDate: Date | null = null;
          if (createdAtField?.toDate) {
            createdAtDate = createdAtField.toDate();
          } else if (createdAtField?.seconds) {
            createdAtDate = new Date(createdAtField.seconds * 1000);
          } else if (createdAtField) {
            createdAtDate = new Date(createdAtField);
          }
          
          // Use createdAt if we don't have noa2Date and noa1Date wasn't available
          // This ensures pending cases show up based on when they were added to the system
          if (createdAtDate && !isNaN(createdAtDate.getTime())) {
            noa2Date = createdAtDate;
          }
        }
        
        // If still no valid date, skip this document
        if (!noa2Date || isNaN(noa2Date.getTime())) {
          skippedNoDate++;
          if (skippedNoDate <= 3) {
            console.log(`[StatsService] I-129F skipped (no date): doc has noa1=${data.noa1 ? 'yes' : 'no'}, noa2=${data.noa2 ? 'yes' : 'no'}, createdAt=${data.createdAt ? 'yes' : 'no'}`);
          }
          return;
        }
      }

      // Filter to only include dates within the requested range
      // Use pre-calculated range from above
      const noa2DateStart = new Date(noa2Date);
      noa2DateStart.setHours(0, 0, 0, 0);
      
      // Determine which field was used for the date
      let dateSource = "unknown";
      if (data.noa2Date || data.noa2) {
        dateSource = "noa2";
      } else if (data.noa1Date || data.noa1) {
        dateSource = "noa1";
      } else if (data.createdAt) {
        dateSource = "createdAt";
      }
      
      // Include dates from cutoffDate (inclusive) onwards, up to today (inclusive)
      // For pending cases using noa1 or createdAt, we want to show them if they're within range
      if (noa2DateStart < cutoffDateForRange) {
        skippedOutOfRange++;
        if (skippedOutOfRange <= 5) {
          console.log(`[StatsService] I-129F skipped (out of range): doc date=${noa2DateStart.toISOString().split('T')[0]} (source=${dateSource}), cutoff=${cutoffDateForRange.toISOString().split('T')[0]}, daysBack=${daysBack}`);
        }
        return; // Skip dates before the cutoff
      }
      
      // Include dates up to today (inclusive) - don't filter future dates for now
      // This allows pending cases with future createdAt dates to show up
      // Note: We could add a check here if needed: if (noa2DateStart > todayForRange) { ... }

      const dateString = toLocalDateString(noa2Date);
      approvalsByDate.set(dateString, (approvalsByDate.get(dateString) || 0) + 1);
      processedCount++;
      
      // Debug log for first few processed documents
      if (processedCount <= 5) {
        console.log(`[StatsService] I-129F processed doc ${processedCount}: date=${dateString} (source=${dateSource}), source date=${noa2Date.toISOString()}`);
      }
    });

    const totalApprovals = Array.from(approvalsByDate.values()).reduce((a, b) => a + b, 0);
    
    console.log(`[StatsService] ===== FILTERING SUMMARY =====`);
    console.log(`[StatsService] Total docs fetched: ${snapshot.docs.length}`);
    console.log(`[StatsService] After formType filter: ${snapshot.docs.length - skippedCount} (skipped ${skippedCount})`);
    console.log(`[StatsService] After date extraction: ${snapshot.docs.length - skippedCount - skippedNoDate} (skipped ${skippedNoDate} with no date)`);
    console.log(`[StatsService] After range filter: ${processedCount} (skipped ${skippedOutOfRange} out of range)`);
    console.log(`[StatsService] Total approvals in range: ${totalApprovals}`);
    
    // Create array for last N days (including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    console.log(`[StatsService] I-129F date range: ${cutoffDate.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]} (${daysBack} days)`);
    
    // Log sample dates found
    if (approvalsByDate.size > 0) {
      const sampleDates = Array.from(approvalsByDate.entries()).slice(0, 10);
      console.log(`[StatsService] Sample dates with counts:`, sampleDates.map(([date, count]) => `${date}:${count}`).join(', '));
    } else {
      console.warn(`[StatsService] WARNING: No dates found in approvalsByDate map!`);
    }
    
    const result: ApprovalData[] = [];

    for (let i = 0; i < daysBack; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = toLocalDateString(date);
      const count = approvalsByDate.get(dateString) || 0;
      result.push({ date: dateString, approvals: count });
      
      // Debug: Log dates with non-zero counts
      if (count > 0 && i < 10) {
        console.log(`[StatsService] I-129F result array: date=${dateString}, count=${count}`);
      }
    }

    const sorted = result.sort((a, b) => a.date.localeCompare(b.date));
    const totalApprovalsInResult = sorted.reduce((sum, item) => sum + item.approvals, 0);
    const nonZeroDays = sorted.filter(d => d.approvals > 0);
    console.log(`[StatsService] Returning ${sorted.length} days of I-129F data, total approvals: ${totalApprovalsInResult}`);
    console.log(`[StatsService] Days with approvals > 0: ${nonZeroDays.length}`, nonZeroDays.slice(0, 10));
    console.log(`[StatsService] Today's date (${today.toISOString().split('T')[0]}) count: ${approvalsByDate.get(today.toISOString().split('T')[0]) || 0}`);
    console.log(`[StatsService] ApprovalsByDate map size: ${approvalsByDate.size}, keys:`, Array.from(approvalsByDate.keys()).slice(0, 10));
    return sorted;
  } catch (error) {
    console.error("[StatsService] Error processing I-129F approval data:", error);
    return [];
  }
}

/** Aggregated count of approvals by priority-date month (for "which PD months are being approved" chart) */
export interface ApprovalsByPDMonthPoint {
  month: string;   // YYYY-MM
  monthLabel: string;
  count: number;
}

/**
 * Get approvals in the last N days grouped by the case's priority date month.
 * Shows which priority date months are currently being approved. Very useful for "is my month in the batch?"
 */
export async function getApprovalsByPriorityDateMonth(
  formType: "I-130" | "I-129F",
  daysBack: number = 60
): Promise<ApprovalsByPDMonthPoint[]> {
  const col = formType === "I-129F" ? "i129fApprovals" : "i130Approvals";
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  cutoff.setHours(0, 0, 0, 0);

  let snapshot;
  try {
    const q = query(
      collection(db, col),
      where("formType", "==", formType),
      orderBy("createdAt", "desc"),
      limit(2500)
    );
    snapshot = await getDocs(q);
  } catch (indexErr: any) {
    if (indexErr?.code === "failed-precondition" || indexErr?.message?.includes("index")) {
      const q = query(collection(db, col), where("formType", "==", formType), limit(2500));
      snapshot = await getDocs(q);
      (snapshot as any).docs = [...snapshot.docs].sort((a: any, b: any) => {
        const ac = a.data().createdAt?.toDate?.() || new Date(0);
        const bc = b.data().createdAt?.toDate?.() || new Date(0);
        return bc.getTime() - ac.getTime();
      });
    } else throw indexErr;
  }

  const byMonth = new Map<string, number>();

  const getApprovalDate = (data: any): Date | null => {
    if (formType === "I-129F") {
      const n = data.noa2Date || data.noa2 || data.approvalDate;
      if (n?.toDate) return n.toDate();
      if (n?.seconds) return new Date(n.seconds * 1000);
      if (n) return new Date(n);
      const c = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
      return c;
    }
    const a = data.approvalDate?.toDate?.() || (data.approvalDate ? new Date(data.approvalDate) : null);
    if (a) return a;
    const c = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
    return c;
  };

  const getPDDate = (data: any): Date | null => {
    const raw = formType === "I-129F" ? (data.noa1Date || data.noa1) : data.priorityDate;
    if (!raw) return null;
    if (raw.toDate) return raw.toDate();
    if (raw.seconds) return new Date(raw.seconds * 1000);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const monthLabel = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  };

  snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
    const data = doc.data();
    const approvalDate = getApprovalDate(data);
    if (!approvalDate || approvalDate < cutoff) return;
    const pd = getPDDate(data);
    if (!pd || isNaN(pd.getTime())) return;
    const y = pd.getFullYear();
    const m = pd.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) || 0) + 1);
  });

  const sorted = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.map(([month, count]) => ({
    month,
    monthLabel: monthLabel(month),
    count,
  }));
}

/**
 * Get service center stats from approval data
 * Matches iOS StatsDataService.getServiceCenterStats()
 */
export async function getServiceCenterStats(): Promise<ServiceCenterStats[]> {
  try {
    const q = query(
      collection(db, "i130Approvals"),
      where("formType", "==", "I-130"),
      orderBy("createdAt", "desc"),
      limit(1000)
    );

    const snapshot = await getDocs(q);
    const centerGroups: Map<string, I130ApprovalData[]> = new Map();

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const serviceCenter = data.serviceCenter;
      if (!serviceCenter) return;

      if (!centerGroups.has(serviceCenter)) {
        centerGroups.set(serviceCenter, []);
      }
      centerGroups.get(serviceCenter)!.push({
        id: doc.id,
        formType: data.formType,
        beneficiaryCountry: data.beneficiaryCountry,
        priorityDate: data.priorityDate,
        approvalDate: data.approvalDate,
        serviceCenter: data.serviceCenter,
        notes: data.notes,
        createdAt: data.createdAt,
      });
    });

    const stats: ServiceCenterStats[] = [];

    centerGroups.forEach((approvals, centerName) => {
      if (approvals.length < 3) return; // Minimum 3 samples

      // Calculate average processing days
      const processingDays = approvals
        .map((approval) => {
          const pd = approval.priorityDate?.toDate?.() || new Date(approval.priorityDate);
          const ad = approval.approvalDate?.toDate?.() || new Date(approval.approvalDate);
          return Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
        })
        .filter((days) => days > 0);

      if (processingDays.length === 0) return;

      const avgDays = Math.round(
        processingDays.reduce((sum, days) => sum + days, 0) / processingDays.length
      );

      // Find latest PD
      const latestApproval = approvals.reduce((latest, approval) => {
        const latestDate = latest.approvalDate?.toDate?.() || new Date(latest.approvalDate);
        const approvalDate = approval.approvalDate?.toDate?.() || new Date(approval.approvalDate);
        return approvalDate > latestDate ? approval : latest;
      });

      const latestPD = latestApproval.priorityDate?.toDate?.() || new Date(latestApproval.priorityDate);
      const latestPDString = latestPD.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      // Determine status (simplified - compare recent vs older)
      const sorted = approvals.sort((a, b) => {
        const aDate = a.approvalDate?.toDate?.() || new Date(a.approvalDate);
        const bDate = b.approvalDate?.toDate?.() || new Date(b.approvalDate);
        return aDate.getTime() - bDate.getTime();
      });

      let status: "improving" | "delays" | "steady" = "steady";
      if (sorted.length >= 5) {
        const recent = sorted.slice(-5);
        const older = sorted.slice(0, sorted.length - 5);
        const recentAvg = recent
          .map((a) => {
            const pd = a.priorityDate?.toDate?.() || new Date(a.priorityDate);
            const ad = a.approvalDate?.toDate?.() || new Date(a.approvalDate);
            return Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
          })
          .reduce((sum, days) => sum + days, 0) / recent.length;
        const olderAvg = older
          .map((a) => {
            const pd = a.priorityDate?.toDate?.() || new Date(a.priorityDate);
            const ad = a.approvalDate?.toDate?.() || new Date(a.approvalDate);
            return Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
          })
          .reduce((sum, days) => sum + days, 0) / older.length;

        if (recentAvg < olderAvg - 10) {
          status = "improving";
        } else if (recentAvg > olderAvg + 10) {
          status = "delays";
        }
      }

      // Calculate days since last approval
      const lastApprovalDate = latestApproval.approvalDate?.toDate?.() || new Date(latestApproval.approvalDate);
      const daysSince = Math.floor((Date.now() - lastApprovalDate.getTime()) / (1000 * 60 * 60 * 24));

      stats.push({
        name: centerName,
        avgDays,
        latestPD: latestPDString,
        status,
        count: approvals.length,
        daysSinceLastApproval: daysSince,
      });
    });

    return stats;
  } catch (error) {
    console.error("Error fetching service center stats:", error);
    return [];
  }
}

/**
 * Get latest priority date from approval data
 * Matches iOS StatsDataService.getLatestPD()
 */
export async function getLatestPD(formType: string = "I-130"): Promise<string | null> {
  try {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";

    const q = query(
      collection(db, collectionName),
      where("formType", "==", formType),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const data = snapshot.docs[0].data();
    const pdField = formType === "I-130" ? "priorityDate" : "noa1Date";
    const pd = data[pdField]?.toDate?.() || new Date(data[pdField]);

    return pd.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (error) {
    console.error("Error fetching latest PD:", error);
    return null;
  }
}

/**
 * Get average processing time
 * Matches iOS StatsDataService.getAverageProcessingTime()
 */
export async function getAverageProcessingTime(
  formType: string = "I-130"
): Promise<number | null> {
  try {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";
    const q = query(
      collection(db, collectionName),
      where("formType", "==", formType),
      orderBy("createdAt", "desc"),
      limit(1000)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const processingDays: number[] = [];

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      if (formType === "I-130") {
        const pd = data.priorityDate?.toDate?.() || new Date(data.priorityDate);
        const ad = data.approvalDate?.toDate?.() || new Date(data.approvalDate);
        const days = Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0) processingDays.push(days);
      } else {
        const noa1 = data.noa1Date?.toDate?.() || new Date(data.noa1Date);
        // Support both noa2Date and noa2 field names
        const noa2Field = data.noa2Date || data.noa2;
        const noa2 = noa2Field?.toDate?.() || (noa2Field?.seconds ? new Date(noa2Field.seconds * 1000) : (noa2Field ? new Date(noa2Field) : null));
        if (noa2) {
          const days = Math.floor((noa2.getTime() - noa1.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0) processingDays.push(days);
        }
      }
    });

    if (processingDays.length === 0) return null;

    return Math.round(processingDays.reduce((sum, days) => sum + days, 0) / processingDays.length);
  } catch (error) {
    console.error("Error fetching average processing time:", error);
    return null;
  }
}

/**
 * Get approvals by date for calendar display (I-130 and I-129F)
 * Returns a map of dateKey (YYYY-MM-DD) -> { i130, i129f } for hover tooltips
 */
export async function getCalendarApprovalsByDate(
  daysBack: number = 365
): Promise<Record<string, { i130: number; i129f: number }>> {
  try {
    const [i130Data, i129fData] = await Promise.all([
      getI130ApprovalDataByDate(daysBack),
      getI129FApprovalDataByDate(daysBack),
    ]);
    const result: Record<string, { i130: number; i129f: number }> = {};
    i130Data.forEach((d) => {
      if (!result[d.date]) result[d.date] = { i130: 0, i129f: 0 };
      result[d.date].i130 = d.approvals;
    });
    i129fData.forEach((d) => {
      if (!result[d.date]) result[d.date] = { i130: 0, i129f: 0 };
      result[d.date].i129f = d.approvals;
    });
    return result;
  } catch (error) {
    console.error("Error fetching calendar approvals:", error);
    return {};
  }
}

/**
 * Get weekly approval breakdown (last 7 days)
 * Returns data for both I-130 and I-129F
 */
export async function getWeeklyApprovalBreakdown(): Promise<WeeklyApprovalData[]> {
  try {
    console.log(`[StatsService] getWeeklyApprovalBreakdown: Starting fetch...`);
    const [i130Data, i129fData] = await Promise.all([
      getI130ApprovalDataByDate(7),
      getI129FApprovalDataByDate(7),
    ]);

    console.log(`[StatsService] getWeeklyApprovalBreakdown: I-130 data: ${i130Data.length} days, I-129F data: ${i129fData.length} days`);
    console.log(`[StatsService] getWeeklyApprovalBreakdown: I-129F sample:`, i129fData.slice(0, 7));

    const i130Map = new Map(i130Data.map((d) => [d.date, d.approvals]));
    const i129fMap = new Map(i129fData.map((d) => [d.date, d.approvals]));

    console.log(`[StatsService] getWeeklyApprovalBreakdown: I-130 map size: ${i130Map.size}, I-129F map size: ${i129fMap.size}`);
    console.log(`[StatsService] getWeeklyApprovalBreakdown: I-129F map keys:`, Array.from(i129fMap.keys()));
    console.log(`[StatsService] getWeeklyApprovalBreakdown: I-129F map entries:`, Array.from(i129fMap.entries()).slice(0, 7));

    const result: WeeklyApprovalData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split("T")[0];

      const i130Count = i130Map.get(dateString) || 0;
      const i129fCount = i129fMap.get(dateString) || 0;
      
      result.push({
        date: dateString,
        i130: i130Count,
        i129f: i129fCount,
      });
      
      if (i129fCount > 0) {
        console.log(`[StatsService] getWeeklyApprovalBreakdown: Date ${dateString} has ${i129fCount} I-129F approvals`);
      }
    }

    const totalI129F = result.reduce((sum, d) => sum + d.i129f, 0);
    console.log(`[StatsService] getWeeklyApprovalBreakdown: Returning ${result.length} days, total I-129F: ${totalI129F}`);
    console.log(`[StatsService] getWeeklyApprovalBreakdown: Result:`, result);

    return result;
  } catch (error) {
    console.error("Error fetching weekly approval breakdown:", error);
    return [];
  }
}

/**
 * Get approval trend summary
 */
export async function getApprovalTrendSummary(
  formType: string = "I-130",
  daysBack: number = 90
): Promise<ApprovalTrendSummary | null> {
  try {
    const data =
      formType === "I-130"
        ? await getI130ApprovalDataByDate(daysBack)
        : await getI129FApprovalDataByDate(daysBack);

    if (data.length === 0) return null;

    const total = data.reduce((sum, d) => sum + d.approvals, 0);
    const average = Math.round(total / data.length);
    const peak = data.reduce(
      (max, d) => (d.approvals > max.count ? { date: d.date, count: d.approvals } : max),
      { date: data[0].date, count: data[0].approvals }
    );

    // Calculate trend (last 7 days vs previous 7 days)
    const last7 = data.slice(-7).reduce((sum, d) => sum + d.approvals, 0);
    const previous7 = data.slice(-14, -7).reduce((sum, d) => sum + d.approvals, 0);
    const delta = previous7 > 0 ? ((last7 - previous7) / previous7) * 100 : 0;

    let trend: "increasing" | "decreasing" | "stable" = "stable";
    if (delta > 5) trend = "increasing";
    else if (delta < -5) trend = "decreasing";

    return {
      total,
      average,
      peak,
      trend,
      last7DaysDelta: Math.round(delta * 10) / 10,
    };
  } catch (error) {
    console.error("Error fetching approval trend summary:", error);
    return null;
  }
}

/**
 * Get processing time distribution
 */
export async function getProcessingTimeDistribution(
  formType: string = "I-130"
): Promise<ProcessingTimeDistribution | null> {
  try {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";
    const q = query(
      collection(db, collectionName),
      where("formType", "==", formType),
      orderBy("createdAt", "desc"),
      limit(1000)
    );

    const snapshot = await getDocs(q);
    const processingDays: number[] = [];

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      if (formType === "I-130") {
        const pd = data.priorityDate?.toDate?.() || new Date(data.priorityDate);
        const ad = data.approvalDate?.toDate?.() || new Date(data.approvalDate);
        const days = Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0) processingDays.push(days);
      } else {
        const noa1 = data.noa1Date?.toDate?.() || new Date(data.noa1Date);
        // Support both noa2Date and noa2 field names
        const noa2Field = data.noa2Date || data.noa2;
        const noa2 = noa2Field?.toDate?.() || (noa2Field?.seconds ? new Date(noa2Field.seconds * 1000) : (noa2Field ? new Date(noa2Field) : null));
        if (noa2) {
          const days = Math.floor((noa2.getTime() - noa1.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0) processingDays.push(days);
        }
      }
    });

    if (processingDays.length === 0) return null;

    processingDays.sort((a, b) => a - b);
    const average = Math.round(processingDays.reduce((sum, d) => sum + d, 0) / processingDays.length);
    const median = processingDays[Math.floor(processingDays.length / 2)];
    const min = processingDays[0];
    const max = processingDays[processingDays.length - 1];

    // Create distribution ranges
    const rangeSize = 50;
    const ranges: Map<string, number> = new Map();
    processingDays.forEach((days) => {
      const rangeStart = Math.floor(days / rangeSize) * rangeSize;
      const rangeEnd = rangeStart + rangeSize;
      const rangeKey = `${rangeStart}-${rangeEnd}`;
      ranges.set(rangeKey, (ranges.get(rangeKey) || 0) + 1);
    });

    // Find most common range
    let maxCount = 0;
    let maxRange = "";
    ranges.forEach((count, range) => {
      if (count > maxCount) {
        maxCount = count;
        maxRange = range;
      }
    });

    return {
      range: maxRange,
      count: maxCount,
      average,
      median,
      min,
      max,
    };
  } catch (error) {
    console.error("Error fetching processing time distribution:", error);
    return null;
  }
}

/**
 * Get median processing time per service center from backend (so "Typical for Vermont" etc. uses real data).
 */
export async function getMedianProcessingTimeByServiceCenter(
  formType: string = "I-130"
): Promise<Record<string, number>> {
  try {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";
    const q = query(
      collection(db, collectionName),
      where("formType", "==", formType),
      orderBy("createdAt", "desc"),
      limit(1500)
    );
    const snapshot = await getDocs(q);
    const byCenter = new Map<string, number[]>();

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const sc = data.serviceCenter;
      if (!sc || sc === "Unknown") return;
      let days: number | null = null;
      if (formType === "I-130") {
        const pd = data.priorityDate?.toDate?.() || (data.priorityDate ? new Date(data.priorityDate) : null);
        const ad = data.approvalDate?.toDate?.() || (data.approvalDate ? new Date(data.approvalDate) : null);
        if (pd && ad && !isNaN(pd.getTime()) && !isNaN(ad.getTime())) {
          days = Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
        }
      } else {
        const noa1 = data.noa1Date?.toDate?.() || (data.noa1Date ? new Date(data.noa1Date) : null);
        const noa2Field = data.noa2Date || data.noa2;
        const noa2 = noa2Field?.toDate?.() ?? (noa2Field?.seconds ? new Date(noa2Field.seconds * 1000) : (noa2Field ? new Date(noa2Field) : null));
        if (noa1 && noa2 && !isNaN(noa1.getTime()) && !isNaN(noa2.getTime())) {
          days = Math.floor((noa2.getTime() - noa1.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
      if (days != null && days > 0) {
        const arr = byCenter.get(sc) || [];
        arr.push(days);
        byCenter.set(sc, arr);
      }
    });

    const result: Record<string, number> = {};
    byCenter.forEach((daysArr, center) => {
      if (daysArr.length === 0) return;
      daysArr.sort((a, b) => a - b);
      const median = daysArr[Math.floor(daysArr.length / 2)];
      result[center] = median;
    });
    return result;
  } catch (error) {
    console.error("Error fetching median processing time by service center:", error);
    return {};
  }
}

export interface ProcessingTimeHistogramBucket {
  range: string;
  count: number;
  label: string;
}

/** Get full histogram buckets for processing time (multi-bucket for chart) */
export async function getProcessingTimeHistogramBuckets(
  formType: string = "I-130"
): Promise<ProcessingTimeHistogramBucket[]> {
  try {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";
    let snapshot;
    try {
      const q = query(
        collection(db, collectionName),
        where("formType", "==", formType),
        orderBy("createdAt", "desc"),
        limit(1500)
      );
      snapshot = await getDocs(q);
    } catch {
      const q = query(
        collection(db, collectionName),
        where("formType", "==", formType),
        limit(1500)
      );
      snapshot = await getDocs(q);
      snapshot = {
        ...snapshot,
        docs: [...snapshot.docs].sort((a, b) => {
          const ac = a.data().createdAt?.toDate?.() || new Date(0);
          const bc = b.data().createdAt?.toDate?.() || new Date(0);
          return bc.getTime() - ac.getTime();
        })
      } as any;
    }

    const processingDays: number[] = [];
    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      if (formType === "I-130") {
        const pd = data.priorityDate?.toDate?.() || (data.priorityDate ? new Date(data.priorityDate) : null);
        const ad = data.approvalDate?.toDate?.() || (data.approvalDate ? new Date(data.approvalDate) : null);
        if (pd && ad && !isNaN(pd.getTime()) && !isNaN(ad.getTime())) {
          const days = Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0 && days < 2000) processingDays.push(days);
        }
      } else {
        const noa1 = data.noa1Date?.toDate?.() || (data.noa1 ? new Date(data.noa1) : null);
        const noa2Field = data.noa2Date || data.noa2;
        const noa2 = noa2Field?.toDate?.() || (noa2Field?.seconds ? new Date(noa2Field.seconds * 1000) : (noa2Field ? new Date(noa2Field) : null));
        if (noa1 && noa2 && !isNaN(noa1.getTime()) && !isNaN(noa2.getTime())) {
          const days = Math.floor((noa2.getTime() - noa1.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0 && days < 2000) processingDays.push(days);
        }
      }
    });

    if (processingDays.length === 0) return [];

    const rangeSize = 50;
    const ranges: Map<string, number> = new Map();
    processingDays.forEach((days) => {
      const rangeStart = Math.floor(days / rangeSize) * rangeSize;
      const rangeEnd = rangeStart + rangeSize;
      const rangeKey = `${rangeStart}-${rangeEnd}`;
      ranges.set(rangeKey, (ranges.get(rangeKey) || 0) + 1);
    });

    const minDays = Math.min(...processingDays);
    const maxDays = Math.max(...processingDays);
    const minBucket = Math.floor(minDays / rangeSize) * rangeSize;
    const maxBucket = Math.ceil(maxDays / rangeSize) * rangeSize;
    const result: ProcessingTimeHistogramBucket[] = [];
    for (let b = minBucket; b < maxBucket + rangeSize; b += rangeSize) {
      const key = `${b}-${b + rangeSize}`;
      const count = ranges.get(key) || 0;
      result.push({ range: key, count, label: `${b}+` });
    }
    return result.filter((r) => r.count > 0);
  } catch (error) {
    console.error("Error fetching processing time histogram:", error);
    return [];
  }
}

/**
 * Get quiet offices (days since last approval per center)
 */
export async function getQuietOffices(): Promise<ServiceCenterStats[]> {
  try {
    const stats = await getServiceCenterStats();
    return stats
      .filter((s) => s.daysSinceLastApproval !== undefined)
      .sort((a, b) => (a.daysSinceLastApproval || 0) - (b.daysSinceLastApproval || 0));
  } catch (error) {
    console.error("Error fetching quiet offices:", error);
    return [];
  }
}

/**
 * Get most active centers (approvals in last N days) - combines I-130 and I-129F
 */
export async function getMostActiveCenters(days: number = 30): Promise<ServiceCenterStats[]> {
  try {
    // Get approvals from both I-130 and I-129F
    const [i130Snapshot, i129fSnapshot] = await Promise.all([
      getDocs(query(collection(db, "i130Approvals"), where("formType", "==", "I-130"), orderBy("createdAt", "desc"), limit(1000))),
      getDocs(query(collection(db, "i129fApprovals"), where("formType", "==", "I-129F"), orderBy("createdAt", "desc"), limit(1000))),
    ]);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const centerCounts: Map<string, number> = new Map();

    // Process I-130 approvals
    i130Snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const approvalDate = data.approvalDate?.toDate?.() || (data.approvalDate ? new Date(data.approvalDate) : null);
      const serviceCenter = data.serviceCenter;

      if (serviceCenter && approvalDate && !isNaN(approvalDate.getTime()) && approvalDate >= cutoffDate) {
        centerCounts.set(serviceCenter, (centerCounts.get(serviceCenter) || 0) + 1);
      }
    });

    // Process I-129F approvals
    i129fSnapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const noa2 = data.noa2?.toDate?.() || (data.noa2 ? new Date(data.noa2) : null);
      const serviceCenter = data.serviceCenter;

      if (serviceCenter && noa2 && !isNaN(noa2.getTime()) && noa2 >= cutoffDate) {
        centerCounts.set(serviceCenter, (centerCounts.get(serviceCenter) || 0) + 1);
      }
    });

    const stats: ServiceCenterStats[] = [];
    centerCounts.forEach((count, name) => {
      stats.push({
        name,
        avgDays: 0, // Not needed for this view
        latestPD: "",
        status: "steady",
        count,
      });
    });

    return stats.sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error("Error fetching most active centers:", error);
    return [];
  }
}

/**
 * Get USCIS backlog estimate by service center.
 * Combines approvals (last 30 days) with median processing time to estimate "cases in pipeline" per center.
 */
export async function getBacklogByServiceCenter(): Promise<BacklogByCenterEntry[]> {
  try {
    const [activeCenters, medianByCenterI130] = await Promise.all([
      getMostActiveCenters(30),
      getMedianProcessingTimeByServiceCenter("I-130"),
    ]);

    const excludedNames = ["CSC", "Unknown"];
    const entries: BacklogByCenterEntry[] = activeCenters
      .filter((c) => !excludedNames.includes(c.name))
      .map((c) => {
        const medianDays = medianByCenterI130[c.name] ?? 450;
        const approvals30d = c.count;
        const estimatedBacklog = Math.round(approvals30d * (medianDays / 30));
        return {
          name: c.name,
          approvals30d,
          estimatedBacklog,
          medianDays,
        };
      })
      .filter((e) => e.approvals30d > 0);

    return entries.sort((a, b) => b.estimatedBacklog - a.estimatedBacklog);
  } catch (error) {
    console.error("Error fetching backlog by service center:", error);
    return [];
  }
}

export interface MedianByApprovalMonthEntry {
  month: string;
  medianDays: number;
  count: number;
}

/**
 * Median processing time by month of approval (I-130). Shows whether recent approvals are taking longer or shorter.
 */
export async function getMedianProcessingTimeByApprovalMonth(
  monthsCount: number = 6
): Promise<MedianByApprovalMonthEntry[]> {
  try {
    const q = query(
      collection(db, "i130Approvals"),
      where("formType", "==", "I-130"),
      orderBy("createdAt", "desc"),
      limit(1200)
    );
    const snapshot = await getDocs(q);
    const byMonth = new Map<string, number[]>();

    const now = new Date();
    for (let i = 0; i < monthsCount; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, []);
    }

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const ad = data.approvalDate?.toDate?.() || (data.approvalDate ? new Date(data.approvalDate) : null);
      const pd = data.priorityDate?.toDate?.() || (data.priorityDate ? new Date(data.priorityDate) : null);
      if (!ad || !pd || isNaN(ad.getTime()) || isNaN(pd.getTime())) return;
      const days = Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 0) return;
      const key = `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth.has(key)) return;
      byMonth.get(key)!.push(days);
    });

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const result: MedianByApprovalMonthEntry[] = [];
    byMonth.forEach((daysArr, key) => {
      if (daysArr.length === 0) return;
      const [y, m] = key.split("-").map(Number);
      daysArr.sort((a, b) => a - b);
      const median = daysArr[Math.floor(daysArr.length / 2)];
      result.push({
        month: `${monthNames[m - 1]} ${y}`,
        medianDays: median,
        count: daysArr.length,
      });
    });
    result.sort((a, b) => {
      const [aM, aY] = a.month.split(" ");
      const [bM, bY] = b.month.split(" ");
      const ai = monthNames.indexOf(aM) + 12 * parseInt(aY, 10);
      const bi = monthNames.indexOf(bM) + 12 * parseInt(bY, 10);
      return ai - bi;
    });
    return result;
  } catch (error) {
    console.error("Error fetching median processing time by approval month:", error);
    return [];
  }
}

// MARK: - Predictive Analytics Functions

/**
 * Calculate approval odds based on similar cases
 * Returns probabilities for Approved, RFE, and Denied outcomes
 */
export async function getApprovalOdds(
  formType: string,
  serviceCenter?: string,
  country?: string,
  caseAge?: number
): Promise<ApprovalOdds> {
  try {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";
    let q = query(
      collection(db, collectionName),
      where("formType", "==", formType),
      orderBy("createdAt", "desc"),
      limit(2000)
    );
    
    const snapshot = await getDocs(q);
    let similarCases = 0;
    let approvedCount = 0;
    let rfeCount = 0;
    let deniedCount = 0;
    
    // Data structures for service center and country breakdown
    const serviceCenterMap = new Map<string, {
      approved: number;
      rfe: number;
      denied: number;
      sampleSize: number;
    }>();
    const countryMap = new Map<string, {
      approved: number;
      rfe: number;
      denied: number;
      sampleSize: number;
    }>();

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      
      // Filter by service center if provided
      if (serviceCenter && data.serviceCenter !== serviceCenter) return;
      
      // Filter by country if provided
      if (country && data.beneficiaryCountry && !data.beneficiaryCountry.toLowerCase().includes(country.toLowerCase())) return;
      
      // Handle I-129F vs I-130 data structure
      const isI129F = formType === "I-129F";
      const startDate = isI129F 
        ? (data.noa1?.toDate?.() || data.noa1)
        : (data.priorityDate?.toDate?.() || data.priorityDate);
      const approvalDate = isI129F
        ? (data.noa2?.toDate?.() || data.noa2)
        : (data.approvalDate?.toDate?.() || data.approvalDate);
      
      // Filter by case age range if provided (±60 days)
      if (caseAge !== undefined && startDate) {
        const start = startDate instanceof Date ? startDate : new Date(startDate);
        if (!isNaN(start.getTime())) {
          const caseAgeDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (Math.abs(caseAgeDays - caseAge) > 60) return;
        }
      }
      
      // Determine status based on real Firebase data
      let status: "approved" | "rfe" | "denied" = "approved";
      
      // Check for RFE - use rfe field if present
      if (data.rfe !== null && data.rfe !== undefined) {
        status = "rfe";
        rfeCount++;
      } else if (approvalDate) {
        // Has approval date (noa2 for I-129F, approvalDate for I-130) means approved
        approvedCount++;
        status = "approved";
      } else {
        // Skip cases without clear status (no approval, no RFE, likely still processing)
        return;
      }
      
      similarCases++;
      
      // Track by service center
      const sc = data.serviceCenter || "Unknown";
      if (!serviceCenterMap.has(sc)) {
        serviceCenterMap.set(sc, { approved: 0, rfe: 0, denied: 0, sampleSize: 0 });
      }
      const scData = serviceCenterMap.get(sc)!;
      scData.sampleSize++;
      if (status === "approved") {
        scData.approved++;
      } else if (status === "rfe") {
        scData.rfe++;
      } else {
        scData.denied++;
      }
      
      // Track by country
      const beneficiaryCountry = data.beneficiaryCountry || "Unknown";
      if (!countryMap.has(beneficiaryCountry)) {
        countryMap.set(beneficiaryCountry, { approved: 0, rfe: 0, denied: 0, sampleSize: 0 });
      }
      const countryData = countryMap.get(beneficiaryCountry)!;
      countryData.sampleSize++;
      if (status === "approved") countryData.approved++;
      else if (status === "rfe") countryData.rfe++;
      else countryData.denied++;
    });

    if (similarCases === 0) {
      // Fallback to global stats
      return {
        approved: 70,
        rfe: 25,
        denied: 5,
        sampleSize: 0,
        confidence: "low",
      };
    }

    const approved = Math.round((approvedCount / similarCases) * 100);
    const rfe = Math.round((rfeCount / similarCases) * 100);
    const denied = Math.round((deniedCount / similarCases) * 100);
    
    // Normalize to ensure they add up to 100
    const total = approved + rfe + denied;
    const normalize = total > 0 ? 100 / total : 1;
    
    const confidence = similarCases >= 100 ? "high" : similarCases >= 30 ? "medium" : "low";
    
    // Build service center breakdown
    const approvalByServiceCenter = Array.from(serviceCenterMap.entries())
      .filter(([_, data]) => data.sampleSize >= 5)
      .map(([sc, data]) => ({
        serviceCenter: sc,
        approved: Math.round((data.approved / data.sampleSize) * 100),
        rfe: Math.round((data.rfe / data.sampleSize) * 100),
        denied: Math.round((data.denied / data.sampleSize) * 100),
        sampleSize: data.sampleSize,
      }))
      .sort((a, b) => b.sampleSize - a.sampleSize)
      .slice(0, 5); // Top 5 service centers
    
    // Build country breakdown
    const approvalByCountry = Array.from(countryMap.entries())
      .filter(([_, data]) => data.sampleSize >= 3)
      .map(([country, data]) => ({
        country,
        approved: Math.round((data.approved / data.sampleSize) * 100),
        rfe: Math.round((data.rfe / data.sampleSize) * 100),
        denied: Math.round((data.denied / data.sampleSize) * 100),
        sampleSize: data.sampleSize,
      }))
      .sort((a, b) => b.sampleSize - a.sampleSize)
      .slice(0, 5); // Top 5 countries

    return {
      approved: Math.round(approved * normalize),
      rfe: Math.round(rfe * normalize),
      denied: Math.round(denied * normalize),
      sampleSize: similarCases,
      confidence,
      // Removed processing time stats, distribution, and recent trends per user request
    };
  } catch (error) {
    console.error("Error calculating approval odds:", error);
    return {
      approved: 70,
      rfe: 25,
      denied: 5,
      sampleSize: 0,
      confidence: "low",
    };
  }
}

/**
 * Estimate timeline based on similar cases and processing patterns
 */
export async function getTimelineEstimate(
  formType: string,
  priorityDate: Date,
  serviceCenter?: string
): Promise<TimelineEstimate> {
  try {
    const distribution = await getProcessingTimeDistribution(formType);
    if (!distribution) {
      // Fallback estimate
      const medianDays = formType === "I-130" ? 450 : 240;
      const estimatedDate = new Date(priorityDate);
      estimatedDate.setDate(estimatedDate.getDate() + medianDays);
      return {
        earliest: new Date(estimatedDate.getTime() - 90 * 24 * 60 * 60 * 1000),
        latest: new Date(estimatedDate.getTime() + 90 * 24 * 60 * 60 * 1000),
        median: estimatedDate,
        confidence: "low",
        method: "Default estimate based on form type",
      };
    }

    // Calculate estimates based on distribution
    const medianDays = distribution.median;
    const minDays = distribution.min;
    const maxDays = distribution.max;
    
    const medianDate = new Date(priorityDate);
    medianDate.setDate(medianDate.getDate() + medianDays);
    
    const earliestDate = new Date(priorityDate);
    earliestDate.setDate(earliestDate.getDate() + Math.max(minDays, medianDays - 90));
    
    const latestDate = new Date(priorityDate);
    latestDate.setDate(latestDate.getDate() + Math.min(maxDays, medianDays + 120));

    const confidence = distribution.count >= 100 ? "high" : distribution.count >= 30 ? "medium" : "low";

    return {
      earliest: earliestDate,
      latest: latestDate,
      median: medianDate,
      confidence,
      method: `Based on ${distribution.count} similar ${formType} cases`,
    };
  } catch (error) {
    console.error("Error calculating timeline estimate:", error);
    const medianDays = formType === "I-130" ? 450 : 240;
    const estimatedDate = new Date(priorityDate);
    estimatedDate.setDate(estimatedDate.getDate() + medianDays);
    return {
      earliest: new Date(estimatedDate.getTime() - 90 * 24 * 60 * 60 * 1000),
      latest: new Date(estimatedDate.getTime() + 90 * 24 * 60 * 60 * 1000),
      median: estimatedDate,
      confidence: "low",
      method: "Fallback estimate",
    };
  }
}

/**
 * Calculate queue position based on priority date
 */
export async function getQueuePosition(
  formType: string,
  priorityDate: Date,
  currentLatestPD?: Date,
  currentUserId?: string // Optional: exclude current user from ranking
): Promise<QueuePosition> {
  try {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";
    const q = query(
      collection(db, collectionName),
      where("formType", "==", formType),
      orderBy("createdAt", "desc"),
      limit(1000)
    );
    
    const snapshot = await getDocs(q);
    const cases: Array<{ pd: Date; id: string }> = [];
    
    const isI129F = formType === "I-129F";
    
    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      // Get start date - I-129F uses noa1, I-130 uses priorityDate (with text fallback)
      let pd: Date | null = null;
      
      if (isI129F) {
        pd = data.noa1?.toDate?.() || (data.noa1 ? new Date(data.noa1) : null);
      } else {
        if (data.priorityDate?.toDate) {
          pd = data.priorityDate.toDate();
        } else if (data.priorityDate) {
          pd = new Date(data.priorityDate);
        } else if (data.priorityDateText) {
          pd = new Date(data.priorityDateText);
        }
      }
      
      if (pd && !isNaN(pd.getTime())) {
        cases.push({ pd, id: doc.id });
      }
    });

    // ALSO query user profiles to include other users' priority dates
    // This gives a more accurate ranking by including active cases, not just historical approvals
    // Only attempt if user is authenticated (required by Firestore security rules)
    try {
      // Check if user is authenticated before querying userProfiles
      const currentUser = auth.currentUser;
      if (currentUser) {
        const profilesQuery = query(
          collection(db, "userProfiles"),
          limit(500) // Limit to avoid performance issues
        );
        const profilesSnapshot = await getDocs(profilesQuery);
        
        profilesSnapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
          const data = doc.data();
          const userId = doc.id;
          
          // Skip current user if provided
          if (currentUserId && userId.includes(currentUserId)) {
            return;
          }
          
          // Check if this profile matches the form type
          const profileFormType = data.profileCaseType || data.formType;
          if (profileFormType !== formType) {
            return;
          }
          
          // Get priority date from profile
          const priorityDateStr = data.priorityDate || data.profilePriorityDate;
          const noa1DateStr = data.noa1Date;
          
          let pd: Date | null = null;
          
          if (isI129F && noa1DateStr) {
            pd = new Date(noa1DateStr);
          } else if (priorityDateStr) {
            pd = new Date(priorityDateStr);
          }
          
          if (pd && !isNaN(pd.getTime())) {
            cases.push({ pd, id: `profile_${userId}` });
          }
        });
        
        console.log(`[getQueuePosition] Added ${profilesSnapshot.docs.length} user profiles to ranking pool`);
      } else {
        // User not authenticated - skip userProfiles query silently
        // This is expected behavior, not an error
      }
    } catch (profileError: any) {
      const isPermissionError =
        profileError?.code === "permission-denied" ||
        (typeof profileError?.message === "string" &&
          (profileError.message.toLowerCase().includes("permission") ||
            profileError.message.toLowerCase().includes("insufficient")));
      
      // If profile query fails (permissions, network, etc.), continue with just approval data
      // Only log if it's not a permissions error (which is expected when not authenticated)
      if (!isPermissionError && process.env.NODE_ENV === "development") {
        console.warn("[getQueuePosition] Could not fetch user profiles, using approval data only:", profileError);
      }
      // Silently continue with approval data only
    }

    // COHORT-BASED CALCULATION: Compare against cases filed in similar timeframe
    // This makes it meaningful - shows progress relative to peers, not all historical cases
    
    // Define cohort window: ±90 days (3 months) around user's priority date
    const cohortWindowDays = 90;
    const cohortWindowMs = cohortWindowDays * 24 * 60 * 60 * 1000;
    const userPDTime = priorityDate.getTime();
    
    // Filter to cohort: cases within ±90 days of user's PD
    const cohortCases = cases.filter(c => {
      const diff = Math.abs(c.pd.getTime() - userPDTime);
      return diff <= cohortWindowMs;
    });
    
    // Sort cohort by priority date
    cohortCases.sort((a, b) => a.pd.getTime() - b.pd.getTime());
    
    // Calculate position within cohort
    let casesAheadInCohort = 0;
    let positionRank = 1;
    
    // Count cases in cohort with earlier PDs (they're ahead)
    for (let i = 0; i < cohortCases.length; i++) {
      if (cohortCases[i].pd.getTime() < userPDTime) {
        casesAheadInCohort++;
        positionRank = casesAheadInCohort + 1;
      } else if (cohortCases[i].pd.getTime() === userPDTime) {
        // Same priority date - user is at this position
        positionRank = casesAheadInCohort + 1;
        break;
      } else {
        // Cases after user's PD in cohort - user comes before these
        positionRank = casesAheadInCohort + 1;
        break;
      }
    }
    
    // Clamp positionRank to be within bounds [1, cohortCases.length]
    // If user is after all cohort cases, they're at the end (not beyond)
    positionRank = Math.min(Math.max(1, positionRank), cohortCases.length);
    
    // Percentile within cohort: 0% = oldest in cohort, 100% = newest in cohort
    // More meaningful: shows where you rank among your peers (similar filing time)
    const percentile = cohortCases.length > 0 
      ? Math.round((casesAheadInCohort / cohortCases.length) * 100) 
      : 50;
    
    // Clamp percentile to [0, 100] for safety
    const clampedPercentile = Math.min(Math.max(0, percentile), 100);
    
    // Defensive assertion in development
    if (process.env.NODE_ENV === 'development') {
      if (positionRank > cohortCases.length) {
        console.error(`[getQueuePosition] BUG: positionRank ${positionRank} exceeds cohort size ${cohortCases.length}`);
      }
      if (positionRank < 1) {
        console.error(`[getQueuePosition] BUG: positionRank ${positionRank} is less than 1`);
      }
    }
    
    // Log cohort info for debugging
    console.log(`[getQueuePosition] Cohort calculation: ${cohortCases.length} cases within ±${cohortWindowDays} days of user PD, user rank: ${positionRank}/${cohortCases.length}, percentile: ${clampedPercentile}%`);
    const isInRange = currentLatestPD ? priorityDate <= currentLatestPD : false;

    return {
      positionRank,
      totalTracked: cohortCases.length, // Show cohort size, not all cases
      percentile: clampedPercentile,
      casesAhead: casesAheadInCohort, // Cases ahead in your cohort
      currentProcessingPD: currentLatestPD,
      isInRange,
    };
  } catch (error) {
    console.error("Error calculating queue position:", error);
    return {
      positionRank: 0,
      totalTracked: 0,
      percentile: 50,
      casesAhead: 0,
      isInRange: false,
    };
  }
}

/**
 * Get neighbor comparison - similar cases and their status distribution
 */
export async function getNeighborComparison(
  formType: string,
  priorityDate: Date,
  serviceCenter?: string,
  windowDays: number = 60
): Promise<NeighborComparison> {
  try {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";
    const q = query(
      collection(db, collectionName),
      where("formType", "==", formType),
      orderBy("createdAt", "desc"),
      limit(1000)
    );
    
    const snapshot = await getDocs(q);
    const neighbors: Array<{ status: string; id: string }> = [];
    const statusCounts: Map<string, number> = new Map();
    
    const userPDTime = priorityDate.getTime();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    const isI129F = formType === "I-129F";
    
    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      
      // Filter by service center if provided
      if (serviceCenter && data.serviceCenter !== serviceCenter) return;
      
      // Get start date based on form type
      const startDate = isI129F
        ? (data.noa1?.toDate?.() || data.noa1)
        : (data.priorityDate?.toDate?.() || data.priorityDate);
      
      if (!startDate) return;
      
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      if (isNaN(start.getTime())) return;
      
      const startTime = start.getTime();
      
      // Include cases within window
      if (Math.abs(startTime - userPDTime) <= windowMs) {
        let status = "processing";
        
        // Determine status based on real Firebase data
        const approvalDate = isI129F
          ? (data.noa2?.toDate?.() || data.noa2)
          : (data.approvalDate?.toDate?.() || data.approvalDate);
        
        if (approvalDate) {
          status = "approved";
        } else if (data.rfe !== null && data.rfe !== undefined) {
          status = "rfe";
        }
        
        neighbors.push({ status, id: doc.id });
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      }
    });

    const distribution = Array.from(statusCounts.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / neighbors.length) * 100),
    }));

    return {
      totalNeighbors: neighbors.length,
      approvedCount: statusCounts.get("approved") || 0,
      processingCount: statusCounts.get("processing") || 0,
      rfeCount: statusCounts.get("rfe") || 0,
      distribution,
    };
  } catch (error) {
    console.error("Error getting neighbor comparison:", error);
    return {
      totalNeighbors: 0,
      approvedCount: 0,
      processingCount: 0,
      rfeCount: 0,
      distribution: [],
    };
  }
}

/**
 * Get upcoming approvals by beneficiary country
 * Predicts approvals in the next N days based on historical patterns
 */
export interface UpcomingApprovalByCountry {
  country: string;
  predictedApprovals: number;
  averageProcessingDays: number;
  recentApprovalRate: number; // Approvals per week
  casesInWindow: number;
  estimatedEarliestApproval?: Date;
  estimatedMostLikelyApproval?: Date;
  estimatedLatestApproval?: Date;
  userPosition?: UserCountryPosition;
}

export interface UserCountryPosition {
  rank: number; // User's rank (1 = first to be approved)
  totalCases: number; // Total cases in country queue
  estimatedUserApprovalDate?: Date; // User's estimated approval date
  daysUntilApproval?: number; // Days until user's estimated approval
}

export async function getUpcomingApprovalsByCountry(
  formType: string = "I-130",
  daysAhead: number = 30,
  userProfile?: { country?: string; priorityDate?: string; formType?: string }
): Promise<UpcomingApprovalByCountry[]> {
  try {
    const collectionName = formType === "I-130" ? "i130Approvals" : "i129fApprovals";
    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        where("formType", "==", formType),
        orderBy("createdAt", "desc"),
        limit(2000)
      )
    );

    const countryData: Map<string, { approvals: Date[]; processingDays: number[] }> = new Map();
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - 90); // Last 90 days for recent rate

    const isI129F = formType === "I-129F";

    // Process approvals and group by country
    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const country = data.beneficiaryCountry;
      if (!country || country === "") return;

      // Get approval date
      let approvalDate: Date | null = null;
      if (isI129F) {
        const noa2 = data.noa2Date || data.noa2;
        approvalDate = noa2?.toDate?.() || (noa2 ? new Date(noa2) : null);
      } else {
        approvalDate = data.approvalDate?.toDate?.() || (data.approvalDate ? new Date(data.approvalDate) : null);
      }

      if (!approvalDate || isNaN(approvalDate.getTime())) return;

      // Get processing days
      let processingDays: number | null = null;
      if (isI129F) {
        const noa1 = data.noa1Date?.toDate?.() || (data.noa1Date ? new Date(data.noa1Date) : null);
        if (noa1 && !isNaN(noa1.getTime())) {
          processingDays = Math.floor((approvalDate.getTime() - noa1.getTime()) / (1000 * 60 * 60 * 24));
        }
      } else {
        const pd = data.priorityDate?.toDate?.() || (data.priorityDate ? new Date(data.priorityDate) : null);
        if (pd && !isNaN(pd.getTime())) {
          processingDays = Math.floor((approvalDate.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const existing = countryData.get(country) || { approvals: [], processingDays: [] };
      existing.approvals.push(approvalDate);
      if (processingDays !== null && processingDays > 0) {
        existing.processingDays.push(processingDays);
      }
      countryData.set(country, existing);
    });

    // Calculate predictions for each country
    const predictions: UpcomingApprovalByCountry[] = [];

    countryData.forEach((data, country) => {
      if (data.approvals.length < 3) return; // Need at least 3 approvals for prediction

      // Calculate average processing days
      const avgProcessingDays =
        data.processingDays.length === 0
          ? formType === "I-130"
            ? 450
            : 300
          : Math.round(data.processingDays.reduce((sum, d) => sum + d, 0) / data.processingDays.length);

      // Calculate recent approval rate (approvals per week in last 90 days)
      const recentApprovals = data.approvals.filter((ad) => ad >= cutoffDate);
      const daysSinceCutoff = Math.floor((today.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
      const weeksSinceCutoff = Math.max(1, Math.floor(daysSinceCutoff / 7));
      const recentApprovalRate = recentApprovals.length / weeksSinceCutoff;

      // Estimate cases in approval window (cases that would be approved in next N days)
      const weeksAhead = daysAhead / 7.0;
      const predictedApprovals = Math.max(0, Math.round(recentApprovalRate * weeksAhead));

      // Cases in window: estimate based on typical processing time distribution
      const casesInWindow = predictedApprovals; // Simplified: use predicted as cases in window

      // Calculate estimated approval date range for this country
      const estimatedEarliestApproval = new Date(today);
      estimatedEarliestApproval.setDate(estimatedEarliestApproval.getDate() + Math.round(avgProcessingDays * 0.8));
      
      const estimatedMostLikelyApproval = new Date(today);
      estimatedMostLikelyApproval.setDate(estimatedMostLikelyApproval.getDate() + avgProcessingDays);
      
      const estimatedLatestApproval = new Date(today);
      estimatedLatestApproval.setDate(estimatedLatestApproval.getDate() + Math.round(avgProcessingDays * 1.2));

      // Calculate user's position if their country matches
      let userPosition: UserCountryPosition | undefined = undefined;
      if (
        userProfile?.country &&
        userProfile.country.toLowerCase() === country.toLowerCase() &&
        userProfile.formType === formType &&
        userProfile.priorityDate
      ) {
        // Parse user's priority date
        const userPD = new Date(userProfile.priorityDate);
        if (!isNaN(userPD.getTime())) {
          // Get all cases for this country to calculate user's rank
          const countryCases: Array<{ priorityDate: Date; hasApproval: boolean }> = [];

          snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
            const data = doc.data();
            const dataCountry = data.beneficiaryCountry;
            if (!dataCountry || dataCountry.toLowerCase() !== country.toLowerCase()) return;

            let pd: Date | null = null;
            if (isI129F) {
              const noa1 = data.noa1Date?.toDate?.() || (data.noa1Date ? new Date(data.noa1Date) : null);
              pd = noa1 && !isNaN(noa1.getTime()) ? noa1 : null;
            } else {
              const priorityDate = data.priorityDate?.toDate?.() || (data.priorityDate ? new Date(data.priorityDate) : null);
              pd = priorityDate && !isNaN(priorityDate.getTime()) ? priorityDate : null;
            }

            if (!pd) return;

            let hasApproval = false;
            if (isI129F) {
              hasApproval = !!(data.noa2Date || data.noa2);
            } else {
              hasApproval = !!data.approvalDate;
            }

            countryCases.push({ priorityDate: pd, hasApproval });
          });

          // Sort by priority date (earliest first)
          countryCases.sort((a, b) => a.priorityDate.getTime() - b.priorityDate.getTime());

          // Find user's rank (position in queue)
          const userRank = countryCases.findIndex((c) => c.priorityDate.getTime() === userPD.getTime());
          const totalCases = countryCases.length;

          // Calculate user's estimated approval date based on their case age and country average
          const userCaseAge = Math.floor((today.getTime() - userPD.getTime()) / (1000 * 60 * 60 * 24));
          const daysRemaining = Math.max(0, avgProcessingDays - userCaseAge);
          const estimatedUserApprovalDate = new Date(today);
          estimatedUserApprovalDate.setDate(estimatedUserApprovalDate.getDate() + daysRemaining);

          userPosition = {
            rank: userRank >= 0 ? userRank + 1 : totalCases + 1, // 1-based rank
            totalCases,
            estimatedUserApprovalDate: daysRemaining > 0 ? estimatedUserApprovalDate : undefined,
            daysUntilApproval: daysRemaining > 0 ? daysRemaining : undefined,
          };
        }
      }

      predictions.push({
        country,
        predictedApprovals,
        averageProcessingDays: avgProcessingDays,
        recentApprovalRate,
        casesInWindow,
        estimatedEarliestApproval,
        estimatedMostLikelyApproval,
        estimatedLatestApproval,
        userPosition,
      });
    });

    // Sort by predicted approvals (descending)
    const sorted = predictions.sort((a, b) => b.predictedApprovals - a.predictedApprovals);

    // Deduplicate countries by name (case-insensitive), keeping the highest predicted value
    const seen = new Map<string, UpcomingApprovalByCountry>();
    for (const item of sorted) {
      const key = item.country.trim().toLowerCase();
      const existing = seen.get(key);
      if (!existing || item.predictedApprovals > existing.predictedApprovals) {
        seen.set(key, item);
      }
    }

    return Array.from(seen.values());
  } catch (error) {
    console.error("Error calculating upcoming approvals by country:", error);
    return [];
  }
}
