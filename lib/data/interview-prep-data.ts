// Interview Prep Q&A Data - Exact match from iOS InterviewPrepView.defaultQAPairs
import { InterviewQAPair } from "../types/help-center";

export const interviewQAPairs: InterviewQAPair[] = [
  // Personal Information
  {
    id: 0,
    category: "Personal Information",
    question: "What is your full legal name?",
    answer: "State your complete legal name exactly as it appears on your passport, birth certificate, and all official documents. Include any middle names.",
    tips: "Be consistent with all documents. If you've changed your name, bring proof of the change."
  },
  {
    id: 1,
    category: "Personal Information",
    question: "Where and when were you born?",
    answer: "Provide your exact place of birth (city, state/province, country) and date of birth as shown on your birth certificate.",
    tips: "Have your birth certificate ready. Be precise with dates and locations."
  },
  {
    id: 2,
    category: "Personal Information",
    question: "What is your current address?",
    answer: "Provide your complete current residential address, including apartment number if applicable. Also mention how long you've lived there.",
    tips: "Bring proof of residence like utility bills or lease agreements."
  },
  
  // Background & History
  {
    id: 3,
    category: "Background & History",
    question: "Have you ever been arrested or convicted of a crime?",
    answer: "Answer honestly. You must disclose all arrests, charges, and convictions, even if they were dismissed or expunged. Include traffic violations if they resulted in arrest.",
    tips: "Honesty is critical. Withholding information can result in denial. Bring court documents if applicable."
  },
  {
    id: 4,
    category: "Background & History",
    question: "Have you ever been denied a visa or entry to any country?",
    answer: "Disclose any visa denials, entry refusals, or deportations from any country, including the United States.",
    tips: "Be prepared to explain the circumstances and what has changed since then."
  },
  {
    id: 5,
    category: "Background & History",
    question: "Have you ever been a member of any organizations?",
    answer: "List all organizations, clubs, political parties, or groups you've been a member of, including dates of membership.",
    tips: "This includes professional associations, social clubs, and any groups you've joined."
  },
  
  // Employment & Education
  {
    id: 6,
    category: "Employment & Education",
    question: "What is your employment history?",
    answer: "Provide a chronological list of all jobs, including employer names, job titles, dates of employment, and main responsibilities.",
    tips: "Bring employment letters, pay stubs, or tax returns as proof. Be ready to explain any gaps."
  },
  {
    id: 7,
    category: "Employment & Education",
    question: "What is your educational background?",
    answer: "List all schools, colleges, and universities you've attended, including degrees earned, dates, and locations.",
    tips: "Bring diplomas, transcripts, or certificates. Include both formal education and professional training."
  },
  
  // Family & Relationships
  {
    id: 8,
    category: "Family & Relationships",
    question: "Do you have any family members in the United States?",
    answer: "List all immediate family members (spouse, children, parents, siblings) who are U.S. citizens or permanent residents, including their status and relationship to you.",
    tips: "Be specific about their immigration status and how they obtained it."
  },
  {
    id: 9,
    category: "Family & Relationships",
    question: "Are you married? If so, tell us about your spouse.",
    answer: "Provide your spouse's full name, date of birth, nationality, current status, and how you met. Include details about your relationship history.",
    tips: "Bring marriage certificate and photos showing your relationship timeline."
  },
  
  // Purpose & Intent
  {
    id: 10,
    category: "Purpose & Intent",
    question: "Why are you applying for this visa/status?",
    answer: "Clearly explain your purpose for immigrating, your plans in the United States, and how this aligns with your background and goals.",
    tips: "Be specific and honest. Show you understand the requirements and responsibilities."
  },
  {
    id: 11,
    category: "Purpose & Intent",
    question: "What will you do in the United States?",
    answer: "Describe your plans for work, study, or other activities. Include where you plan to live and how you'll support yourself.",
    tips: "Be realistic and specific. Show you've thought through your plans."
  },
  
  // Language & Communication
  {
    id: 12,
    category: "Language & Communication",
    question: "What languages do you speak?",
    answer: "List all languages you speak, indicating your proficiency level (native, fluent, conversational, basic) in each.",
    tips: "Be honest about your English proficiency. The interview may be conducted in English or with an interpreter."
  },
  
  // Financial
  {
    id: 13,
    category: "Financial",
    question: "How will you support yourself financially?",
    answer: "Explain your financial resources, including savings, employment offers, sponsor support, or other means of financial support.",
    tips: "Bring bank statements, employment letters, or affidavits of support. Show you won't become a public charge."
  },
  
  // Documents & Evidence
  {
    id: 14,
    category: "Documents & Evidence",
    question: "Have you brought all required documents?",
    answer: "Confirm you have all required documents organized and ready, including passport, forms, photos, civil documents, and supporting evidence.",
    tips: "Organize documents in a folder. Bring originals and copies. Review the checklist before the interview."
  }
];

// Group questions by category
export const questionsByCategory = interviewQAPairs.reduce((acc, qa) => {
  if (!acc[qa.category]) {
    acc[qa.category] = [];
  }
  acc[qa.category].push(qa);
  return acc;
}, {} as Record<string, InterviewQAPair[]>);

export const categories = Object.keys(questionsByCategory).sort();
