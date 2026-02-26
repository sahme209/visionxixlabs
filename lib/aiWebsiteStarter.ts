import OpenAI from "openai";

export type AIStarterPackage = {
  companyName: string;
  tagline: string;
  aboutText: string;
  services: string[];
  faqItems?: { q: string; a: string }[];
  contactEmail: string;
  contactPhone?: string;
  metaTitle?: string;
  metaDescription?: string;
  brandTone?: string;
  homepageHero?: string;
  aboutDraft?: string;
  servicesDraft?: string;
  contactContent?: string;
};

type LeadFormData = {
  name?: string;
  email: string;
  company?: string;
  message?: string;
  industry?: string;
  hasDomain?: boolean;
  domainName?: string;
};

/**
 * Generate AI starter package from lead request.
 */
export async function generateAIStarterPackage(formData: LeadFormData): Promise<AIStarterPackage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const openai = new OpenAI({ apiKey });
  const prompt = buildPrompt(formData);

  const completion = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You generate professional website content packages for small businesses. Output valid JSON only, no markdown, no code blocks. Be concise and professional.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  const text = completion.choices[0]?.message?.content?.trim() || "{}";
  const parsed = parseJSON<AIStarterPackage>(text);

  return {
    companyName: parsed.companyName || formData.company || "Company",
    tagline: parsed.tagline || "Professional services",
    aboutText: parsed.aboutText || parsed.aboutDraft || "About us.",
    services: Array.isArray(parsed.services) ? parsed.services.slice(0, 6) : ["Service 1", "Service 2", "Service 3"],
    faqItems: Array.isArray(parsed.faqItems) ? parsed.faqItems.slice(0, 5) : undefined,
    contactEmail: formData.email || parsed.contactEmail || "contact@example.com",
    contactPhone: parsed.contactPhone,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
    brandTone: parsed.brandTone,
    homepageHero: parsed.homepageHero,
    aboutDraft: parsed.aboutDraft || parsed.aboutText,
    servicesDraft: parsed.servicesDraft,
    contactContent: parsed.contactContent,
  };
}

/**
 * Regenerate AI package with customer change request.
 */
export async function generateAIStarterPackageWithChanges(
  existingPackage: AIStarterPackage,
  formData: LeadFormData,
  changeRequest: string
): Promise<AIStarterPackage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const openai = new OpenAI({ apiKey });
  const prompt = `Update this website content package based on the customer's change request.

Current content (JSON):
${JSON.stringify(existingPackage, null, 2)}

Customer change request: "${changeRequest}"

Form context: Company ${formData.company || "N/A"}, Industry ${formData.industry || "N/A"}

Output a JSON object with the same structure as the current content, but updated per the change request.
Output only valid JSON, no markdown.`;

  const completion = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      { role: "system", content: "You update website content based on customer feedback. Output valid JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.6,
  });

  const text = completion.choices[0]?.message?.content?.trim() || "{}";
  const parsed = parseJSON<AIStarterPackage>(text);

  return {
    ...existingPackage,
    ...parsed,
    companyName: parsed.companyName ?? existingPackage.companyName,
    tagline: parsed.tagline ?? existingPackage.tagline,
    aboutText: parsed.aboutText ?? parsed.aboutDraft ?? existingPackage.aboutText,
    services: Array.isArray(parsed.services) ? parsed.services.slice(0, 6) : existingPackage.services,
    contactEmail: parsed.contactEmail ?? existingPackage.contactEmail,
  };
}

function buildPrompt(data: LeadFormData): string {
  return `Generate a website content package for a new website request.

Form data:
- Name: ${data.name || "Not provided"}
- Email: ${data.email}
- Company: ${data.company || "Not provided"}
- Message/request: ${data.message || "Not provided"}
- Industry: ${data.industry || "General business"}
- Has domain: ${data.hasDomain ? "Yes" : "No"}
- Domain: ${data.domainName || "N/A"}

Output a JSON object with these keys:
{
  "companyName": string,
  "tagline": string (short, professional),
  "aboutText": string (2-3 paragraphs for About page),
  "services": string[] (3-6 service names),
  "faqItems": [{ "q": string, "a": string }] (2-5 FAQs, optional),
  "contactEmail": string,
  "contactPhone": string (optional),
  "metaTitle": string (SEO title, ~60 chars),
  "metaDescription": string (SEO description, ~155 chars),
  "brandTone": string (e.g. professional, friendly, innovative - one line),
  "homepageHero": string (hero headline for homepage, punchy)
}

Output only valid JSON.`;
}

function parseJSON<T>(text: string): Partial<T> {
  let s = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(s) as Partial<T>;
  } catch {
    return {};
  }
}
