/**
 * Timeline Definition Provider
 * Single source of truth for timeline stage definitions
 * Matches iOS TimelineDefinitionProvider.swift
 * Enforces correct pipelines by Form Type + Processing Path
 */

export type ProcessingPath = "AOS" | "Consular";

export type FormType = "I-130" | "I-129F" | "I-485" | "I-765" | "N-400" | "I-140" | "I-131" | "I-751" | "I-821" | "I-821D";

export interface TimelineStage {
  id: string;
  title: string;
  order: number;
  type: "milestone" | "estimate";
  isOptional: boolean;
}

/**
 * Get simple timeline titles (3-4 stages) for a form type and processing path
 * Matches iOS simpleStageTitles function
 */
export function getSimpleStageTitles(formType: FormType, path: ProcessingPath): string[] {
  // Enforce valid combinations
  const validPath = validatePath(formType, path);

  switch (`${formType}-${validPath}`) {
    // Consular - I-130 / I-140
    case "I-130-Consular":
    case "I-140-Consular":
      return ["USCIS Processing", "NVC & Document Review", "Embassy Interview & Visa"];

    // Consular - I-129F
    case "I-129F-Consular":
      return ["NOA 1 to NOA 2", "DOS", "Embassy & Interview"];

    // AOS - I-485
    case "I-485-AOS":
      return ["USCIS Received (NOA1)", "Processing", "Decision", "Card Delivery"];

    // AOS - I-765
    case "I-765-AOS":
      return ["USCIS Received (NOA1)", "Processing", "Decision", "Card Delivery"];

    // AOS - N-400
    case "N-400-AOS":
      return ["USCIS Received (NOA1)", "Naturalization Interview", "Decision", "Oath Ceremony"];

    // AOS - I-131
    case "I-131-AOS":
      return ["USCIS Processing", "Decision", "Document Delivery"];

    // AOS - I-751
    case "I-751-AOS":
      return ["USCIS Processing", "Interview / Decision", "10-Year Card Delivery"];

    // AOS - I-821
    case "I-821-AOS":
      return ["USCIS Processing", "Decision", "Approval Status"];

    // AOS - I-821D
    case "I-821D-AOS":
      return ["USCIS Processing", "Decision", "Approval Status"];

    default:
      // Fallback for invalid combinations
      return ["USCIS Processing", "Processing", "Completion"];
  }
}

/**
 * Get detailed pro timeline stages for a form type and processing path
 * Matches iOS proStages function
 */
export function getProStages(
  formType: FormType,
  path: ProcessingPath,
  country?: string | null
): TimelineStage[] {
  // Enforce valid combinations
  const validPath = validatePath(formType, path);

  switch (`${formType}-${validPath}`) {
    // Consular - I-130 / I-140 (Pro)
    case "I-130-Consular":
    case "I-140-Consular": {
      const embassyTitle = country ? `Embassy/Consulate — ${country}` : "Embassy/Consulate";
      return [
        { id: "uscis_receipt", title: "USCIS Receipt", order: 1, type: "milestone", isOptional: false },
        { id: "uscis_processing", title: "USCIS Processing", order: 2, type: "estimate", isOptional: false },
        { id: "uscis_approval", title: "USCIS Approval", order: 3, type: "milestone", isOptional: false },
        { id: "nvc_transfer", title: "NVC Transfer", order: 4, type: "milestone", isOptional: false },
        { id: "nvc_processing", title: "NVC Document Review", order: 5, type: "estimate", isOptional: false },
        { id: "dq", title: "Documentarily Qualified (DQ)", order: 6, type: "milestone", isOptional: false },
        { id: "embassy_ready", title: embassyTitle, order: 7, type: "milestone", isOptional: false },
        { id: "interview_scheduled", title: "Interview Scheduled", order: 8, type: "milestone", isOptional: false },
        { id: "interview", title: "Consular Interview", order: 9, type: "milestone", isOptional: false },
        { id: "visa_issued", title: "Visa Issued", order: 10, type: "milestone", isOptional: false },
        { id: "us_entry", title: "U.S. Entry", order: 11, type: "milestone", isOptional: false },
      ];
    }

    // Consular - I-129F (Pro) - Complete milestone flow with RFE support
    case "I-129F-Consular": {
      const embassyTitle = country ? `Embassy/Consulate — ${country}` : "Embassy/Consulate";
      return [
        { id: "uscis_receipt", title: "NOA1", order: 1, type: "milestone", isOptional: false },
        { id: "rfe", title: "RFE", order: 2, type: "milestone", isOptional: true },
        { id: "rfe_response", title: "RFE Response", order: 3, type: "milestone", isOptional: true },
        { id: "uscis_approval", title: "NOA2", order: 4, type: "milestone", isOptional: false },
        { id: "sent_to_dos", title: "Sent to DOS", order: 5, type: "milestone", isOptional: false },
        { id: "case_number_assigned", title: "Case Number Assigned", order: 6, type: "milestone", isOptional: false },
        { id: "consulate_in_transit", title: "Consulate In Transit", order: 7, type: "milestone", isOptional: false },
        { id: "embassy_ready", title: "Ready", order: 8, type: "milestone", isOptional: false },
        { id: "medical", title: "Medical", order: 9, type: "milestone", isOptional: false },
        { id: "interview", title: "Interview", order: 10, type: "milestone", isOptional: false },
        { id: "visa_received", title: "Visa Received", order: 11, type: "milestone", isOptional: false },
        { id: "us_entry", title: "U.S. Arrival", order: 12, type: "milestone", isOptional: false },
      ];
    }

    // AOS - I-485 (Pro)
    case "I-485-AOS":
      return [
        { id: "uscis_receipt", title: "USCIS Receipt Date", order: 1, type: "milestone", isOptional: false },
        { id: "biometrics", title: "Biometrics (if required)", order: 2, type: "milestone", isOptional: true },
        { id: "rfe", title: "RFE (if any)", order: 3, type: "milestone", isOptional: true },
        { id: "interview_scheduled", title: "Interview Scheduled (if any)", order: 4, type: "milestone", isOptional: true },
        { id: "interview", title: "Interview (if any)", order: 5, type: "milestone", isOptional: true },
        { id: "decision", title: "Approximate Approval Date", order: 6, type: "milestone", isOptional: false },
        { id: "card_produced", title: "Card Produced", order: 7, type: "milestone", isOptional: false },
        { id: "card_delivered", title: "Card Delivered", order: 8, type: "milestone", isOptional: false },
      ];

    // AOS - I-765 (Pro)
    case "I-765-AOS":
      return [
        { id: "uscis_receipt", title: "USCIS Receipt Date", order: 1, type: "milestone", isOptional: false },
        { id: "biometrics", title: "Biometrics (if required)", order: 2, type: "milestone", isOptional: true },
        { id: "decision", title: "Approximate Approval Date", order: 3, type: "milestone", isOptional: false },
        { id: "card_produced", title: "Card Produced", order: 4, type: "milestone", isOptional: false },
        { id: "card_delivered", title: "Card Delivered", order: 5, type: "milestone", isOptional: false },
      ];

    // AOS - I-131 (Pro)
    case "I-131-AOS":
      return [
        { id: "uscis_receipt", title: "USCIS Receipt", order: 1, type: "milestone", isOptional: false },
        { id: "biometrics", title: "Biometrics (if required)", order: 2, type: "milestone", isOptional: true },
        { id: "decision", title: "Decision", order: 3, type: "milestone", isOptional: false },
        { id: "document_produced", title: "Document Produced", order: 4, type: "milestone", isOptional: false },
        { id: "document_delivered", title: "Document Delivered", order: 5, type: "milestone", isOptional: false },
      ];

    // AOS - I-751 (Pro)
    case "I-751-AOS":
      return [
        { id: "uscis_receipt", title: "USCIS Receipt", order: 1, type: "milestone", isOptional: false },
        { id: "biometrics", title: "Biometrics (if required)", order: 2, type: "milestone", isOptional: true },
        { id: "rfe", title: "RFE (if any)", order: 3, type: "milestone", isOptional: true },
        { id: "interview_scheduled", title: "Interview Scheduled (if any)", order: 4, type: "milestone", isOptional: true },
        { id: "interview", title: "Interview (if any)", order: 5, type: "milestone", isOptional: true },
        { id: "decision", title: "Decision", order: 6, type: "milestone", isOptional: false },
        { id: "card_produced", title: "Card Produced", order: 7, type: "milestone", isOptional: false },
        { id: "card_delivered", title: "Card Delivered", order: 8, type: "milestone", isOptional: false },
      ];

    // AOS - N-400 (Pro)
    case "N-400-AOS":
      return [
        { id: "uscis_receipt", title: "USCIS Receipt Date", order: 1, type: "milestone", isOptional: false },
        { id: "biometrics", title: "Biometrics (if required)", order: 2, type: "milestone", isOptional: true },
        { id: "interview_scheduled", title: "Interview Scheduled", order: 3, type: "milestone", isOptional: true },
        { id: "interview", title: "Naturalization Interview", order: 4, type: "milestone", isOptional: true },
        { id: "decision", title: "Approximate Approval Date", order: 5, type: "milestone", isOptional: false },
        { id: "oath_scheduled", title: "Oath Ceremony Scheduled", order: 6, type: "milestone", isOptional: false },
        { id: "oath", title: "Oath Ceremony (Citizen!)", order: 7, type: "milestone", isOptional: false },
      ];

    // AOS - I-821 (Pro)
    case "I-821-AOS":
      return [
        { id: "uscis_receipt", title: "USCIS Receipt", order: 1, type: "milestone", isOptional: false },
        { id: "uscis_processing", title: "USCIS Processing", order: 2, type: "estimate", isOptional: false },
        { id: "decision", title: "Decision", order: 3, type: "milestone", isOptional: false },
        { id: "approval_status", title: "Approval Status", order: 4, type: "milestone", isOptional: false },
      ];

    // AOS - I-821D (Pro)
    case "I-821D-AOS":
      return [
        { id: "uscis_receipt", title: "USCIS Receipt", order: 1, type: "milestone", isOptional: false },
        { id: "uscis_processing", title: "USCIS Processing", order: 2, type: "estimate", isOptional: false },
        { id: "decision", title: "Decision", order: 3, type: "milestone", isOptional: false },
        { id: "approval_status", title: "Approval Status", order: 4, type: "milestone", isOptional: false },
      ];

    default:
      // Fallback for invalid combinations
      return [
        { id: "uscis_receipt", title: "USCIS Receipt", order: 1, type: "milestone", isOptional: false },
        { id: "uscis_processing", title: "USCIS Processing", order: 2, type: "estimate", isOptional: false },
        { id: "completion", title: "Completion", order: 3, type: "milestone", isOptional: false },
      ];
  }
}

/**
 * Validate and correct processing path for a form type
 */
export function validatePath(formType: FormType, path: ProcessingPath): ProcessingPath {
  // AOS-only forms must use AOS path
  const aosOnlyForms: FormType[] = ["I-485", "I-765", "I-131", "I-751", "I-821", "I-821D", "N-400"];
  if (aosOnlyForms.includes(formType) && path === "Consular") {
    return "AOS";
  }
  // Consular-capable forms can use either path
  return path;
}

/**
 * Check if a form type supports consular processing
 */
export function supportsConsular(formType: FormType): boolean {
  const consularForms: FormType[] = ["I-130", "I-129F", "I-140"];
  return consularForms.includes(formType);
}

/**
 * Check if form type + processing path combination requires embassy stages
 */
export function requiresEmbassyStages(formType: FormType, processingPath: ProcessingPath): boolean {
  // Only return true for consular-capable forms that are actually using consular processing
  if (supportsConsular(formType) && processingPath === "Consular") {
    return true;
  }
  return false;
}
