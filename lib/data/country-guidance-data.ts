// Country Guidance Data - Structure matching iOS GuidanceLibrarySeedData
// Note: This is a template structure. Full data should be extracted from iOS GuidanceLibrarySeedData.swift
import { CountryPack, GuidanceSection, GuidanceItem, SourceRef } from "../types/help-center";

// Helper to create a country pack with standard sections
function createCountryPack(
  id: string,
  countryName: string,
  sources: SourceRef[],
  warnings?: string[]
): CountryPack {
  return {
    id,
    countryName,
    visaType: "IR1/CR1",
    lastUpdated: new Date().toISOString(),
    officialSources: sources,
    sections: [
      createCEACUploadSection(id),
      createInterviewDocumentsSection(id),
      createMedicalRequirementsSection(id),
      createTimelineSection(id),
      createLocalQuirksSection(id),
    ],
    warnings,
  };
}

function createCEACUploadSection(countryId: string): GuidanceSection {
  return {
    id: "ceac_upload",
    title: "CEAC / NVC Upload Checklist",
    subtitle: "Documents to upload to CEAC portal at NVC stage",
    items: [
      {
        id: `${countryId}_app_birth`,
        text: "Birth certificate (original or certified copy)",
        isRequired: true,
        tag: "needsVerification",
        category: "document",
      },
      {
        id: `${countryId}_app_marriage`,
        text: "Marriage certificate (if applicable)",
        isRequired: true,
        tag: "needsVerification",
        category: "document",
      },
      {
        id: `${countryId}_app_passport`,
        text: "Passport biographic page (copy)",
        isRequired: true,
        tag: "official",
        category: "document",
      },
      {
        id: `${countryId}_app_police`,
        text: "Police certificate (if required for your country)",
        isRequired: true,
        tag: "needsVerification",
        category: "document",
      },
      {
        id: `${countryId}_app_photos`,
        text: "Two passport-style photos",
        isRequired: true,
        tag: "official",
        category: "document",
      },
      {
        id: `${countryId}_pet_i864`,
        text: "I-864 Affidavit of Support with supporting documents",
        isRequired: true,
        tag: "official",
        category: "document",
      },
      {
        id: `${countryId}_pet_tax`,
        text: "Tax returns (most recent 3 years) or tax transcripts",
        isRequired: true,
        tag: "official",
        category: "document",
      },
      {
        id: `${countryId}_pet_employment`,
        text: "Employment letter and recent pay stubs",
        isRequired: true,
        tag: "official",
        category: "document",
      },
    ],
    notes: [
      `Check the official Reciprocity Schedule for your country to verify acceptable document formats.`,
      "Some documents may need translation and certification. Verify requirements with embassy.",
    ],
    warnings: [
      "Document requirements vary by country. Always verify with official embassy sources before uploading.",
    ],
  };
}

function createInterviewDocumentsSection(countryId: string): GuidanceSection {
  return {
    id: "interview_documents",
    title: "What to Bring to Interview",
    subtitle: "Bring originals and copies to your interview",
    items: [
      {
        id: `${countryId}_int_originals`,
        text: "All original civil documents (birth certificate, marriage certificate, etc.)",
        isRequired: true,
        tag: "official",
        category: "interview",
      },
      {
        id: `${countryId}_int_passport`,
        text: "Valid passport (original)",
        isRequired: true,
        tag: "official",
        category: "interview",
      },
      {
        id: `${countryId}_int_photos`,
        text: "Two additional passport photos (if not already submitted)",
        isRequired: false,
        tag: "needsVerification",
        category: "interview",
      },
      {
        id: `${countryId}_int_medical`,
        text: "Sealed medical examination results (from panel physician)",
        isRequired: true,
        tag: "official",
        category: "interview",
      },
      {
        id: `${countryId}_int_police`,
        text: "Original police certificate (if required)",
        isRequired: true,
        tag: "needsVerification",
        category: "interview",
      },
    ],
    notes: [
      "Bring both originals and copies. Embassy may keep originals and return copies.",
      "Check embassy interview letter for specific requirements.",
    ],
  };
}

function createMedicalRequirementsSection(countryId: string): GuidanceSection {
  return {
    id: "medical_requirements",
    title: "Medical Requirements",
    subtitle: "Complete medical examination before interview",
    items: [
      {
        id: `${countryId}_med_passport`,
        text: "Valid passport (original)",
        isRequired: true,
        tag: "official",
        category: "medical",
      },
      {
        id: `${countryId}_med_photos`,
        text: "Passport-style photos (quantity varies by panel physician)",
        isRequired: true,
        tag: "needsVerification",
        category: "medical",
      },
      {
        id: `${countryId}_med_vaccine`,
        text: "Vaccination records (if available)",
        isRequired: false,
        tag: "needsVerification",
        category: "medical",
      },
      {
        id: `${countryId}_med_previous`,
        text: "Previous medical records (if applicable)",
        isRequired: false,
        tag: "optional",
        category: "medical",
      },
    ],
    notes: [
      "Schedule medical examination with embassy-approved panel physician.",
      "Medical results are typically valid for 6 months.",
      "Check embassy website for approved panel physician locations.",
    ],
    warnings: [
      "Vaccination requirements vary by country. Verify with panel physician or embassy medical instructions.",
    ],
  };
}

function createTimelineSection(countryId: string): GuidanceSection {
  return {
    id: "timeline_guidance",
    title: "Timeline Guidance",
    subtitle: "Processing time estimates",
    items: [
      {
        id: `${countryId}_time_nvc`,
        text: "NVC processing: 2-4 months after case is documentarily qualified",
        isRequired: false,
        tag: "community",
        category: "timeline",
      },
      {
        id: `${countryId}_time_interview`,
        text: "Interview scheduling: Varies by embassy backlog",
        isRequired: false,
        tag: "needsVerification",
        category: "timeline",
      },
      {
        id: `${countryId}_time_ap`,
        text: "Administrative Processing (if applicable): 2-6 months typically",
        isRequired: false,
        tag: "community",
        category: "timeline",
      },
    ],
    notes: [
      "Timelines are estimates only and can vary significantly.",
      "Check embassy website for current processing times if published.",
      "Delays may occur due to document requests, security checks, or embassy backlogs.",
    ],
    warnings: [
      "These are community estimates, not official timelines. Actual processing times may vary.",
    ],
  };
}

function createLocalQuirksSection(countryId: string): GuidanceSection {
  return {
    id: "local_quirks",
    title: "Local Embassy Quirks / Optional Items",
    subtitle: "Country-specific notes and tips",
    items: [
      {
        id: `${countryId}_quirk_language`,
        text: "Documents may need translation to English if not already in English",
        isRequired: false,
        tag: "needsVerification",
        category: "quirk",
      },
      {
        id: `${countryId}_quirk_consulate`,
        text: "Verify which consulate processes your case (may vary by city/region)",
        isRequired: false,
        tag: "needsVerification",
        category: "quirk",
      },
    ],
    notes: [
      "Check embassy website for country-specific requirements and procedures.",
      "Some embassies have specific document formats or additional requirements.",
    ],
    warnings: [
      "Local requirements can change. Always verify with official embassy sources before your interview.",
    ],
  };
}

// Country flag emoji mapping
const countryFlags: Record<string, string> = {
  Pakistan: "🇵🇰",
  India: "🇮🇳",
  Bangladesh: "🇧🇩",
  Philippines: "🇵🇭",
  Mexico: "🇲🇽",
  "United Kingdom": "🇬🇧",
  Canada: "🇨🇦",
};

export function getCountryFlag(countryName: string): string {
  return countryFlags[countryName] || "🌍";
}

// Create country packs - matching iOS structure
export const countryGuidanceLibrary: CountryPack[] = [
  createCountryPack(
    "pakistan",
    "Pakistan",
    [
      {
        id: "pk_reciprocity",
        title: "Pakistan Reciprocity Schedule",
        url: "https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country/Pakistan.html",
        publisher: "U.S. State Department",
        lastCheckedDate: new Date().toISOString(),
      },
      {
        id: "pk_embassy",
        title: "U.S. Embassy Islamabad - Immigrant Visa Information",
        url: "https://pk.usembassy.gov/visas/immigrant-visas/",
        publisher: "U.S. Embassy Islamabad",
        lastCheckedDate: new Date().toISOString(),
      },
    ],
    [
      "Some requirements may vary by consulate. Verify with official embassy sources.",
      "Medical requirements and panel physician locations should be confirmed directly with the embassy.",
    ]
  ),
  createCountryPack(
    "india",
    "India",
    [
      {
        id: "in_reciprocity",
        title: "India Reciprocity Schedule",
        url: "https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country/India.html",
        publisher: "U.S. State Department",
        lastCheckedDate: new Date().toISOString(),
      },
      {
        id: "in_embassy",
        title: "U.S. Consulate Mumbai - Immigrant Visa",
        url: "https://in.usembassy.gov/visas/immigrant-visas/",
        publisher: "U.S. Consulate Mumbai",
        lastCheckedDate: new Date().toISOString(),
      },
    ],
    [
      "Requirements may differ between Mumbai, New Delhi, Chennai, Hyderabad, and Kolkata consulates. Verify with your specific consulate.",
      "Police certificate requirements vary by state. Check official reciprocity schedule for your state.",
    ]
  ),
  createCountryPack(
    "bangladesh",
    "Bangladesh",
    [
      {
        id: "bd_reciprocity",
        title: "Bangladesh Reciprocity Schedule",
        url: "https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country/Bangladesh.html",
        publisher: "U.S. State Department",
        lastCheckedDate: new Date().toISOString(),
      },
      {
        id: "bd_embassy",
        title: "U.S. Embassy Dhaka - Immigrant Visa",
        url: "https://bd.usembassy.gov/visas/immigrant-visas/",
        publisher: "U.S. Embassy Dhaka",
        lastCheckedDate: new Date().toISOString(),
      },
    ],
    ["Verify all document requirements with official embassy sources before interview."]
  ),
  createCountryPack(
    "philippines",
    "Philippines",
    [
      {
        id: "ph_reciprocity",
        title: "Philippines Reciprocity Schedule",
        url: "https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country/Philippines.html",
        publisher: "U.S. State Department",
        lastCheckedDate: new Date().toISOString(),
      },
      {
        id: "ph_embassy",
        title: "U.S. Embassy Manila - Immigrant Visa",
        url: "https://ph.usembassy.gov/visas/immigrant-visas/",
        publisher: "U.S. Embassy Manila",
        lastCheckedDate: new Date().toISOString(),
      },
    ]
  ),
  createCountryPack(
    "mexico",
    "Mexico",
    [
      {
        id: "mx_reciprocity",
        title: "Mexico Reciprocity Schedule",
        url: "https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country/Mexico.html",
        publisher: "U.S. State Department",
        lastCheckedDate: new Date().toISOString(),
      },
      {
        id: "mx_embassy",
        title: "U.S. Consulate Ciudad Juarez - Immigrant Visa",
        url: "https://mx.usembassy.gov/embassy-consulates/ciudad-juarez/",
        publisher: "U.S. Consulate Ciudad Juarez",
        lastCheckedDate: new Date().toISOString(),
      },
    ],
    ["Most IR1/CR1 cases are processed at Ciudad Juarez. Verify your specific consulate assignment."]
  ),
  createCountryPack(
    "united_kingdom",
    "United Kingdom",
    [
      {
        id: "uk_reciprocity",
        title: "United Kingdom Reciprocity Schedule",
        url: "https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country/UnitedKingdom.html",
        publisher: "U.S. State Department",
        lastCheckedDate: new Date().toISOString(),
      },
      {
        id: "uk_embassy",
        title: "U.S. Embassy London - Immigrant Visa",
        url: "https://uk.usembassy.gov/visas/immigrant-visas/",
        publisher: "U.S. Embassy London",
        lastCheckedDate: new Date().toISOString(),
      },
    ]
  ),
  createCountryPack(
    "canada",
    "Canada",
    [
      {
        id: "ca_reciprocity",
        title: "Canada Reciprocity Schedule",
        url: "https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country/Canada.html",
        publisher: "U.S. State Department",
        lastCheckedDate: new Date().toISOString(),
      },
      {
        id: "ca_embassy",
        title: "U.S. Consulate Montreal - Immigrant Visa",
        url: "https://ca.usembassy.gov/embassies-consulates/consulate-general-montreal/",
        publisher: "U.S. Consulate Montreal",
        lastCheckedDate: new Date().toISOString(),
      },
    ],
    ["Most IR1/CR1 cases are processed at Montreal. Verify your specific consulate assignment."]
  ),
];
