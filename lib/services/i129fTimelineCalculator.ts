import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { stateDepartmentWaitTimeService } from "./stateDepartmentWaitTimeService";

/**
 * I-129F Timeline Calculator
 * Fetches approval data from Firestore and computes median processing times
 * Matches iOS I129FTimelineCalculator functionality
 */

interface I129FApprovalData {
  id: string;
  formType: string;
  beneficiaryCountry: string;
  petitionerCountry: string;
  usEmbassy?: string;
  noa1Date: Date;
  rfeDate?: Date;
  rfeResponseDate?: Date;
  noa2Date?: Date;
  sentToDOSDate?: Date;
  caseNumberAssignedDate?: Date;
  consulateInTransitDate?: Date;
  consulateReadyDate?: Date;
  medicalDate?: Date;
  interviewDate?: Date;
  visaReceivedDate?: Date;
  usArrivalDate?: Date;
  notes?: string;
}

interface I129FMedianStats {
  noa1ToRfeDays?: number;
  rfeToRfeResponseDays?: number;
  rfeResponseToNOA2Days?: number;
  rfeToNOA2Days?: number;
  noa1ToNOA2Days: number;
  noa2ToSentToDOSDays: number;
  sentToDOSToCaseNumberDays: number;
  caseNumberToInTransitDays: number;
  inTransitToReadyDays: number;
  readyToMedicalDays?: number;
  medicalToInterviewDays?: number;
  readyToInterviewDays: number;
  interviewToVisaReceivedDays: number;
  visaReceivedToUSArrivalDays: number;
}

interface I129FTimelineResult {
  noa1Date?: Date;
  rfeDate?: Date;
  rfeResponseDate?: Date;
  noa2Date?: Date;
  sentToDOSDate?: Date;
  caseNumberAssignedDate?: Date;
  consulateInTransitDate?: Date;
  readyDate?: Date;
  medicalDate?: Date;
  interviewDate?: Date;
  visaReceivedDate?: Date;
  usArrivalDate?: Date;
}

class I129FTimelineCalculator {
  private static instance: I129FTimelineCalculator;
  private medianCache: I129FMedianStats | null = null;
  private cacheTimestamp: Date | null = null;
  private readonly cacheTTL = 3600 * 1000; // 1 hour in milliseconds
  private isLoading = false;

  private constructor() {
    // Load data on initialization
    this.recomputeMedians();
  }

  static getInstance(): I129FTimelineCalculator {
    if (!I129FTimelineCalculator.instance) {
      I129FTimelineCalculator.instance = new I129FTimelineCalculator();
    }
    return I129FTimelineCalculator.instance;
  }

  /**
   * Calculate complete I-129F timeline with re-anchoring from latest known milestone
   */
  async calculateTimeline(
    noa1Date: Date,
    hasRFE: boolean,
    rfeDate?: Date,
    rfeResponseDate?: Date,
    usEmbassy?: string,
    userMilestones: Record<string, Date> = {}
  ): Promise<I129FTimelineResult> {
    const medians = this.getCachedMedians();
    const calendar = new Date();

    // Find latest known milestone date (re-anchoring logic)
    let latestKnownMilestone: { stageId: string; date: Date } | null = null;
    const milestoneOrder = [
      "noa1",
      "rfe",
      "rfe_response",
      "noa2",
      "sent_to_dos",
      "case_number_assigned",
      "consulate_in_transit",
      "ready",
      "medical",
      "interview",
      "visa_received",
      "us_arrival",
    ];

    for (const stageId of milestoneOrder) {
      const date = userMilestones[stageId];
      if (date) {
        if (!latestKnownMilestone || date > latestKnownMilestone.date) {
          latestKnownMilestone = { stageId, date };
        }
      }
    }

    // Start from latest known milestone or NOA1
    const anchorDate = latestKnownMilestone?.date || noa1Date;
    const anchorStage = latestKnownMilestone?.stageId || "noa1";

    const result: I129FTimelineResult = {
      noa1Date,
    };

    // USCIS Phase: NOA1 → NOA2
    if (anchorStage === "noa1") {
      // Calculate forward from NOA1
      if (hasRFE) {
        if (rfeDate) {
          result.rfeDate = rfeDate;
          if (rfeResponseDate) {
            result.rfeResponseDate = rfeResponseDate;
            // NOA2 = RFE Response + median(RFE Response → NOA2)
            if (medians.rfeResponseToNOA2Days) {
              const noa2 = new Date(rfeResponseDate);
              noa2.setDate(noa2.getDate() + medians.rfeResponseToNOA2Days);
              result.noa2Date = noa2;
            } else if (medians.rfeToNOA2Days) {
              const noa2 = new Date(rfeDate);
              noa2.setDate(noa2.getDate() + medians.rfeToNOA2Days);
              result.noa2Date = noa2;
            }
          } else {
            // Estimate RFE Response = RFE + median(RFE → RFE Response)
            if (medians.rfeToRfeResponseDays) {
              const estimatedResponse = new Date(rfeDate);
              estimatedResponse.setDate(
                estimatedResponse.getDate() + medians.rfeToRfeResponseDays
              );
              result.rfeResponseDate = estimatedResponse;
              // NOA2 = estimated RFE Response + median(RFE Response → NOA2)
              if (medians.rfeResponseToNOA2Days) {
                const noa2 = new Date(estimatedResponse);
                noa2.setDate(noa2.getDate() + medians.rfeResponseToNOA2Days);
                result.noa2Date = noa2;
              } else if (medians.rfeToNOA2Days) {
                const noa2 = new Date(rfeDate);
                noa2.setDate(noa2.getDate() + medians.rfeToNOA2Days);
                result.noa2Date = noa2;
              }
            }
          }
        } else {
          // RFE enabled but no date - use NOA1 → NOA2 (non-RFE) baseline
          const noa2 = new Date(noa1Date);
          noa2.setDate(noa2.getDate() + medians.noa1ToNOA2Days);
          result.noa2Date = noa2;
        }
      } else {
        // No RFE - use NOA1 → NOA2 baseline
        const noa2 = new Date(noa1Date);
        noa2.setDate(noa2.getDate() + medians.noa1ToNOA2Days);
        result.noa2Date = noa2;
      }
    } else {
      // User has entered a later milestone - use user dates up to anchor, then calculate forward
      result.rfeDate = userMilestones["rfe"];
      result.rfeResponseDate = userMilestones["rfe_response"];
      result.noa2Date = userMilestones["noa2"] || result.noa2Date;
    }

    // DOS Phase
    const noa2 = result.noa2Date || anchorDate;
    if (anchorStage === "noa2" || (anchorDate.getTime() === noa2.getTime() && anchorStage !== "noa1")) {
      const sentToDOS = new Date(noa2);
      sentToDOS.setDate(sentToDOS.getDate() + medians.noa2ToSentToDOSDays);
      result.sentToDOSDate = sentToDOS;
      if (result.sentToDOSDate) {
        const caseNumber = new Date(result.sentToDOSDate);
        caseNumber.setDate(
          caseNumber.getDate() + medians.sentToDOSToCaseNumberDays
        );
        result.caseNumberAssignedDate = caseNumber;
      }
    } else {
      result.sentToDOSDate = userMilestones["sent_to_dos"];
      result.caseNumberAssignedDate = userMilestones["case_number_assigned"];
    }

    // Consulate Phase
    const caseNumber =
      result.caseNumberAssignedDate || result.sentToDOSDate || noa2;
    if (!result.consulateInTransitDate) {
      const inTransit = new Date(caseNumber);
      inTransit.setDate(inTransit.getDate() + medians.caseNumberToInTransitDays);
      result.consulateInTransitDate = inTransit;
    }
    const inTransit = result.consulateInTransitDate || caseNumber;
    const ready = new Date(inTransit);
    ready.setDate(ready.getDate() + medians.inTransitToReadyDays);
    result.readyDate = ready;

    // Embassy timing (Ready → Interview) - use embassy-specific table
    const readyDate = result.readyDate || inTransit;
    if (usEmbassy) {
      // Try to get embassy-specific wait time from State Department website
      const embassyWaitTime = await this.getEmbassyWaitTime(usEmbassy);
      
      if (embassyWaitTime) {
        // Use State Department official wait time
        if (medians.readyToMedicalDays) {
          const medical = new Date(readyDate);
          medical.setDate(medical.getDate() + Math.max(0, embassyWaitTime - 14)); // Medical ~14 days before interview
          result.medicalDate = medical;
        }
        const interview = new Date(readyDate);
        interview.setDate(interview.getDate() + embassyWaitTime);
        result.interviewDate = interview;
      } else {
        // Fallback to Firebase embassy stats or global medians
        if (medians.readyToMedicalDays) {
          const medical = new Date(readyDate);
          medical.setDate(medical.getDate() + medians.readyToMedicalDays);
          result.medicalDate = medical;
        }
        const interview = new Date(readyDate);
        interview.setDate(interview.getDate() + medians.readyToInterviewDays);
        result.interviewDate = interview;
      }
    } else {
      // Fallback to global medians
      if (medians.readyToMedicalDays) {
        const medical = new Date(readyDate);
        medical.setDate(medical.getDate() + medians.readyToMedicalDays);
        result.medicalDate = medical;
      }
      const interview = new Date(readyDate);
      interview.setDate(interview.getDate() + medians.readyToInterviewDays);
      result.interviewDate = interview;
    }

    // Visa and Arrival
    const interview = result.interviewDate || readyDate;
    if (usEmbassy) {
      // TODO: Implement embassy-specific stats estimator
      const visa = new Date(interview);
      visa.setDate(visa.getDate() + medians.interviewToVisaReceivedDays);
      result.visaReceivedDate = visa;
      const arrival = new Date(interview);
      arrival.setDate(arrival.getDate() + medians.visaReceivedToUSArrivalDays);
      result.usArrivalDate = arrival;
    } else {
      const visa = new Date(interview);
      visa.setDate(visa.getDate() + medians.interviewToVisaReceivedDays);
      result.visaReceivedDate = visa;
      const arrival = new Date(result.visaReceivedDate || interview);
      arrival.setDate(arrival.getDate() + medians.visaReceivedToUSArrivalDays);
      result.usArrivalDate = arrival;
    }

    return result;
  }

  /**
   * Get embassy wait time from Firebase or State Department website
   */
  private async getEmbassyWaitTime(usEmbassy: string): Promise<number | null> {
    // First try Firebase backend
    try {
      const embassyDoc = await getDoc(doc(db, "i129fEmbassyStats", usEmbassy));
      if (embassyDoc.exists()) {
        const data = embassyDoc.data();
        // Check for new format (medianDays) or old format (interviewMedianDays)
        if (data.medianDays) {
          return data.medianDays as number;
        } else if (data.interviewMedianDays) {
          return data.interviewMedianDays as number;
        }
      }
      
      // Try city-only format (e.g., "London" instead of "London, UK")
      const cityOnly = usEmbassy.includes(",") ? usEmbassy.split(",")[0].trim() : usEmbassy.trim();
      const cityDoc = await getDoc(doc(db, "i129fEmbassyStats", cityOnly));
      if (cityDoc.exists()) {
        const data = cityDoc.data();
        if (data.medianDays) {
          return data.medianDays as number;
        } else if (data.interviewMedianDays) {
          return data.interviewMedianDays as number;
        }
      }
    } catch (error) {
      console.error("[I129FCalculator] Error fetching from Firebase:", error);
    }
    
    // Fallback to State Department website
    try {
      const waitDays = await stateDepartmentWaitTimeService.getWaitTime(usEmbassy);
      if (waitDays) {
        return waitDays;
      }
    } catch (error) {
      console.error("[I129FCalculator] Error fetching from State Department:", error);
    }
    
    return null;
  }

  /**
   * Recompute medians from admin approval data
   */
  async recomputeMedians(): Promise<void> {
    // Only run on client side
    if (typeof window === "undefined") {
      console.log("[I129FCalculator] Skipping recompute - server side");
      return;
    }

    if (this.isLoading) return;
    this.isLoading = true;

    try {
      console.log("[I129FCalculator] Starting median recomputation...");

      // Check if db is properly initialized
      if (!db || typeof db === "object" && Object.keys(db).length === 0) {
        console.warn("[I129FCalculator] Firestore not initialized, skipping recompute");
        this.isLoading = false;
        return;
      }

      const snapshot = await getDocs(
        query(
          collection(db, "i129fApprovals"),
          where("formType", "==", "I-129F"),
          orderBy("createdAt", "desc"),
          limit(2000)
        )
      );

      const approvals = snapshot.docs
        .map((doc) => this.parseApprovalData(doc.data(), doc.id))
        .filter((data): data is I129FApprovalData => data !== null);

      console.log(`[I129FCalculator] Loaded ${approvals.length} approval records`);

      // Filter out non-standard cases
      const standardApprovals = approvals.filter(
        (approval) => !this.isNonStandard(approval)
      );
      console.log(
        `[I129FCalculator] ${standardApprovals.length} standard approvals after filtering`
      );

      // Compute medians
      const medians = this.computeMedians(standardApprovals);

      // Update cache
      this.medianCache = medians;
      this.cacheTimestamp = new Date();

      console.log("[I129FCalculator] ✅ Median recomputation complete");
    } catch (error) {
      console.error(
        `[I129FCalculator] ❌ Error recomputing medians:`,
        error
      );
    } finally {
      this.isLoading = false;
    }
  }

  getCachedMedians(): I129FMedianStats {
    if (
      this.medianCache &&
      this.cacheTimestamp &&
      Date.now() - this.cacheTimestamp.getTime() < this.cacheTTL
    ) {
      return this.medianCache;
    }

    // Trigger async fetch if not loading
    if (!this.isLoading) {
      this.recomputeMedians();
    }

    // Return cached value even if expired, or defaults
    return (
      this.medianCache || {
        noa1ToNOA2Days: 300,
        noa2ToSentToDOSDays: 30,
        sentToDOSToCaseNumberDays: 20,
        caseNumberToInTransitDays: 7,
        inTransitToReadyDays: 7,
        readyToInterviewDays: 60,
        interviewToVisaReceivedDays: 14,
        visaReceivedToUSArrivalDays: 15,
      }
    );
  }

  private parseApprovalData(data: any, id: string): I129FApprovalData | null {
    if (
      !data.formType ||
      data.formType !== "I-129F" ||
      !data.beneficiaryCountry ||
      !data.noa1Date
    ) {
      return null;
    }

    const toDate = (timestamp: any): Date | undefined => {
      if (!timestamp) return undefined;
      if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
      }
      if (timestamp.toDate) {
        return timestamp.toDate();
      }
      return new Date(timestamp);
    };

    return {
      id,
      formType: data.formType,
      beneficiaryCountry: data.beneficiaryCountry,
      petitionerCountry: data.petitionerCountry || "United States",
      usEmbassy: data.usEmbassy,
      noa1Date: toDate(data.noa1Date)!,
      rfeDate: toDate(data.rfeDate),
      rfeResponseDate: toDate(data.rfeResponseDate),
      noa2Date: toDate(data.noa2Date),
      sentToDOSDate: toDate(data.sentToDOSDate),
      caseNumberAssignedDate: toDate(data.caseNumberAssignedDate),
      consulateInTransitDate: toDate(data.consulateInTransitDate),
      consulateReadyDate: toDate(data.consulateReadyDate),
      medicalDate: toDate(data.medicalDate),
      interviewDate: toDate(data.interviewDate),
      visaReceivedDate: toDate(data.visaReceivedDate),
      usArrivalDate: toDate(data.usArrivalDate),
      notes: data.notes,
    };
  }

  private computeMedians(approvals: I129FApprovalData[]): I129FMedianStats {
    const noa1ToRfeDays: number[] = [];
    const rfeToRfeResponseDays: number[] = [];
    const rfeResponseToNOA2Days: number[] = [];
    const rfeToNOA2Days: number[] = [];
    const noa1ToNOA2Days: number[] = [];
    const noa2ToSentToDOSDays: number[] = [];
    const sentToDOSToCaseNumberDays: number[] = [];
    const caseNumberToInTransitDays: number[] = [];
    const inTransitToReadyDays: number[] = [];
    const readyToMedicalDays: number[] = [];
    const medicalToInterviewDays: number[] = [];
    const readyToInterviewDays: number[] = [];
    const interviewToVisaReceivedDays: number[] = [];
    const visaReceivedToUSArrivalDays: number[] = [];

    for (const approval of approvals) {
      const noa1 = approval.noa1Date;

      // NOA1 → RFE
      if (approval.rfeDate) {
        const days = Math.round(
          (approval.rfeDate.getTime() - noa1.getTime()) / (1000 * 60 * 60 * 24)
        );
        noa1ToRfeDays.push(days);

        // RFE → RFE Response
        if (approval.rfeResponseDate) {
          const days = Math.round(
            (approval.rfeResponseDate.getTime() - approval.rfeDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          rfeToRfeResponseDays.push(days);

          // RFE Response → NOA2
          if (approval.noa2Date) {
            const days = Math.round(
              (approval.noa2Date.getTime() -
                approval.rfeResponseDate.getTime()) /
                (1000 * 60 * 60 * 24)
            );
            rfeResponseToNOA2Days.push(days);
          }
        }

        // RFE → NOA2 (fallback gap)
        if (approval.noa2Date) {
          const days = Math.round(
            (approval.noa2Date.getTime() - approval.rfeDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          rfeToNOA2Days.push(days);
        }
      }

      // NOA1 → NOA2 (non-RFE baseline)
      if (approval.noa2Date && !approval.rfeDate) {
        const days = Math.round(
          (approval.noa2Date.getTime() - noa1.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        noa1ToNOA2Days.push(days);
      }

      // NOA2 → Sent to DOS
      if (approval.noa2Date && approval.sentToDOSDate) {
        const days = Math.round(
          (approval.sentToDOSDate.getTime() - approval.noa2Date.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        noa2ToSentToDOSDays.push(days);
      }

      // Sent to DOS → Case Number Assigned
      if (approval.sentToDOSDate && approval.caseNumberAssignedDate) {
        const days = Math.round(
          (approval.caseNumberAssignedDate.getTime() -
            approval.sentToDOSDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        sentToDOSToCaseNumberDays.push(days);
      }

      // Case Number → In Transit
      if (approval.caseNumberAssignedDate && approval.consulateInTransitDate) {
        const days = Math.round(
          (approval.consulateInTransitDate.getTime() -
            approval.caseNumberAssignedDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        caseNumberToInTransitDays.push(days);
      }

      // In Transit → Ready
      if (approval.consulateInTransitDate && approval.consulateReadyDate) {
        const days = Math.round(
          (approval.consulateReadyDate.getTime() -
            approval.consulateInTransitDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        inTransitToReadyDays.push(days);
      }

      // Ready → Medical
      if (approval.consulateReadyDate && approval.medicalDate) {
        const days = Math.round(
          (approval.medicalDate.getTime() -
            approval.consulateReadyDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        readyToMedicalDays.push(days);
      }

      // Medical → Interview
      if (approval.medicalDate && approval.interviewDate) {
        const days = Math.round(
          (approval.interviewDate.getTime() - approval.medicalDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        medicalToInterviewDays.push(days);
      }

      // Ready → Interview (embassy-keyed override)
      if (approval.consulateReadyDate && approval.interviewDate) {
        const days = Math.round(
          (approval.interviewDate.getTime() -
            approval.consulateReadyDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        readyToInterviewDays.push(days);
      }

      // Interview → Visa Received
      if (approval.interviewDate && approval.visaReceivedDate) {
        const days = Math.round(
          (approval.visaReceivedDate.getTime() -
            approval.interviewDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        interviewToVisaReceivedDays.push(days);
      }

      // Visa Received → U.S. Arrival
      if (approval.visaReceivedDate && approval.usArrivalDate) {
        const days = Math.round(
          (approval.usArrivalDate.getTime() -
            approval.visaReceivedDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        visaReceivedToUSArrivalDays.push(days);
      }
    }

    const median = (values: number[]): number | undefined => {
      if (values.length === 0) return undefined;
      const sorted = [...values].sort((a, b) => a - b);
      const count = sorted.length;
      if (count % 2 === 0) {
        return Math.round((sorted[count / 2 - 1] + sorted[count / 2]) / 2);
      } else {
        return sorted[Math.floor(count / 2)];
      }
    };

    return {
      noa1ToRfeDays: median(noa1ToRfeDays),
      rfeToRfeResponseDays: median(rfeToRfeResponseDays),
      rfeResponseToNOA2Days: median(rfeResponseToNOA2Days),
      rfeToNOA2Days: median(rfeToNOA2Days),
      noa1ToNOA2Days: median(noa1ToNOA2Days) ?? 300,
      noa2ToSentToDOSDays: median(noa2ToSentToDOSDays) ?? 30,
      sentToDOSToCaseNumberDays: median(sentToDOSToCaseNumberDays) ?? 20,
      caseNumberToInTransitDays: median(caseNumberToInTransitDays) ?? 7,
      inTransitToReadyDays: median(inTransitToReadyDays) ?? 7,
      readyToMedicalDays: median(readyToMedicalDays),
      medicalToInterviewDays: median(medicalToInterviewDays),
      readyToInterviewDays: median(readyToInterviewDays) ?? 60,
      interviewToVisaReceivedDays: median(interviewToVisaReceivedDays) ?? 14,
      visaReceivedToUSArrivalDays: median(visaReceivedToUSArrivalDays) ?? 15,
    };
  }

  private isNonStandard(approval: I129FApprovalData): boolean {
    const notes = (approval.notes || "").toLowerCase();
    return (
      notes.includes("expedite") ||
      notes.includes("appeal") ||
      notes.includes("denial") ||
      notes.includes("reopen")
    );
  }
}

export const i129fTimelineCalculator = I129FTimelineCalculator.getInstance();
