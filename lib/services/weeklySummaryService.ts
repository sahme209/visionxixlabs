import { collection, query, where, getDocs, Timestamp, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile } from "./profileService";
import { QueuePositionCalculator } from "../calculations/queueCalculator";

export interface WeeklySummaryData {
  weekStart: Date;
  weekEnd: Date;
  userProfile: UserProfile;
  
  // Overall System Stats
  totalApprovals: number;
  totalRFEs: number;
  averageProcessingTime: number;
  processingPace: number; // days processed per day
  
  // User-Specific Insights
  userPositionChange: {
    previousWeekRank: number;
    currentWeekRank: number;
    rankChange: number;
    percentile: number;
    percentileChange: number;
    casesAhead: number;
    totalTracked: number;
  };
  
  similarCasesApproved: number;
  similarCasesRFE: number;
  similarCasesPending: number;
  
  // Service Center Performance
  serviceCenterStats: {
    name: string;
    approvals: number;
    averageProcessingTime: number;
    pace: number;
  };
  
  // Country-Specific Stats
  countryStats: {
    country: string;
    approvals: number;
    averageProcessingTime: number;
  };
  
  // Timeline Insights
  timelineUpdate: {
    previousEstimate: Date | null;
    currentEstimate: Date;
    daysChanged: number;
    confidence: string;
  };
  
  // Daily breakdown for charts
  approvalsByDay: { date: string; label: string; count: number }[];
  
  // Key Highlights
  highlights: string[];
  
  // Recommendations
  recommendations: Array<{
    type: "action" | "info" | "warning";
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }>;
  
  generatedAt: Date;
}

interface ApprovalData {
  id: string;
  formType: string;
  priorityDate: Date;
  approvalDate: Date;
  serviceCenter?: string;
  country?: string;
  processingDays: number;
  status: "approved" | "rfe" | "denied";
}

/**
 * Calculate weekly summary for a user based on their profile and backend data
 */
export async function calculateWeeklySummary(
  userProfile: UserProfile,
  weekStart?: Date
): Promise<WeeklySummaryData> {
  const now = new Date();
  const startOfWeek = weekStart || getStartOfWeek(now);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  const previousWeekStart = new Date(startOfWeek);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  
  // Fetch approvals from this week
  const thisWeekApprovals = await fetchApprovalsForPeriod(
    userProfile.formType,
    startOfWeek,
    endOfWeek
  );
  
  // Fetch approvals from previous week for comparison
  const previousWeekEnd = new Date(startOfWeek);
  previousWeekEnd.setMilliseconds(previousWeekEnd.getMilliseconds() - 1);
  const previousWeekApprovals = await fetchApprovalsForPeriod(
    userProfile.formType,
    previousWeekStart,
    previousWeekEnd
  );
  
  // Calculate overall stats
  const totalApprovals = thisWeekApprovals.filter(a => a.status === "approved").length;
  const totalRFEs = thisWeekApprovals.filter(a => a.status === "rfe").length;
  const averageProcessingTime = calculateAverageProcessingTime(thisWeekApprovals);
  const processingPace = calculateProcessingPace(thisWeekApprovals, startOfWeek, endOfWeek);
  
  // Calculate user position
  const userPD = new Date(userProfile.priorityDate);
  const userPositionChange = await calculateUserPositionChange(
    userProfile,
    userPD,
    thisWeekApprovals,
    previousWeekApprovals
  );
  
  // Calculate similar cases stats
  const similarCases = filterSimilarCases(thisWeekApprovals, userProfile);
  const similarCasesApproved = similarCases.filter(c => c.status === "approved").length;
  const similarCasesRFE = similarCases.filter(c => c.status === "rfe").length;
  const similarCasesPending = similarCases.length - similarCasesApproved - similarCasesRFE;
  
  // Service center stats
  const serviceCenterStats = calculateServiceCenterStats(
    thisWeekApprovals,
    userProfile.serviceCenter || ""
  );
  
  // Country stats
  const countryStats = calculateCountryStats(
    thisWeekApprovals,
    userProfile.country || ""
  );
  
  // Timeline update
  const timelineUpdate = await calculateTimelineUpdate(
    userProfile,
    thisWeekApprovals,
    previousWeekApprovals
  );
  
  // Generate highlights
  const highlights = generateHighlights(
    totalApprovals,
    userPositionChange,
    similarCasesApproved,
    serviceCenterStats,
    timelineUpdate
  );
  
  // Generate recommendations
  const recommendations = generateRecommendations(
    userProfile,
    userPositionChange,
    similarCasesApproved,
    timelineUpdate,
    serviceCenterStats
  );
  
  // Build approvals by day for chart
  const byDay: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    byDay[key] = 0;
  }
  thisWeekApprovals
    .filter(a => a.status === "approved")
    .forEach(a => {
      const key = `${a.approvalDate.getFullYear()}-${String(a.approvalDate.getMonth() + 1).padStart(2, "0")}-${String(a.approvalDate.getDate()).padStart(2, "0")}`;
      if (byDay[key] !== undefined) byDay[key]++;
    });
  const approvalsByDay = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => {
      const [y, m, day] = date.split("-").map(Number);
      const d = new Date(y, m - 1, day);
      return {
        date,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        count,
      };
    });
  
  return {
    weekStart: startOfWeek,
    weekEnd: endOfWeek,
    userProfile,
    totalApprovals,
    totalRFEs,
    averageProcessingTime,
    processingPace,
    userPositionChange,
    similarCasesApproved,
    similarCasesRFE,
    similarCasesPending,
    serviceCenterStats,
    countryStats,
    timelineUpdate,
    approvalsByDay,
    highlights,
    recommendations,
    generatedAt: now,
  };
}

/**
 * Fetch approvals from Firestore for a given period
 */
async function fetchApprovalsForPeriod(
  formType: string,
  startDate: Date,
  endDate: Date
): Promise<ApprovalData[]> {
  const collectionName = formType === "I-129F" ? "i129fApprovals" : "i130Approvals";
  
  try {
    const q = query(
      collection(db, collectionName),
      where("formType", "==", formType),
      where("approvalDate", ">=", Timestamp.fromDate(startDate)),
      where("approvalDate", "<=", Timestamp.fromDate(endDate)),
      orderBy("approvalDate", "desc"),
      limit(5000)
    );
    
    const snapshot = await getDocs(q);
    const approvals: ApprovalData[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const approvalDate = data.approvalDate?.toDate?.() || new Date(data.approvalDateText || data.approvalDate);
      const priorityDate = data.priorityDate?.toDate?.() || new Date(data.priorityDateText || data.priorityDate);
      
      if (approvalDate && priorityDate) {
        const processingDays = Math.floor(
          (approvalDate.getTime() - priorityDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        approvals.push({
          id: doc.id,
          formType: data.formType || formType,
          priorityDate,
          approvalDate,
          serviceCenter: data.serviceCenter || data.casePrefixServiceCenter,
          country: data.country || data.countryOfOrigin,
          processingDays,
          status: data.status || "approved",
        });
      }
    });
    
    return approvals;
  } catch (error) {
    console.error("Error fetching approvals:", error);
    // Fallback: try without date filters if index is missing
    try {
      const q = query(
        collection(db, collectionName),
        where("formType", "==", formType),
        orderBy("approvalDate", "desc"),
        limit(5000)
      );
      
      const snapshot = await getDocs(q);
      const approvals: ApprovalData[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const approvalDate = data.approvalDate?.toDate?.() || new Date(data.approvalDateText || data.approvalDate);
        const priorityDate = data.priorityDate?.toDate?.() || new Date(data.priorityDateText || data.priorityDate);
        
        if (approvalDate && priorityDate) {
          // Filter in memory
          if (approvalDate >= startDate && approvalDate <= endDate) {
            const processingDays = Math.floor(
              (approvalDate.getTime() - priorityDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            
            approvals.push({
              id: doc.id,
              formType: data.formType || formType,
              priorityDate,
              approvalDate,
              serviceCenter: data.serviceCenter || data.casePrefixServiceCenter,
              country: data.country || data.countryOfOrigin,
              processingDays,
              status: data.status || "approved",
            });
          }
        }
      });
      
      return approvals;
    } catch (fallbackError) {
      console.error("Error in fallback fetch:", fallbackError);
      return [];
    }
  }
}

/**
 * Calculate user position change
 */
async function calculateUserPositionChange(
  userProfile: UserProfile,
  userPD: Date,
  thisWeekApprovals: ApprovalData[],
  previousWeekApprovals: ApprovalData[]
): Promise<WeeklySummaryData["userPositionChange"]> {
  // Get all tracked cases (combine this week and previous week for full dataset)
  const allApprovals = [...thisWeekApprovals, ...previousWeekApprovals];
  const sortedCases = allApprovals
    .map(a => ({ priorityDate: a.priorityDate }))
    .sort((a, b) => a.priorityDate.getTime() - b.priorityDate.getTime());
  
  // Calculate current position
  const currentRank = QueuePositionCalculator.calculatePositionRank(userPD, sortedCases);
  const currentPercentile = QueuePositionCalculator.calculatePercentile(currentRank, sortedCases.length);
  
  // Calculate previous week position (using only previous week data)
  const previousSortedCases = previousWeekApprovals
    .map(a => ({ priorityDate: a.priorityDate }))
    .sort((a, b) => a.priorityDate.getTime() - b.priorityDate.getTime());
  
  const previousRank = QueuePositionCalculator.calculatePositionRank(userPD, previousSortedCases);
  const previousPercentile = previousRank > 0 
    ? QueuePositionCalculator.calculatePercentile(previousRank, previousSortedCases.length)
    : currentPercentile;
  
  const totalTracked = sortedCases.length;
  const casesAhead = totalTracked - currentRank;

  return {
    previousWeekRank: previousRank,
    currentWeekRank: currentRank,
    rankChange: previousRank - currentRank, // Positive = moved forward
    percentile: currentPercentile,
    percentileChange: currentPercentile - previousPercentile,
    casesAhead,
    totalTracked,
  };
}

/**
 * Filter similar cases based on user profile
 */
function filterSimilarCases(
  approvals: ApprovalData[],
  userProfile: UserProfile
): ApprovalData[] {
  return approvals.filter((approval) => {
    const sameFormType = approval.formType === userProfile.formType;
    const sameServiceCenter = !userProfile.serviceCenter || 
      approval.serviceCenter === userProfile.serviceCenter;
    const sameCountry = !userProfile.country || 
      approval.country === userProfile.country;
    
    return sameFormType && sameServiceCenter && sameCountry;
  });
}

/**
 * Calculate service center stats
 */
function calculateServiceCenterStats(
  approvals: ApprovalData[],
  serviceCenter: string
): WeeklySummaryData["serviceCenterStats"] {
  const centerApprovals = approvals.filter(a => a.serviceCenter === serviceCenter);
  const centerApproved = centerApprovals.filter(a => a.status === "approved");
  
  const avgProcessingTime = centerApproved.length > 0
    ? centerApproved.reduce((sum, a) => sum + a.processingDays, 0) / centerApproved.length
    : 0;
  
  // Calculate pace (approvals per day)
  const uniqueDates = new Set(
    centerApproved.map(a => a.approvalDate.toDateString())
  );
  const pace = uniqueDates.size > 0 ? centerApproved.length / uniqueDates.size : 0;
  
  return {
    name: serviceCenter || "Unknown",
    approvals: centerApproved.length,
    averageProcessingTime: Math.round(avgProcessingTime),
    pace: Math.round(pace * 10) / 10,
  };
}

/**
 * Calculate country stats
 */
function calculateCountryStats(
  approvals: ApprovalData[],
  country: string
): WeeklySummaryData["countryStats"] {
  const countryApprovals = approvals.filter(a => a.country === country);
  const countryApproved = countryApprovals.filter(a => a.status === "approved");
  
  const avgProcessingTime = countryApproved.length > 0
    ? countryApproved.reduce((sum, a) => sum + a.processingDays, 0) / countryApproved.length
    : 0;
  
  return {
    country: country || "Unknown",
    approvals: countryApproved.length,
    averageProcessingTime: Math.round(avgProcessingTime),
  };
}

/**
 * Calculate timeline update
 */
async function calculateTimelineUpdate(
  userProfile: UserProfile,
  thisWeekApprovals: ApprovalData[],
  previousWeekApprovals: ApprovalData[]
): Promise<WeeklySummaryData["timelineUpdate"]> {
  const userPD = new Date(userProfile.priorityDate);
  const now = new Date();
  
  // Calculate current estimate based on recent approvals
  const recentApprovals = thisWeekApprovals.filter(a => a.status === "approved");
  const avgProcessingDays = recentApprovals.length > 0
    ? recentApprovals.reduce((sum, a) => sum + a.processingDays, 0) / recentApprovals.length
    : 450; // Default fallback
  
  const currentEstimate = new Date(userPD);
  currentEstimate.setDate(currentEstimate.getDate() + Math.round(avgProcessingDays));
  
  // Previous estimate (simplified - would need to store previous estimates)
  // TODO: Store previous estimates in Firestore to compare week-over-week
  let previousEstimate: Date | null = null;
  
  // Calculate days changed
  let daysChanged = 0;
  if (previousEstimate) {
    const prevTime = (previousEstimate as Date).getTime();
    const currTime = currentEstimate.getTime();
    daysChanged = Math.floor((currTime - prevTime) / (1000 * 60 * 60 * 24));
  }
  
  const confidence = recentApprovals.length >= 10 ? "high" : recentApprovals.length >= 5 ? "medium" : "low";
  
  return {
    previousEstimate,
    currentEstimate,
    daysChanged,
    confidence,
  };
}

/**
 * Calculate average processing time
 */
function calculateAverageProcessingTime(approvals: ApprovalData[]): number {
  const approved = approvals.filter(a => a.status === "approved");
  if (approved.length === 0) return 0;
  
  return Math.round(
    approved.reduce((sum, a) => sum + a.processingDays, 0) / approved.length
  );
}

/**
 * Calculate processing pace (days processed per day)
 */
function calculateProcessingPace(
  approvals: ApprovalData[],
  startDate: Date,
  endDate: Date
): number {
  const approved = approvals.filter(a => a.status === "approved");
  if (approved.length === 0) return 0;
  
  // Get unique priority dates processed
  const uniquePDs = new Set(
    approved.map(a => a.priorityDate.toDateString())
  );
  
  const daysInPeriod = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysInPeriod > 0 ? Math.round((uniquePDs.size / daysInPeriod) * 10) / 10 : 0;
}

/**
 * Generate highlights
 */
function generateHighlights(
  totalApprovals: number,
  userPositionChange: WeeklySummaryData["userPositionChange"],
  similarCasesApproved: number,
  serviceCenterStats: WeeklySummaryData["serviceCenterStats"],
  timelineUpdate: WeeklySummaryData["timelineUpdate"]
): string[] {
  const highlights: string[] = [];
  
  if (totalApprovals > 0) {
    highlights.push(`${totalApprovals} ${totalApprovals === 1 ? "case was" : "cases were"} approved this week`);
  }
  
  if (userPositionChange.rankChange > 0) {
    highlights.push(`You moved forward ${userPositionChange.rankChange} positions in the queue`);
  } else if (userPositionChange.rankChange < 0) {
    highlights.push(`Your queue position changed by ${Math.abs(userPositionChange.rankChange)} positions`);
  }
  
  if (similarCasesApproved > 0) {
    highlights.push(`${similarCasesApproved} similar ${similarCasesApproved === 1 ? "case was" : "cases were"} approved`);
  }
  
  if (serviceCenterStats.approvals > 0) {
    highlights.push(`${serviceCenterStats.approvals} ${serviceCenterStats.approvals === 1 ? "approval" : "approvals"} from your service center`);
  }
  
  if (timelineUpdate.daysChanged !== 0) {
    const direction = timelineUpdate.daysChanged > 0 ? "extended" : "shortened";
    highlights.push(`Your estimated timeline ${direction} by ${Math.abs(timelineUpdate.daysChanged)} days`);
  }
  
  return highlights;
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  userProfile: UserProfile,
  userPositionChange: WeeklySummaryData["userPositionChange"],
  similarCasesApproved: number,
  timelineUpdate: WeeklySummaryData["timelineUpdate"],
  serviceCenterStats: WeeklySummaryData["serviceCenterStats"]
): WeeklySummaryData["recommendations"] {
  const recommendations: WeeklySummaryData["recommendations"] = [];
  
  // Position-based recommendations
  if (userPositionChange.percentile < 25) {
    recommendations.push({
      type: "info",
      title: "You're in the top 25%",
      description: "Your case is progressing well. Keep monitoring for updates.",
      priority: "low",
    });
  } else if (userPositionChange.percentile > 75) {
    recommendations.push({
      type: "action",
      title: "Consider checking your case status",
      description: "Your case is in the bottom 25%. Consider contacting USCIS or checking for RFEs.",
      priority: "high",
    });
  }
  
  // Service center performance
  if (serviceCenterStats.pace < 1) {
    recommendations.push({
      type: "warning",
      title: "Service center pace is slow",
      description: `Your service center (${serviceCenterStats.name}) is processing fewer cases than usual.`,
      priority: "medium",
    });
  }
  
  // Similar cases approved
  if (similarCasesApproved > 5) {
    recommendations.push({
      type: "info",
      title: "Similar cases are being approved",
      description: `${similarCasesApproved} cases similar to yours were approved this week. This is a positive sign.`,
      priority: "medium",
    });
  }
  
  // Timeline updates
  if (timelineUpdate.daysChanged > 30) {
    recommendations.push({
      type: "warning",
      title: "Timeline extended significantly",
      description: "Your estimated approval date has been extended. Consider reviewing your case status.",
      priority: "high",
    });
  }
  
  return recommendations;
}

/**
 * Get start of week (Monday)
 */
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
