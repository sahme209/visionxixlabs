import { TimelineStage, CaseTimeline } from "@/lib/types";
import { TimelineCalculator } from "@/lib/calculations/timeline";
import { i130TimelineCalculator } from "./i130TimelineCalculator";
import { i129fTimelineCalculator } from "./i129fTimelineCalculator";
import {
  getI485ProcessingDays,
  getI765ProcessingDays,
  getN400ProcessingDays,
  getN400ProcessingDaysRange,
} from "./aosTimelineCalculator";
import { getProStages, validatePath, type FormType, type ProcessingPath } from "./timelineDefinitionProvider";
import { embassyTimingService } from "./embassyTimingService";
import { getCountryCode } from "@/lib/utils/countryNormalizer";

/**
 * Timeline Service
 * Uses backend data from Firestore (i130Approvals, i129fApprovals) to calculate timelines
 * Matches iOS TimelineEngine.generateTimeline logic exactly
 */

/**
 * Generate timeline stages based on form type, priority date, and processing path
 * Uses backend data from Firestore for I-130 and I-129F
 */
export async function generateTimeline(
  formType: string,
  priorityDate: Date,
  country?: string,
  processingPath: "Consular" | "AOS" = "Consular",
  customPace?: number,
  currentStage?: string,
  serviceCenter?: string
): Promise<CaseTimeline | null> {
  if (!priorityDate || isNaN(priorityDate.getTime())) {
    return null;
  }

  const normalizedFormType = formType.toUpperCase().trim();
  const stages: TimelineStage[] = [];

  // Get base receipt date (for I-130: priorityDate; for I-129F: NOA1 date; etc.)
  const receiptDate = priorityDate;

  // Calculate USCIS approval date using backend data
  let approvalDate: Date;
  let approvalEarliest: Date;
  let approvalLatest: Date;

  if (normalizedFormType === "I-130" && processingPath === "Consular") {
    // I-130 Consular: Use I130TimelineCalculator (reads from Firestore i130Approvals)
    await i130TimelineCalculator.loadApprovalData();
    const result = i130TimelineCalculator.estimateApprovalDate(
      priorityDate,
      country,
      serviceCenter
    );
    
    approvalDate = result.estimatedDate;
    
    // Use narrow 1–2 week window around estimated date (not p25/p75 which can be 6+ months)
    const approvalWindowDays = 7; // ±7 days = 2-week total window
    approvalEarliest = new Date(approvalDate);
    approvalEarliest.setDate(approvalEarliest.getDate() - approvalWindowDays);
    approvalLatest = new Date(approvalDate);
    approvalLatest.setDate(approvalLatest.getDate() + approvalWindowDays);
    
    // Apply custom pace if provided (keep 2-week window)
    if (customPace && customPace > 0) {
      const baseDays = Math.round(
        (approvalDate.getTime() - priorityDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const adjustedDays = Math.floor(baseDays / customPace);
      approvalDate = new Date(priorityDate);
      approvalDate.setDate(approvalDate.getDate() + adjustedDays);
      const windowDays = 7;
      approvalEarliest = new Date(approvalDate);
      approvalEarliest.setDate(approvalEarliest.getDate() - windowDays);
      approvalLatest = new Date(approvalDate);
      approvalLatest.setDate(approvalLatest.getDate() + windowDays);
    }
  } else if (normalizedFormType === "I-129F") {
    // I-129F: Use I129FTimelineCalculator (reads from Firestore i129fApprovals)
    await i129fTimelineCalculator.recomputeMedians();
    const timelineResult = await i129fTimelineCalculator.calculateTimeline(
      receiptDate, // NOA1 date
      false, // hasRFE - TODO: get from profile
      undefined, // rfeDate
      undefined, // rfeResponseDate
      undefined, // usEmbassy - TODO: get from profile
      {} // userMilestones
    );
    
    // Get NOA2 date from timeline calculator (based on backend data)
    if (timelineResult.noa2Date) {
      approvalDate = timelineResult.noa2Date;
    } else {
      // Fallback: use median processing time if calculator didn't return a date
      const medians = i129fTimelineCalculator.getCachedMedians();
      const medianDays = medians.noa1ToNOA2Days || 300;
      approvalDate = new Date(receiptDate);
      approvalDate.setDate(approvalDate.getDate() + medianDays);
    }
    
    // Use narrow 1-week range (±3.5 days) around estimated date for precise estimates
    // This matches iOS behavior: cap the range to maximum 7 days for tight, precise estimates
    // Based on backend data, show a tight 1-week window (e.g., June 7 to June 14)
    const maxRangeDays = 7;
    const halfRange = maxRangeDays / 2; // 3.5 days
    
    approvalEarliest = new Date(approvalDate);
    approvalEarliest.setDate(approvalEarliest.getDate() - halfRange);
    approvalLatest = new Date(approvalDate);
    approvalLatest.setDate(approvalLatest.getDate() + halfRange);
    
    // Apply custom pace if provided
    if (customPace && customPace > 0) {
      const baseDays = Math.round(
        (approvalDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const adjustedDays = Math.floor(baseDays / customPace);
      approvalDate = new Date(receiptDate);
      approvalDate.setDate(approvalDate.getDate() + adjustedDays);
      
      // Maintain 1-week range even with custom pace
      const maxRangeDays = 7;
      const halfRange = maxRangeDays / 2;
      approvalEarliest = new Date(approvalDate);
      approvalEarliest.setDate(approvalEarliest.getDate() - halfRange);
      approvalLatest = new Date(approvalDate);
      approvalLatest.setDate(approvalLatest.getDate() + halfRange);
    }
  } else if (normalizedFormType === "I-485" && processingPath === "AOS") {
    // I-485 AOS: Use AOS calculator with category-specific processing times
    // Note: category should come from profile data, but for now use default
    const processingDays = getI485ProcessingDays(undefined); // TODO: get category from profile
    approvalDate = new Date(priorityDate);
    approvalDate.setDate(approvalDate.getDate() + processingDays);
    // Use 2-week window around estimate
    const windowDays = 7;
    approvalEarliest = new Date(approvalDate);
    approvalEarliest.setDate(approvalEarliest.getDate() - windowDays);
    approvalLatest = new Date(approvalDate);
    approvalLatest.setDate(approvalLatest.getDate() + windowDays);
  } else if (normalizedFormType === "I-765" && processingPath === "AOS") {
    // I-765 AOS: Use AOS calculator (3.7 months)
    const processingDays = getI765ProcessingDays();
    approvalDate = new Date(priorityDate);
    approvalDate.setDate(approvalDate.getDate() + processingDays);
    // Use 2-week window around estimate
    const windowDays = 7;
    approvalEarliest = new Date(approvalDate);
    approvalEarliest.setDate(approvalEarliest.getDate() - windowDays);
    approvalLatest = new Date(approvalDate);
    approvalLatest.setDate(approvalLatest.getDate() + windowDays);
  } else if (normalizedFormType === "N-400" && processingPath === "AOS") {
    // N-400 AOS: Use AOS calculator (6.7 months, with tight range)
    const range = getN400ProcessingDaysRange();
    approvalDate = new Date(priorityDate);
    approvalDate.setDate(approvalDate.getDate() + range.median);
    approvalEarliest = new Date(priorityDate);
    approvalEarliest.setDate(approvalEarliest.getDate() + range.earliest);
    approvalLatest = new Date(priorityDate);
    approvalLatest.setDate(approvalLatest.getDate() + range.latest);
  } else {
    // Other forms: Use form-specific processing days (fallback) with 2-week window
    approvalDate = TimelineCalculator.estimateApprovalDate(normalizedFormType, priorityDate, customPace);
    const windowDays = 7;
    approvalEarliest = new Date(approvalDate);
    approvalEarliest.setDate(approvalEarliest.getDate() - windowDays);
    approvalLatest = new Date(approvalDate);
    approvalLatest.setDate(approvalLatest.getDate() + windowDays);
  }

  // Stage 1: USCIS Receipt
  stages.push({
    id: "uscis_receipt",
    name: "USCIS Receipt",
    description: "USCIS has received your petition and created your case in their system.",
    stageType: "uscis",
    earliestDate: receiptDate,
    latestDate: receiptDate,
    isCompleted: true,
    isCurrent: currentStage === "uscis",
    dataSource: "user",
  });

  // Stage 2: USCIS Processing
  stages.push({
    id: "uscis_processing",
    name: "USCIS Processing",
    description: "Your case is in the active USCIS processing queue and is being reviewed.",
    stageType: "uscis",
    earliestDate: receiptDate,
    latestDate: approvalDate,
    isCompleted: currentStage !== "uscis" && currentStage !== undefined,
    isCurrent: currentStage === "uscis",
    dataSource: "estimated",
  });

  // Stage 3: USCIS Approval
  stages.push({
    id: "uscis_approval",
    name: "USCIS Approval",
    description: "USCIS has approved your petition and issued an official approval notice.",
    stageType: "uscis",
    earliestDate: approvalEarliest,
    latestDate: approvalLatest,
    isCompleted: ["approved", "nvc", "dq", "medical", "interview", "visaIssued"].includes(currentStage || ""),
    isCurrent: currentStage === "approved",
    dataSource: "estimated",
  });

  // For Consular processing, add NVC and Embassy stages
  if (processingPath === "Consular" && (normalizedFormType === "I-130" || normalizedFormType === "I-129F" || normalizedFormType === "I-140")) {
    // Stage 4: NVC Transfer (7-28 days after approval, typically 14 days)
    // iOS: transferEarliest = approvalDate + 7, transferLatest = approvalDate + 14
    const nvcTransferEarliest = new Date(approvalDate);
    nvcTransferEarliest.setDate(nvcTransferEarliest.getDate() + 7);
    const nvcTransferLatest = new Date(approvalDate);
    nvcTransferLatest.setDate(nvcTransferLatest.getDate() + 14);

    stages.push({
      id: normalizedFormType === "I-129F" ? "sent_to_dos" : "nvc_transfer",
      name: normalizedFormType === "I-129F" ? "Sent to DOS (NVC)" : "NVC Transfer",
      description:
        normalizedFormType === "I-129F"
          ? "Your approved USCIS case has been forwarded to the Department of State (NVC)."
          : "USCIS has transferred your approved case to the National Visa Center (NVC).",
      stageType: "nvc",
      earliestDate: nvcTransferEarliest,
      latestDate: nvcTransferLatest,
      isCompleted: ["nvc", "dq", "medical", "interview", "visaIssued"].includes(currentStage || ""),
      isCurrent: currentStage === "nvc",
      dataSource: "estimated",
    });

    // Stage 5: NVC Processing (14 days after NVC transfer, not 60 days)
    // iOS: processingStart = nvcTransferDate, processingEnd = nvcTransferDate + 14
    const nvcProcessingStart = nvcTransferLatest;
    const nvcProcessingEnd = new Date(nvcTransferLatest);
    nvcProcessingEnd.setDate(nvcProcessingEnd.getDate() + 14);

    stages.push({
      id: "nvc_processing",
      name: "NVC Document Review",
      description: "NVC is reviewing your forms, fees, and documents to prepare your case for interview.",
      stageType: "nvc",
      earliestDate: nvcProcessingStart,
      latestDate: nvcProcessingEnd,
      isCompleted: ["dq", "medical", "interview", "visaIssued"].includes(currentStage || ""),
      isCurrent: currentStage === "nvc",
      dataSource: "estimated",
    });

    // Stage 6: DQ (Documentarily Qualified) - only for I-130/I-140, not I-129F
    // iOS: DQ is 28-32 days after approval (not after NVC processing end!)
    if (normalizedFormType === "I-130" || normalizedFormType === "I-140") {
      const dqEarliest = new Date(approvalDate);
      dqEarliest.setDate(dqEarliest.getDate() + 28);
      const dqLatest = new Date(approvalDate);
      dqLatest.setDate(dqLatest.getDate() + 32);

      stages.push({
        id: "dq",
        name: "Documentarily Qualified",
        description: "NVC has accepted all required documents and your case is ready for interview scheduling.",
        stageType: "nvc",
        earliestDate: dqEarliest,
        latestDate: dqLatest,
        isCompleted: ["dq", "medical", "interview", "visaIssued"].includes(currentStage || ""),
        isCurrent: currentStage === "dq",
        dataSource: country ? `country:${country}` : "estimated",
      });

      // Stage 7: Embassy Ready (same as DQ date for I-130/I-140)
      stages.push({
        id: "embassy_ready",
        name: country ? `Embassy/Consulate — ${country}` : "Embassy/Consulate",
        description: "Your case has been sent to the U.S. embassy/consulate to prepare for your visa interview.",
        stageType: "embassy",
        earliestDate: dqLatest,
        latestDate: dqLatest,
        isCompleted: ["medical", "interview", "visaIssued"].includes(currentStage || ""),
        isCurrent: false,
        dataSource: country ? `country:${country}` : "estimated",
      });

      // Stage 8: Medical Exam (country-specific offset from DQ)
      const countryOffsets = getCountryPostDQOffsets(country || "Other");
      const medicalDate = new Date(dqLatest);
      medicalDate.setDate(medicalDate.getDate() + countryOffsets.medical);

      stages.push({
        id: "medical",
        name: "Medical Exam",
        description: "You complete your required immigration medical exam with an approved physician.",
        stageType: "embassy",
        earliestDate: medicalDate,
        latestDate: medicalDate,
        isCompleted: ["medical", "interview", "visaIssued"].includes(currentStage || ""),
        isCurrent: currentStage === "medical",
        dataSource: country ? `country:${country}` : "estimated",
      });

      // Stage 9: Interview Scheduled - Use I130EmbassyTimingService for I-130 Consular (matches iOS)
      // iOS: Uses I130EmbassyTimingService.getTimingWithFallback() with minDays/maxDays from /i130EmbassyTiming collection
      let interviewEarliest: Date;
      let interviewLatest: Date;
      let interviewDataSource: string;
      
      if (normalizedFormType === "I-130" && processingPath === "Consular") {
        // For I-130 Consular: use embassyTimingService (matches iOS)
        // iOS: Uses I130EmbassyTimingService.getTimingWithFallback() with minDays/maxDays
        // iOS: referenceDate = DQ date (latest), interviewEarliest = referenceDate + timing.minDays, interviewLatest = referenceDate + timing.maxDays
        const countryCode = country ? getCountryCode(country) : undefined;
        const { timing, source } = embassyTimingService.getTimingWithFallback(countryCode, country);
        
        // Calculate interview dates using min/max (matches iOS exactly)
        interviewEarliest = new Date(dqLatest);
        interviewEarliest.setDate(interviewEarliest.getDate() + timing.minDays);
        interviewLatest = new Date(dqLatest);
        interviewLatest.setDate(interviewLatest.getDate() + timing.maxDays);
        
        interviewDataSource = source;
      } else {
        // For I-140 or fallback: use country-specific offsets
        interviewEarliest = new Date(dqLatest);
        interviewEarliest.setDate(interviewEarliest.getDate() + Math.floor(countryOffsets.interview * 0.8));
        interviewLatest = new Date(dqLatest);
        interviewLatest.setDate(interviewLatest.getDate() + Math.floor(countryOffsets.interview * 1.4));
        
        interviewDataSource = country ? `country:${country}` : "estimated";
      }

      stages.push({
        id: "interview_scheduled",
        name: "Interview Scheduled",
        description: "The U.S. embassy/consulate has scheduled the date for your visa interview.",
        stageType: "embassy",
        earliestDate: interviewEarliest,
        latestDate: interviewLatest,
        isCompleted: ["interview", "visaIssued"].includes(currentStage || ""),
        isCurrent: currentStage === "interview",
        dataSource: interviewDataSource,
      });

      // Stage 10: Interview (same dates as interview_scheduled)
      stages.push({
        id: "interview",
        name: "Consular Interview",
        description: "You attend your in-person visa interview at the U.S. embassy/consulate.",
        stageType: "embassy",
        earliestDate: interviewEarliest,
        latestDate: interviewLatest,
        isCompleted: ["interview", "visaIssued"].includes(currentStage || ""),
        isCurrent: currentStage === "interview",
        dataSource: interviewDataSource,
      });

      // Stage 11: Visa Issued - For I-130 Consular: 7-21 days after interview (matches iOS)
      // iOS: Uses interview date (latest) + 7 days (earliest) and + 21 days (latest)
      let visaEarliest: Date;
      let visaLatest: Date;
      
      if (normalizedFormType === "I-130" && processingPath === "Consular") {
        // I-130 Consular: visa typically issued 7-21 days after interview (matches iOS)
        // iOS: visaEarliest = calendar.date(byAdding: .day, value: 7, to: interviewDate)
        //      visaLatest = calendar.date(byAdding: .day, value: 21, to: interviewDate)
        const interviewDate = interviewLatest; // iOS uses interview date (latest)
        visaEarliest = new Date(interviewDate);
        visaEarliest.setDate(visaEarliest.getDate() + 7);
        visaLatest = new Date(interviewDate);
        visaLatest.setDate(visaLatest.getDate() + 21);
      } else {
        // I-140 or fallback: use country-specific offsets
        visaEarliest = new Date(interviewLatest);
        visaEarliest.setDate(visaEarliest.getDate() + Math.floor(countryOffsets.visa * 0.9));
        visaLatest = new Date(interviewLatest);
        visaLatest.setDate(visaLatest.getDate() + Math.floor(countryOffsets.visa * 1.5));
      }

      stages.push({
        id: "visa_issued",
        name: "Visa Issued",
        description: "Visa approved and issued",
        stageType: "embassy",
        earliestDate: visaEarliest,
        latestDate: visaLatest,
        isCompleted: currentStage === "visaIssued",
        isCurrent: currentStage === "visaIssued",
        dataSource: country ? `country:${country}` : "estimated",
      });
    } else if (normalizedFormType === "I-129F") {
      // I-129F: No DQ stage, goes directly to Embassy Receives
      // Stage 6: Embassy Receives (14-28 days after sent_to_dos, typically 21 days)
      const embassyReceivesEarliest = new Date(nvcTransferLatest);
      embassyReceivesEarliest.setDate(embassyReceivesEarliest.getDate() + 14);
      const embassyReceivesLatest = new Date(nvcTransferLatest);
      embassyReceivesLatest.setDate(embassyReceivesLatest.getDate() + 28);

      stages.push({
        id: "embassy_receives",
        name: "Embassy/Consulate Receives Case",
        description: "Case received by embassy",
        stageType: "nvc",
        earliestDate: embassyReceivesEarliest,
        latestDate: embassyReceivesLatest,
        isCompleted: ["medical", "interview", "visaIssued"].includes(currentStage || ""),
        isCurrent: false,
        dataSource: country ? `country:${country}` : "estimated",
      });

      // Stage 7: Embassy Ready (same as embassy_receives for I-129F)
      stages.push({
        id: "embassy_ready",
        name: country ? `Embassy/Consulate — ${country}` : "Embassy/Consulate",
        description: "Case ready for embassy processing",
        stageType: "embassy",
        earliestDate: embassyReceivesLatest,
        latestDate: embassyReceivesLatest,
        isCompleted: ["medical", "interview", "visaIssued"].includes(currentStage || ""),
        isCurrent: false,
        dataSource: country ? `country:${country}` : "estimated",
      });

      // Stage 8: Interview (country-specific offset from embassy_receives)
      const countryOffsets = getCountryPostDQOffsets(country || "Other");
      const interviewEarliest = new Date(embassyReceivesLatest);
      interviewEarliest.setDate(interviewEarliest.getDate() + Math.floor(countryOffsets.interview * 0.8));
      const interviewLatest = new Date(embassyReceivesLatest);
      interviewLatest.setDate(interviewLatest.getDate() + Math.floor(countryOffsets.interview * 1.4));

      stages.push({
        id: "interview_scheduled",
        name: "Interview Scheduled",
        description: "Consular interview scheduled",
        stageType: "embassy",
        earliestDate: interviewEarliest,
        latestDate: interviewLatest,
        isCompleted: ["interview", "visaIssued"].includes(currentStage || ""),
        isCurrent: currentStage === "interview",
        dataSource: country ? `country:${country}` : "estimated",
      });

      stages.push({
        id: "interview",
        name: "Consular Interview",
        description: "Consular interview",
        stageType: "embassy",
        earliestDate: interviewEarliest,
        latestDate: interviewLatest,
        isCompleted: ["interview", "visaIssued"].includes(currentStage || ""),
        isCurrent: currentStage === "interview",
        dataSource: country ? `country:${country}` : "estimated",
      });

      // Stage 9: Visa Issued (15-30 days after interview for I-129F)
      const visaEarliest = new Date(interviewLatest);
      visaEarliest.setDate(visaEarliest.getDate() + 15);
      const visaLatest = new Date(interviewLatest);
      visaLatest.setDate(visaLatest.getDate() + 30);

      stages.push({
        id: "visa_issued",
        name: "Visa Issued",
        description: "Visa approved and issued",
        stageType: "embassy",
        earliestDate: visaEarliest,
        latestDate: visaLatest,
        isCompleted: currentStage === "visaIssued",
        isCurrent: currentStage === "visaIssued",
        dataSource: country ? `country:${country}` : "estimated",
      });
    }
  }

  return {
    formType: normalizedFormType,
    processingPath,
    country,
    priorityDate,
    stages,
  };
}

/**
 * Returns country-specific post-DQ processing offsets (in days from DQ date)
 * Matches iOS getCountryPostDQOffsets logic
 * Uses CountryWaitTimeManager data structure
 */
function getCountryPostDQOffsets(country: string): { medical: number; interview: number; visa: number } {
  const countryLower = country.toLowerCase();
  
  // Country-specific wait times (simplified - iOS uses CountryWaitTimeManager)
  // These are days from DQ date
  const countryWaitTimes: Record<string, { medical: number; interview: number; visa: number }> = {
    india: { medical: 45, interview: 90, visa: 120 },
    china: { medical: 30, interview: 60, visa: 90 },
    philippines: { medical: 30, interview: 60, visa: 90 },
    mexico: { medical: 20, interview: 45, visa: 60 },
    pakistan: { medical: 45, interview: 90, visa: 120 },
    bangladesh: { medical: 45, interview: 90, visa: 120 },
    brazil: { medical: 20, interview: 45, visa: 60 },
    colombia: { medical: 20, interview: 45, visa: 60 },
    nigeria: { medical: 45, interview: 90, visa: 120 },
    ethiopia: { medical: 45, interview: 90, visa: 120 },
    jamaica: { medical: 30, interview: 60, visa: 90 },
    dominican: { medical: 30, interview: 60, visa: 90 },
    "dominican republic": { medical: 30, interview: 60, visa: 90 },
    haiti: { medical: 30, interview: 60, visa: 90 },
    vietnam: { medical: 30, interview: 60, visa: 90 },
    thailand: { medical: 30, interview: 60, visa: 90 },
    "south korea": { medical: 20, interview: 45, visa: 60 },
    korea: { medical: 20, interview: 45, visa: 60 },
    japan: { medical: 20, interview: 45, visa: 60 },
    "united kingdom": { medical: 20, interview: 45, visa: 60 },
    uk: { medical: 20, interview: 45, visa: 60 },
    canada: { medical: 20, interview: 45, visa: 60 },
    australia: { medical: 20, interview: 45, visa: 60 },
    "south africa": { medical: 30, interview: 60, visa: 90 },
  };

  // Try exact match first
  if (countryWaitTimes[countryLower]) {
    return countryWaitTimes[countryLower];
  }

  // Try partial match
  for (const [key, value] of Object.entries(countryWaitTimes)) {
    if (countryLower.includes(key) || key.includes(countryLower)) {
      return value;
    }
  }

  // Default values (median from iOS)
  return { medical: 45, interview: 90, visa: 120 };
}

/**
 * Calculate case progress percentage from timeline
 * Based on completed stages
 */
export function calculateCaseProgress(timeline: CaseTimeline | null): number {
  if (!timeline || timeline.stages.length === 0) {
    return 0;
  }

  const completedStages = timeline.stages.filter((stage) => stage.isCompleted);
  return completedStages.length / timeline.stages.length;
}

/**
 * Get current timeline stage
 */
export function getCurrentStage(timeline: CaseTimeline | null): TimelineStage | null {
  if (!timeline) {
    return null;
  }

  return timeline.stages.find((stage) => stage.isCurrent) || null;
}
