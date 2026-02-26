// FAQ Data - Structure matching iOS FAQSeedData
// Note: This is a template structure. Full data should be extracted from iOS FAQSeedData.swift (1624+ lines)
import { FAQLibrary, CommunityFAQCategory, CommunityFAQItem, FAQSourceRef } from "../types/help-center";

// Helper to create FAQ source ref
function createSource(title: string, url: string, publisher: string): FAQSourceRef {
  return {
    id: `source_${Date.now()}_${Math.random()}`,
    title,
    url,
    publisher,
    lastChecked: new Date().toISOString(),
  };
}

// Sample FAQ items - Full data should be extracted from FAQSeedData.swift
// This is a minimal structure showing the format

export const faqLibrary: FAQLibrary = {
  categories: [
    {
      id: "aos-i485",
      title: "AOS / I-485",
      subtitle: "Adjustment of Status questions",
      items: [
        {
          id: "aos-1",
          question: "How long until biometrics after I-485 receipt notice?",
          context: "User asking local FO/AOS next-steps timing. Priority Date: Dec 4, 2025, Michigan Field Office.",
          forms: ["I-485"],
          stage: "aos",
          tags: ["Michigan FO", "biometrics timeline", "receipt notice"],
          locationHint: "Michigan",
          officialAnswer: "After filing Form I-485, USCIS typically schedules a biometrics appointment within 5-8 weeks after receiving your application. Processing times for Form I-485 vary by field office. The Detroit, MI Field Office processing times can range from approximately 6.5 to 12.5 months. After biometrics, you may receive your Employment Authorization Document (EAD) and Advance Parole (AP) if filed concurrently, typically within 3-6 months. For the most current processing times, check the USCIS Processing Times tool for your specific form and field office.",
          officialSources: [
            createSource("USCIS Processing Times", "https://egov.uscis.gov/processing-times/", "USCIS"),
            createSource("Preparing for Your Biometric Services Appointment", "https://www.uscis.gov/forms/filing-guidance/preparing-for-your-biometric-services-appointment", "USCIS"),
          ],
          communityNotes: [],
          isVerified: true,
        },
        {
          id: "aos-2",
          question: "Should I re-upload evidence before interview?",
          context: "Interview preparation question about re-uploading evidence that was already submitted",
          forms: ["I-485"],
          stage: "aos",
          tags: ["interview prep", "re-upload evidence"],
          locationHint: undefined,
          officialAnswer: "USCIS does not require you to re-upload evidence that was already submitted with your application. However, you should bring all original documents and copies to your interview. If you have updated or additional evidence (such as recent joint bank statements, updated tax returns, or new relationship evidence), you may upload it to your USCIS online account or bring it to the interview. The interviewing officer will have access to documents already in your file. Focus on bringing originals of all submitted documents and any new evidence that supports your case.",
          officialSources: [
            createSource("USCIS Policy Manual - Interview Guidelines", "https://www.uscis.gov/policy-manual/volume-7-part-a-chapter-5", "USCIS"),
          ],
          communityNotes: [],
          isVerified: true,
        },
      ],
    },
    {
      id: "nvc-consular",
      title: "NVC / Consular Processing",
      subtitle: "National Visa Center and consular processing",
      items: [
        {
          id: "nvc-1",
          question: "How long from USCIS approval to NVC welcome letter?",
          context: "Transfer timeline from USCIS to NVC. Days until case sent to NVC and days until welcome letter received.",
          forms: ["I-130"],
          stage: "nvc",
          tags: ["transfer to NVC", "welcome letter wait"],
          locationHint: undefined,
          officialAnswer: "After USCIS approves an I-130 petition for consular processing, it typically takes 2-4 weeks for USCIS to send the case to the National Visa Center (NVC). Once NVC receives the case, it usually takes an additional 2-4 weeks to process it and send the Welcome Letter (also called the NVC Welcome Letter or Choice of Agent form). The entire process from USCIS approval to receiving the Welcome Letter typically takes 4-8 weeks total. However, processing times can vary. You can check your case status on the CEAC website using your USCIS receipt number once the case is transferred to NVC.",
          officialSources: [
            createSource("National Visa Center - Processing Times", "https://travel.state.gov/content/travel/en/us-visas/immigrate/national-visa-center/nvc-timeframes.html", "U.S. Department of State"),
          ],
          communityNotes: [],
          isVerified: true,
        },
      ],
    },
    {
      id: "k1-fiance",
      title: "K-1 Fiancé Visa",
      subtitle: "Fiancé visa processing",
      items: [
        {
          id: "k1-1",
          question: "K-1 NOA2 received but no DOS case number — what to do?",
          context: "K-1 NOA2 to DOS transfer wait. NOA2 received Sept 23, 2025. USCIS says case sent to DOS but no case number or welcome letter received.",
          forms: ["I-129F"],
          stage: "uscis",
          tags: ["NOA2 to DOS", "case number wait"],
          locationHint: undefined,
          officialAnswer: "After USCIS approves the I-129F (NOA2), it typically takes 2-4 weeks for the case to be sent to the Department of State (DOS) and then forwarded to the appropriate U.S. embassy or consulate. The embassy will then send Packet 3 (instructions) to the beneficiary. You can check case status on the CEAC website using your USCIS receipt number. If more than 4-6 weeks have passed since NOA2, you can contact the U.S. embassy where the interview will take place to inquire about case status. The embassy will provide the case number once they receive the file. Be patient, as the transfer process can take several weeks.",
          officialSources: [
            createSource("K-1 Fiancé(e) Visa Process", "https://travel.state.gov/content/travel/en/us-visas/immigrate/family-immigration/fiancee-visa.html", "U.S. Department of State"),
          ],
          communityNotes: [],
          isVerified: true,
        },
      ],
    },
    {
      id: "i751-roc",
      title: "I-751 ROC / Travel",
      subtitle: "Removal of Conditions and travel",
      items: [
        {
          id: "roc-1",
          question: "Can I travel with expired green card and I-797 extension?",
          context: "Travel with expired GC and extension letter. Returning from international travel with expired green card plus I-797 extension for I-751.",
          forms: ["I-751"],
          stage: "travel",
          tags: ["travel with extension letter"],
          locationHint: undefined,
          officialAnswer: "Yes, you can return to the United States with an expired Permanent Resident Card (Green Card) and a valid Form I-797, Notice of Action, that shows your Form I-751 (Petition to Remove Conditions on Residence) is pending. The I-797 extends your conditional resident status for 24 months from the expiration date on your Green Card. CBP officers at ports of entry are familiar with this extension letter.",
          officialSources: [
            createSource("Form I-751, Petition to Remove Conditions on Residence", "https://www.uscis.gov/i-751", "USCIS"),
          ],
          communityNotes: [],
          isVerified: true,
        },
      ],
    },
    {
      id: "n400-citizenship",
      title: "N-400 / Citizenship / Passports",
      subtitle: "Naturalization and passport questions",
      items: [],
    },
    {
      id: "family",
      title: "Family",
      subtitle: "Family-based immigration questions",
      items: [],
    },
    {
      id: "entry",
      title: "Entry",
      subtitle: "Entry and travel questions",
      items: [],
    },
    {
      id: "misc",
      title: "Misc",
      subtitle: "Miscellaneous questions",
      items: [],
    },
    {
      id: "global-scenarios",
      title: "Global Scenarios",
      subtitle: "Common immigration scenarios",
      items: [],
    },
    {
      id: "real-life-scenarios",
      title: "Real-Life Scenarios",
      subtitle: "Real-life immigration scenarios",
      items: [],
    },
  ],
};

// Helper to get stage display name
export function getStageDisplayName(stage: string): string {
  const stageMap: Record<string, string> = {
    uscis: "USCIS",
    nvc: "NVC",
    embassy: "Embassy/Consulate",
    aos: "AOS",
    roc: "Removal of Conditions",
    naturalization: "Naturalization",
    travel: "Travel",
    work_auth: "Work Authorization",
    misc: "Miscellaneous",
  };
  return stageMap[stage] || stage;
}
