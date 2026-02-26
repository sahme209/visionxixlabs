// Documents & Sponsors Data - Exact match from iOS DocumentsSponsorsView
import { DocumentTopic, DocumentTopicData } from "../types/help-center";

export const documentTopicData: Record<DocumentTopic, DocumentTopicData> = {
  "221(g) / Missing docs": {
    definitionTitle: "What is 221(g)?",
    definitionMessage: "221(g) is a temporary refusal notice asking for additional documents. Your case is NOT denied - submit the requested docs to continue processing.",
    checklistItems: [
      "Read your 221(g) notice carefully - it lists exactly what's needed",
      "Submit ALL requested documents together (don't send partial submissions)",
      "Use the exact format requested (original vs. copy, certified translations, etc.)",
      "Submit before the deadline (usually 1 year from notice date)",
      "Keep copies of everything you submit",
      "Upload via CEAC portal if instructed, or mail to embassy",
      "Track delivery confirmation if mailing",
      "Wait 2-4 weeks after submission before checking status"
    ],
    uploadHint: "Upload via CEAC portal (if instructed) or mail to the embassy address on your 221(g) notice."
  },
  "I-864 Affidavit of Support": {
    definitionTitle: "What is I-864?",
    definitionMessage: "I-864 Affidavit of Support proves the sponsor can financially support you. Required for most family-based green card cases.",
    checklistItems: [
      "Use most recent tax year (usually last 3 years of tax returns)",
      "Include all required pages of tax return (1040, W-2s, 1099s)",
      "Get IRS tax transcripts if possible (more reliable than returns)",
      "Show current income meets 125% of poverty guidelines",
      "Include proof of current employment (pay stubs, employment letter)",
      "Sign and date the form (sponsor AND household member if applicable)",
      "Include all household members on form (even if not immigrating)",
      "Submit original signed form (not a copy)"
    ],
    uploadHint: "Submit to NVC via CEAC portal (if at NVC stage) or include with your I-485 package if filing AOS."
  },
  "Joint Sponsor": {
    definitionTitle: "What is a Joint Sponsor?",
    definitionMessage: "A joint sponsor is someone who helps meet income requirements if the primary sponsor's income is too low. They must be a U.S. citizen or LPR.",
    checklistItems: [
      "Joint sponsor must be U.S. citizen or LPR",
      "Joint sponsor must meet income requirements independently",
      "Joint sponsor needs to complete separate I-864 form",
      "Include joint sponsor's tax returns, W-2s, employment proof",
      "Joint sponsor must sign and date their I-864",
      "You can have multiple joint sponsors if needed",
      "Joint sponsor's income is added to primary sponsor's income",
      "Both sponsors' forms must be submitted together"
    ],
    uploadHint: "Submit joint sponsor's I-864 together with primary sponsor's I-864 to NVC via CEAC portal."
  }
};

export const documentTopics: DocumentTopic[] = [
  "221(g) / Missing docs",
  "I-864 Affidavit of Support",
  "Joint Sponsor"
];

export function getTopicIcon(topic: DocumentTopic): string {
  switch (topic) {
    case "221(g) / Missing docs":
      return "doc-text-magnifying-glass";
    case "I-864 Affidavit of Support":
      return "document-text";
    case "Joint Sponsor":
      return "user-group";
    default:
      return "document-text";
  }
}
