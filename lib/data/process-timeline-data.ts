// Process Timeline Data - Matching iOS VisaJourneyGuideView
import { ProcessTimelineCategory, TimelinePhase } from "../types/help-center";

export const processTimelineCategories: ProcessTimelineCategory[] = [
  {
    id: "i130",
    title: "I-130 Family Petitions",
    description: "Petition for Alien Relative - Spouse, Parent, Child",
    estimatedTime: "12-24 months",
    icon: "person.2.fill",
    tint: "blue",
  },
  {
    id: "i129f",
    title: "I-129F K-1/K-3",
    description: "K-1 Fiancé(e) and K-3 Spouse Visa Petitions",
    estimatedTime: "8-14 months",
    icon: "heart.fill",
    tint: "pink",
  },
  {
    id: "i485",
    title: "I-485 Adjustment of Status",
    description: "Adjustment of Status to Permanent Resident",
    estimatedTime: "12-24 months",
    icon: "checkmark.seal.fill",
    tint: "green",
  },
  {
    id: "nvc",
    title: "NVC Processing",
    description: "National Visa Center Processing Steps",
    estimatedTime: "3-6 months",
    icon: "building.2.fill",
    tint: "orange",
  },
  {
    id: "interview",
    title: "Consular Interview",
    description: "Consular Interview Preparation and Process",
    estimatedTime: "1-3 months after NVC",
    icon: "person.badge.shield.checkmark.fill",
    tint: "purple",
  },
  {
    id: "aos",
    title: "AOS Timeline",
    description: "Adjustment of Status Timeline and Steps",
    estimatedTime: "12-24 months",
    icon: "clock.fill",
    tint: "green",
  },
  {
    id: "k1",
    title: "K-1 Fiancé Visa",
    description: "K-1 Fiancé Visa Journey from Filing to Entry",
    estimatedTime: "10-18 months",
    icon: "heart.circle.fill",
    tint: "pink",
  },
  {
    id: "k3",
    title: "K-3 Spouse Visa",
    description: "K-3 Spouse Visa Process and Timeline",
    estimatedTime: "12-24 months",
    icon: "heart.rectangle.fill",
    tint: "pink",
  },
  {
    id: "cr1",
    title: "CR-1/IR-1 Spouse Visa",
    description: "CR-1/IR-1 Conditional and Immediate Relative Visas",
    estimatedTime: "14-26 months",
    icon: "person.2.circle.fill",
    tint: "blue",
  },
  {
    id: "i751",
    title: "I-751 Remove Conditions",
    description: "Remove Conditions on Permanent Residence",
    estimatedTime: "18-24 months",
    icon: "checkmark.circle.fill",
    tint: "blue",
  },
  {
    id: "n400",
    title: "N-400 Naturalization",
    description: "Naturalization and U.S. Citizenship Application",
    estimatedTime: "8-12 months",
    icon: "flag.fill",
    tint: "red",
  },
];

export function getCategoryTimeline(categoryId: string): TimelinePhase[] {
  switch (categoryId) {
    case "i130":
      return [
        { title: "USCIS Receives Petition", duration: "Day 1", description: "You file I-130 and receive NOA1" },
        { title: "USCIS Processing", duration: "12-24 months", description: "Case is assigned to service center" },
        { title: "NOA2 Approval", duration: "Varies", description: "Petition is approved" },
        { title: "Sent to NVC", duration: "2-4 weeks", description: "Case forwarded to National Visa Center" },
        { title: "NVC Processing", duration: "3-6 months", description: "Document submission and review" },
        { title: "Interview Scheduled", duration: "1-3 months", description: "Embassy/Consulate schedules interview" },
        { title: "Visa Issued", duration: "1-2 weeks", description: "After successful interview" },
      ];
    case "i129f":
      return [
        { title: "File I-129F", duration: "Day 1", description: "Submit petition to USCIS" },
        { title: "NOA1 Receipt", duration: "1-2 weeks", description: "USCIS acknowledges receipt" },
        { title: "USCIS Processing", duration: "8-14 months", description: "Case under review" },
        { title: "NOA2 Approval", duration: "Varies", description: "Petition approved" },
        { title: "Sent to NVC", duration: "2-4 weeks", description: "Case forwarded to NVC" },
        { title: "Consular Processing", duration: "2-4 months", description: "Embassy processes case" },
        { title: "Interview & Visa Issuance", duration: "1-2 weeks", description: "Complete interview and receive visa" },
      ];
    case "i485":
      return [
        { title: "File I-485", duration: "Day 1", description: "Submit application to USCIS" },
        { title: "Biometrics Appointment", duration: "1-2 months", description: "Complete fingerprinting" },
        { title: "Interview Scheduled", duration: "6-12 months", description: "USCIS schedules interview (if required)" },
        { title: "Case Decision", duration: "12-24 months", description: "USCIS makes final decision" },
        { title: "Green Card Mailed", duration: "1-2 weeks", description: "Card production and mailing" },
      ];
    case "nvc":
      return [
        { title: "Case Received at NVC", duration: "Day 1", description: "NVC receives approved petition" },
        { title: "Fee Payment", duration: "1-2 weeks", description: "Pay required fees online" },
        { title: "Submit Documents", duration: "2-3 months", description: "Upload civil documents and forms" },
        { title: "Document Review", duration: "2-4 weeks", description: "NVC reviews all documents" },
        { title: "DQ (Documentarily Qualified)", duration: "Varies", description: "All documents approved" },
        { title: "Interview Scheduling", duration: "1-3 months", description: "Embassy schedules interview" },
      ];
    case "interview":
      return [
        { title: "Interview Scheduled", duration: "Day 1", description: "Receive interview appointment letter" },
        { title: "Medical Exam", duration: "1-2 weeks before", description: "Complete required medical examination" },
        { title: "Document Preparation", duration: "2-4 weeks", description: "Gather all required documents" },
        { title: "Interview Day", duration: "30-60 minutes", description: "Attend consular interview" },
        { title: "Administrative Processing", duration: "1-4 weeks", description: "Additional review if needed" },
        { title: "Visa Issued", duration: "1-2 weeks", description: "Passport returned with visa" },
      ];
    case "aos":
      return [
        { title: "File Concurrently", duration: "Day 1", description: "File I-130 + I-485 together" },
        { title: "Biometrics", duration: "1-2 months", description: "Complete biometrics appointment" },
        { title: "EAD/AP Processing", duration: "3-6 months", description: "Work permit and travel document" },
        { title: "Interview", duration: "6-12 months", description: "Adjustment interview" },
        { title: "Decision", duration: "12-24 months", description: "Final case decision" },
        { title: "Green Card", duration: "1-2 weeks", description: "Receive permanent resident card" },
      ];
    case "k1":
      return [
        { title: "File I-129F", duration: "Day 1", description: "Petitioner files fiancé petition" },
        { title: "USCIS Approval", duration: "8-14 months", description: "Petition approved" },
        { title: "NVC Processing", duration: "1-2 months", description: "Case sent to embassy" },
        { title: "Consular Processing", duration: "2-3 months", description: "Embassy processes case" },
        { title: "Interview", duration: "Day 1", description: "Attend K-1 interview" },
        { title: "Visa Issued", duration: "1-2 weeks", description: "Receive K-1 visa" },
        { title: "Enter U.S. & Marry", duration: "Within 90 days", description: "Enter U.S. and get married" },
        { title: "File AOS", duration: "After marriage", description: "File I-485 for permanent residence" },
      ];
    case "k3":
      return [
        { title: "File I-130", duration: "Day 1", description: "File I-130 petition" },
        { title: "File I-129F for K-3", duration: "After I-130", description: "File K-3 petition" },
        { title: "K-3 Approval", duration: "6-12 months", description: "K-3 approved (often canceled)" },
        { title: "Consular Processing", duration: "Varies", description: "Complete visa process" },
        { title: "I-130 Approval", duration: "12-24 months", description: "I-130 approved, switch to CR-1" },
      ];
    case "cr1":
      return [
        { title: "File I-130", duration: "Day 1", description: "Petitioner files for spouse" },
        { title: "USCIS Approval", duration: "12-24 months", description: "I-130 approved" },
        { title: "NVC Processing", duration: "3-6 months", description: "Complete NVC stage" },
        { title: "Interview", duration: "1-3 months", description: "Consular interview" },
        { title: "Visa Issued", duration: "1-2 weeks", description: "CR-1 or IR-1 visa issued" },
        { title: "Enter U.S.", duration: "Within 6 months", description: "Enter as permanent resident" },
      ];
    case "i751":
      return [
        { title: "File I-751", duration: "Before expiration", description: "File 90 days before card expires" },
        { title: "Extension Letter", duration: "2-4 weeks", description: "Receive 24-month extension" },
        { title: "Biometrics", duration: "2-3 months", description: "Complete biometrics appointment" },
        { title: "Interview (if required)", duration: "6-12 months", description: "Interview scheduled" },
        { title: "Approval", duration: "18-24 months", description: "Conditions removed" },
        { title: "10-Year Green Card", duration: "1-2 weeks", description: "Receive permanent card" },
      ];
    case "n400":
      return [
        { title: "File N-400", duration: "Day 1", description: "Submit naturalization application" },
        { title: "Biometrics", duration: "1-2 months", description: "Complete biometrics" },
        { title: "Interview Scheduled", duration: "4-8 months", description: "Receive interview notice" },
        { title: "Interview & Test", duration: "Day 1", description: "Complete interview and citizenship test" },
        { title: "Oath Ceremony", duration: "1-3 months", description: "Attend oath ceremony" },
        { title: "U.S. Citizen", duration: "Same day", description: "Receive certificate of naturalization" },
      ];
    default:
      return [];
  }
}

export function getCategoryProcessSteps(categoryId: string): string[] {
  switch (categoryId) {
    case "i130":
      return [
        "Determine eligibility and gather required documents",
        "Create USCIS online account or prepare paper filing",
        "Complete Form I-130 with accurate information",
        "Gather supporting documents (marriage certificate, birth certificates, photos, etc.)",
        "File I-130 and pay filing fee",
        "Receive NOA1 (Notice of Action 1) confirmation",
        "Wait for USCIS processing and approval (NOA2)",
        "After approval, case is forwarded to NVC",
        "Complete NVC requirements (forms, fees, civil documents)",
        "Wait for interview scheduling",
        "Attend consular interview",
        "Receive visa and enter U.S.",
      ];
    case "i129f":
      return [
        "Ensure both parties are eligible (met in person, both free to marry)",
        "Gather required documents (proof of meeting, relationship evidence, etc.)",
        "Complete Form I-129F accurately",
        "File I-129F with USCIS",
        "Receive NOA1 confirmation",
        "Wait for petition approval (8-14 months)",
        "Receive NOA2 approval notice",
        "Case forwarded to NVC",
        "NVC processes and forwards to embassy",
        "Embassy sends Packet 3 (instructions)",
        "Complete medical exam and gather documents",
        "Embassy sends Packet 4 (interview appointment)",
        "Attend K-1 interview",
        "Receive K-1 visa",
        "Enter U.S. within 6 months",
        "Get married within 90 days of entry",
        "File I-485 for Adjustment of Status",
      ];
    case "i485":
      return [
        "Determine eligibility (lawful entry, approved petition, etc.)",
        "Gather all required forms (I-485, I-864, I-693, etc.)",
        "Complete medical examination (Form I-693)",
        "Prepare supporting documents",
        "File I-485 package to USCIS",
        "Receive biometrics appointment notice",
        "Attend biometrics appointment",
        "Receive EAD (work permit) and AP (travel document) if filed together",
        "Wait for interview notice (if required)",
        "Prepare for interview with all documents",
        "Attend adjustment interview",
        "Receive decision (approval, RFE, or denial)",
        "If approved, receive Green Card in mail",
      ];
    case "nvc":
      return [
        "Wait for case number from NVC",
        "Create CEAC account and pay fees",
        "Complete Form DS-260 (Immigrant Visa Application)",
        "Complete Form I-864 (Affidavit of Support)",
        "Gather civil documents (birth certificates, marriage certificates, police certificates, etc.)",
        "Upload documents to CEAC",
        "Submit all documents and forms",
        "Wait for NVC review (2-4 weeks)",
        "Respond to any checklists or RFEs",
        "Receive DQ (Documentarily Qualified) notice",
        "Wait for interview scheduling",
        "Prepare for interview",
      ];
    case "interview":
      return [
        "Review interview appointment letter carefully",
        "Complete medical examination with approved doctor",
        "Gather all original documents (plus copies)",
        "Prepare for common interview questions",
        "Organize documents in logical order",
        "Arrive early at embassy/consulate",
        "Go through security screening",
        "Submit documents and wait for interview",
        "Answer consular officer's questions truthfully",
        "Provide any additional documents if requested",
        "Wait for decision (approved, 221g, or refused)",
        "If approved, wait for visa issuance",
        "Receive passport with visa",
      ];
    case "aos":
      return [
        "File I-130 and I-485 concurrently (if eligible)",
        "Receive biometrics appointment notice",
        "Attend biometrics appointment",
        "Receive EAD and AP (if filed together)",
        "Wait for interview notice (if required)",
        "Prepare for interview with all documents",
        "Attend adjustment interview",
        "Receive decision (approval, RFE, or denial)",
        "If approved, receive Green Card in mail",
      ];
    case "k1":
      return [
        "File I-129F petition",
        "Receive NOA1",
        "Wait for NOA2 approval",
        "Case sent to NVC",
        "Embassy receives case",
        "Complete Packet 3 requirements",
        "Schedule medical exam",
        "Receive Packet 4 (interview appointment)",
        "Attend K-1 interview",
        "Receive K-1 visa",
        "Enter U.S. within 6 months",
        "Get married within 90 days",
        "File I-485 for AOS",
      ];
    case "k3":
      return [
        "File I-130 petition",
        "File I-129F for K-3",
        "Wait for approvals",
        "Complete consular processing",
        "Receive visa or switch to CR-1",
      ];
    case "cr1":
      return [
        "File I-130 petition",
        "Wait for USCIS approval",
        "Complete NVC stage",
        "Attend consular interview",
        "Receive CR-1 or IR-1 visa",
        "Enter U.S. as permanent resident",
      ];
    case "i751":
      return [
        "File I-751 90 days before card expires",
        "Receive extension letter",
        "Attend biometrics (if required)",
        "Attend interview (if required)",
        "Receive approval",
        "Receive 10-year Green Card",
      ];
    case "n400":
      return [
        "Determine eligibility",
        "Complete Form N-400",
        "Submit application and pay fee",
        "Attend biometrics appointment",
        "Study for citizenship test",
        "Attend interview and test",
        "Attend oath ceremony",
        "Receive certificate of naturalization",
      ];
    default:
      return [];
  }
}

export function getCategoryImportantNotes(categoryId: string): string[] {
  // Important notes per category - matching iOS structure
  switch (categoryId) {
    case "i130":
      return [
        "Processing times vary significantly by service center",
        "Keep all receipts and notices for your records",
        "Update USCIS if your address changes",
      ];
    case "i485":
      return [
        "Do not travel outside U.S. without Advance Parole while I-485 is pending",
        "Maintain valid status until I-485 is filed",
        "Bring all original documents to interview",
      ];
    default:
      return [
        "Processing times are estimates and can vary",
        "Always verify current requirements with official sources",
        "Keep copies of all submitted documents",
      ];
  }
}
