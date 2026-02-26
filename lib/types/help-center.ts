// Help Center Data Types - Matching iOS Structure

// Interview Prep Types
export interface InterviewQAPair {
  id: number;
  category: string;
  question: string;
  answer: string;
  tips: string;
}

// Documents & Sponsors Types
export type DocumentTopic = "221(g) / Missing docs" | "I-864 Affidavit of Support" | "Joint Sponsor";

export interface DocumentTopicData {
  definitionTitle: string;
  definitionMessage: string;
  checklistItems: string[];
  uploadHint: string;
}

// Country Guidance Types
export interface GuidanceLibrary {
  countries: CountryPack[];
  lastUpdated: string;
}

export interface CountryPack {
  id: string;
  countryName: string;
  visaType: string;
  lastUpdated: string;
  officialSources: SourceRef[];
  sections: GuidanceSection[];
  warnings?: string[];
}

export interface SourceRef {
  id: string;
  title: string;
  url: string;
  publisher: string;
  lastCheckedDate: string;
}

export interface GuidanceSection {
  id: string;
  title: string;
  subtitle?: string;
  items: GuidanceItem[];
  notes?: string[];
  warnings?: string[];
}

export interface GuidanceItem {
  id: string;
  text: string;
  isRequired: boolean;
  tag: ItemTag;
  category: ItemCategory;
  sourceURL?: string;
  lastCheckedDate?: string;
}

export type ItemTag = "required" | "optional" | "official" | "community" | "needsVerification";
export type ItemCategory = "document" | "medical" | "interview" | "timeline" | "quirk";

// FAQ Types
export interface FAQLibrary {
  categories: CommunityFAQCategory[];
}

export interface CommunityFAQCategory {
  id: string;
  title: string;
  subtitle?: string;
  items: CommunityFAQItem[];
}

export interface CommunityFAQItem {
  id: string;
  question: string;
  context?: string;
  forms: string[];
  stage: FAQStage;
  tags: string[];
  locationHint?: string;
  officialAnswer?: string;
  officialSources: FAQSourceRef[];
  communityNotes: string[];
  isVerified: boolean;
}

export type FAQStage = 
  | "uscis" 
  | "nvc" 
  | "embassy" 
  | "aos" 
  | "roc" 
  | "naturalization" 
  | "travel" 
  | "work_auth" 
  | "misc";

export interface FAQSourceRef {
  id: string;
  title: string;
  url: string;
  publisher: string;
  lastChecked: string;
}

// Process Timeline Types
export interface ProcessTimelineCategory {
  id: string;
  title: string;
  description: string;
  estimatedTime: string;
  icon: string;
  tint: string;
}

export interface TimelinePhase {
  title: string;
  duration: string;
  description: string;
}

// Timeline Scenario Types
export interface TimelineScenario {
  pace: number;
  estimatedDate: string;
  bestCase: string;
  likelyCase: string;
  worstCase: string;
  deltaDays: number;
}
