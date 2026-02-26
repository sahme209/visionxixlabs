import OpenAI from "openai";

export type AIStarterPackage = {
  companyName: string;
  tagline: string;
  aboutText: string;
  services: string[];
  faqItems?: { q: string; a: string }[];
  contactEmail: string;
  contactPhone?: string;
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
    aboutText: parsed.aboutText || "About us.",
    services: Array.isArray(parsed.services) ? parsed.services.slice(0, 6) : ["Service 1", "Service 2", "Service 3"],
    faqItems: Array.isArray(parsed.faqItems) ? parsed.faqItems.slice(0, 5) : undefined,
    contactEmail: formData.email || parsed.contactEmail || "contact@example.com",
    contactPhone: parsed.contactPhone,
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

Output a JSON object with these exact keys:
{
  "companyName": string,
  "tagline": string (short, professional),
  "aboutText": string (2-3 paragraphs),
  "services": string[] (3-6 service names),
  "faqItems": [{ "q": string, "a": string }] (2-5 FAQs),
  "contactEmail": string,
  "contactPhone": string (optional)
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
