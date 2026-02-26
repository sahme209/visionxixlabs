// Ported from iOS: QueuePositionCalculatorService.swift
// Uses real backend data to calculate queue position (same as iOS)

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

export interface QueuePositionFromRealDataResult {
  position: number | null;
  isCurrent: boolean;
  context: string;
  latestPD: Date | null;
}

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

interface I129FApprovalData {
  id: string;
  formType: string;
  beneficiaryCountry: string;
  noa1Date: Date;
  noa2Date?: Date;
  notes?: string;
}

/**
 * Calculate queue position from real backend data
 * Ported from iOS QueuePositionCalculatorService.calculateQueuePositionFromRealData
 */
export async function calculateQueuePositionFromRealData(
  userPriorityDate: Date,
  formType: string,
  processingPath: string
): Promise<QueuePositionFromRealDataResult> {
  const formTypeUpper = formType.toUpperCase().trim();
  const pathUpper = processingPath.toUpperCase().trim();

  // Only calculate for I-130 Consular and I-129F
  if (!((formTypeUpper === "I-130" && pathUpper === "CONSULAR") || formTypeUpper === "I-129F")) {
    return {
      position: null,
      isCurrent: false,
      context: "Queue position calculation is only available for I-130 (Consular) and I-129F cases.",
      latestPD: null,
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get current processing PD from real data
  const currentPD = await calculateCurrentProcessingPD(formType);
  if (!currentPD) {
    return {
      position: null,
      isCurrent: false,
      context: "Unable to calculate queue position. Insufficient recent approval data.",
      latestPD: null,
    };
  }

  // Calculate days between user's PD and current processing PD
  const daysBetween = Math.floor(
    (userPriorityDate.getTime() - currentPD.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check if user's PD is actually current (there are recent approvals with PD >= user's PD)
  let recentApprovalsWithLaterPD = 0;
  let totalRecentApprovals = 0;

  if (formTypeUpper === "I-130") {
    try {
      // Query using composite index: formType + createdAt (desc)
      // Filter by date in memory after fetching
      const snapshot = await getDocs(
        query(
          collection(db, "i130Approvals"),
          where("formType", "==", "I-130"),
          orderBy("createdAt", "desc"),
          limit(1000)
        )
      );

      for (const doc of snapshot.docs) {
        const docData = doc.data();

        if (
          !docData.formType ||
          !docData.beneficiaryCountry ||
          !docData.priorityDate ||
          !docData.approvalDate
        ) {
          continue;
        }

        // Filter by date in memory
        const approvalDate = docData.approvalDate?.toDate?.() || (docData.approvalDate ? new Date(docData.approvalDate) : null);
        if (!approvalDate || approvalDate <= thirtyDaysAgo) {
          continue;
        }

        // Check if it's a non-standard case (expedite, appeal, denial)
        const notes = docData.notes as string | undefined;
        const isNonStandard =
          notes?.toLowerCase().includes("expedite") ||
          notes?.toLowerCase().includes("appeal") ||
          notes?.toLowerCase().includes("denial") ||
          notes?.toLowerCase().includes("denied");

        if (isNonStandard) {
          continue;
        }

        const priorityDate = docData.priorityDate.toDate
          ? docData.priorityDate.toDate()
          : new Date(docData.priorityDate.seconds * 1000);

        totalRecentApprovals++;
        if (priorityDate >= userPriorityDate) {
          recentApprovalsWithLaterPD++;
        }
      }
    } catch (error) {
      console.error("[QueuePositionService] Error checking I-130 current status:", error);
    }
  } else if (formTypeUpper === "I-129F") {
    try {
      // Query using composite index: formType + createdAt (desc)
      // Filter by date in memory after fetching
      const snapshot = await getDocs(
        query(
          collection(db, "i129fApprovals"),
          where("formType", "==", "I-129F"),
          orderBy("createdAt", "desc"),
          limit(1000)
        )
      );

      for (const doc of snapshot.docs) {
        const docData = doc.data();

        if (!docData.formType || !docData.beneficiaryCountry || !docData.noa1Date) {
          continue;
        }

        // Filter by date in memory
        const noa2Date = docData.noa2Date?.toDate?.() || (docData.noa2Date ? new Date(docData.noa2Date) : null);
        if (!noa2Date || noa2Date <= thirtyDaysAgo) {
          continue;
        }

        // Check if it's a non-standard case
        const notes = docData.notes as string | undefined;
        const isNonStandard =
          notes?.toLowerCase().includes("expedite") ||
          notes?.toLowerCase().includes("appeal") ||
          notes?.toLowerCase().includes("denial") ||
          notes?.toLowerCase().includes("denied");

        if (isNonStandard) {
          continue;
        }

        // For I-129F, NOA1 date is the priority date
        const noa1Date = docData.noa1Date.toDate
          ? docData.noa1Date.toDate()
          : new Date(docData.noa1Date.seconds * 1000);

        totalRecentApprovals++;
        if (noa1Date >= userPriorityDate) {
          recentApprovalsWithLaterPD++;
        }
      }
    } catch (error) {
      console.error("[QueuePositionService] Error checking I-129F current status:", error);
    }
  }

  // If user's PD is current or past, and we have recent approvals with later PDs, they're current
  const isCurrent = daysBetween <= 0 && recentApprovalsWithLaterPD > 0;

  if (isCurrent) {
    const context = `Based on recent approvals, your priority date is being processed. ${recentApprovalsWithLaterPD} case(s) with priority dates on or after yours have been approved in the last 30 days.`;
    return {
      position: null,
      isCurrent: true,
      context,
      latestPD: currentPD,
    };
  }

  // Calculate approximate queue position based on days between and recent approval pace
  // Get average daily processing rate from recent data
  const avgDailyRate = await calculateAverageDailyProcessingRate(formType);

  // Calculate position: days between × average daily processing rate
  const rawPosition = daysBetween * avgDailyRate;

  // Round to nearest 50 for authenticity
  const roundedPosition = Math.round(rawPosition / 50.0) * 50.0;

  // Clamp to reasonable range
  const clampedPosition = Math.max(50, Math.min(50000, roundedPosition));

  // Generate context message
  let context: string;
  if (clampedPosition < 500) {
    context = `You're approximately #${formatNumber(clampedPosition)} in the processing queue. Based on recent approval data, your case is getting close.`;
  } else if (clampedPosition < 2000) {
    context = `You're approximately #${formatNumber(clampedPosition)} in the processing queue. Based on current processing pace from real approval data.`;
  } else {
    context = `You're approximately #${formatNumber(clampedPosition)} in the processing queue. This estimate is based on real approval data from the last 30 days.`;
  }

  return {
    position: clampedPosition,
    isCurrent: false,
    context,
    latestPD: currentPD,
  };
}

/**
 * Calculate current processing PD from recent approvals (14-30 day rolling median)
 * Ported from iOS calculateCurrentProcessingPD
 */
async function calculateCurrentProcessingPD(formType: string): Promise<Date | null> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const priorityDates: Date[] = [];

  const formTypeUpper = formType.toUpperCase().trim();

  // PRIMARY SOURCE: i130Approvals (admin-entered approval records)
  if (formTypeUpper === "I-130") {
    try {
      // Query using composite index: formType + createdAt (desc)
      // Filter by date in memory after fetching
      const snapshot = await getDocs(
        query(
          collection(db, "i130Approvals"),
          where("formType", "==", "I-130"),
          orderBy("createdAt", "desc"),
          limit(1000)
        )
      );

      for (const doc of snapshot.docs) {
        const docData = doc.data();

        if (
          !docData.formType ||
          !docData.beneficiaryCountry ||
          !docData.priorityDate ||
          !docData.approvalDate
        ) {
          continue;
        }

        // Filter by date in memory
        const approvalDate = docData.approvalDate?.toDate?.() || (docData.approvalDate ? new Date(docData.approvalDate) : null);
        if (!approvalDate || approvalDate <= thirtyDaysAgo) {
          continue;
        }

        // Check if it's a non-standard case
        const notes = docData.notes as string | undefined;
        const isNonStandard =
          notes?.toLowerCase().includes("expedite") ||
          notes?.toLowerCase().includes("appeal") ||
          notes?.toLowerCase().includes("denial") ||
          notes?.toLowerCase().includes("denied");

        if (isNonStandard) {
          continue;
        }

        const priorityDate = docData.priorityDate.toDate
          ? docData.priorityDate.toDate()
          : new Date(docData.priorityDate.seconds * 1000);

        priorityDates.push(priorityDate);
      }
    } catch (error) {
      console.error("[QueuePositionService] Error fetching I-130 recent approvals:", error);
    }
  } else if (formTypeUpper === "I-129F") {
    // For I-129F, use NOA1 date as priority date (receipt date)
    try {
      // Query using composite index: formType + createdAt (desc)
      // Filter by date in memory after fetching
      const snapshot = await getDocs(
        query(
          collection(db, "i129fApprovals"),
          where("formType", "==", "I-129F"),
          orderBy("createdAt", "desc"),
          limit(1000)
        )
      );

      for (const doc of snapshot.docs) {
        const docData = doc.data();

        if (!docData.formType || !docData.beneficiaryCountry || !docData.noa1Date) {
          continue;
        }

        // Filter by date in memory
        const noa2Date = docData.noa2Date?.toDate?.() || (docData.noa2Date ? new Date(docData.noa2Date) : null);
        if (!noa2Date || noa2Date <= thirtyDaysAgo) {
          continue;
        }

        // Check if it's a non-standard case
        const notes = docData.notes as string | undefined;
        const isNonStandard =
          notes?.toLowerCase().includes("expedite") ||
          notes?.toLowerCase().includes("appeal") ||
          notes?.toLowerCase().includes("denial") ||
          notes?.toLowerCase().includes("denied");

        if (isNonStandard) {
          continue;
        }

        // For I-129F, NOA1 date is the priority date
        const noa1Date = docData.noa1Date.toDate
          ? docData.noa1Date.toDate()
          : new Date(docData.noa1Date.seconds * 1000);

        priorityDates.push(noa1Date);
      }
    } catch (error) {
      console.error("[QueuePositionService] Error fetching I-129F recent approvals:", error);
    }
  }

  // Need at least 10 samples for reliable median (reduced outliers)
  if (priorityDates.length < 10) {
    console.log(
      `[QueuePositionService] Insufficient recent approvals (${priorityDates.length} found, need 10) for current PD`
    );
    return null;
  }

  // Use median for current processing PD (50th percentile reduces impact of outliers)
  const sortedPDs = priorityDates.sort((a, b) => a.getTime() - b.getTime());
  const medianIndex = Math.floor(sortedPDs.length / 2);
  const currentPD = sortedPDs[medianIndex];

  console.log(
    `[QueuePositionService] Calculated current processing PD: ${formatDateForLog(currentPD)} from ${priorityDates.length} recent approvals`
  );
  return currentPD;
}

/**
 * Calculate average daily processing rate from recent approvals
 * Ported from iOS calculateAverageDailyProcessingRate
 */
async function calculateAverageDailyProcessingRate(formType: string): Promise<number> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const priorityDates: Date[] = [];
  const formTypeUpper = formType.toUpperCase().trim();

  if (formTypeUpper === "I-130") {
    try {
      // Query using composite index: formType + createdAt (desc)
      // Filter by date in memory after fetching
      const snapshot = await getDocs(
        query(
          collection(db, "i130Approvals"),
          where("formType", "==", "I-130"),
          orderBy("createdAt", "desc"),
          limit(1000)
        )
      );

      for (const doc of snapshot.docs) {
        const docData = doc.data();

        // Filter by date in memory
        const approvalDate = docData.approvalDate?.toDate?.() || (docData.approvalDate ? new Date(docData.approvalDate) : null);
        if (!approvalDate || approvalDate <= thirtyDaysAgo) {
          continue;
        }

        // Check if it's a non-standard case
        const notes = docData.notes as string | undefined;
        const isNonStandard =
          notes?.toLowerCase().includes("expedite") ||
          notes?.toLowerCase().includes("appeal") ||
          notes?.toLowerCase().includes("denial") ||
          notes?.toLowerCase().includes("denied");

        if (isNonStandard || !docData.priorityDate) {
          continue;
        }

        const priorityDate = docData.priorityDate.toDate
          ? docData.priorityDate.toDate()
          : new Date(docData.priorityDate.seconds * 1000);

        priorityDates.push(priorityDate);
      }
    } catch (error) {
      console.error("[QueuePositionService] Error calculating processing rate:", error);
    }
  } else if (formTypeUpper === "I-129F") {
    try {
      // Query using composite index: formType + createdAt (desc)
      // Filter by date in memory after fetching
      const snapshot = await getDocs(
        query(
          collection(db, "i129fApprovals"),
          where("formType", "==", "I-129F"),
          orderBy("createdAt", "desc"),
          limit(1000)
        )
      );

      for (const doc of snapshot.docs) {
        const docData = doc.data();

        // Filter by date in memory
        const noa2Date = docData.noa2Date?.toDate?.() || (docData.noa2Date ? new Date(docData.noa2Date) : null);
        if (!noa2Date || noa2Date <= thirtyDaysAgo) {
          continue;
        }

        // Check if it's a non-standard case
        const notes = docData.notes as string | undefined;
        const isNonStandard =
          notes?.toLowerCase().includes("expedite") ||
          notes?.toLowerCase().includes("appeal") ||
          notes?.toLowerCase().includes("denial") ||
          notes?.toLowerCase().includes("denied");

        if (isNonStandard || !docData.noa1Date) {
          continue;
        }

        // For I-129F, NOA1 date is the priority date
        const noa1Date = docData.noa1Date.toDate
          ? docData.noa1Date.toDate()
          : new Date(docData.noa1Date.seconds * 1000);

        priorityDates.push(noa1Date);
      }
    } catch (error) {
      console.error("[QueuePositionService] Error calculating I-129F processing rate:", error);
    }
  }

  if (priorityDates.length < 10) {
    // Fallback to default rate if insufficient data
    return 1.35;
  }

  // Calculate range of PDs processed in last 30 days
  const sortedPDs = priorityDates.sort((a, b) => a.getTime() - b.getTime());
  const minPD = sortedPDs[0];
  const maxPD = sortedPDs[sortedPDs.length - 1];

  const pdDaysProcessed = Math.floor(
    (maxPD.getTime() - minPD.getTime()) / (1000 * 60 * 60 * 24)
  );
  const calendarDays = Math.max(
    1,
    Math.floor((now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Average PD days processed per calendar day
  const rate = pdDaysProcessed / calendarDays;

  // Clamp to reasonable range (0.5 to 2.5 days per day)
  return Math.max(0.5, Math.min(2.5, rate));
}

/**
 * Format number with commas
 */
function formatNumber(number: number): string {
  return number.toLocaleString("en-US");
}

/**
 * Format date for logging
 */
function formatDateForLog(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
