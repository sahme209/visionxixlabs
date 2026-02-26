/**
 * AI Website Starter Package generator.
 * Uses OpenAI to produce structured output for preview site generation.
 * Env: OPENAI_API_KEY, NEXT_PUBLIC_BASE_URL
 */

import OpenAI from "openai";
import type { LeadFormData } from "./leadSchema";

export interface AiStarterPackage {
  siteStructure: {
    pages: Array<{ name: string; sections: string[] }>;
  };
  heroHeadline: string;
  heroSubheadline: string;
  draftCopy: {
    home: string;
    services: string;
    about: string;
    contact: string;
  };
  ctaRecommendations: Array<{
    label: string;
    placement: string;
    type: "button" | "form" | "link";
  }>;
  colorStyleDirection: string;
  seoStarter: {
    keywords: string[];
    metaTitle: string;
    metaDescription: string;
  };
  nextStepsDomainHosting: {
    haveDomainHosting: { whatWeNeed: string[] };
    needHelp: {
      recommendedRegistrar: string;
      recommendedHosting: string;
      stepsWeHandle: string[];
    };
  };
  disclaimer: string;
}

const DEFAULT_PKG: AiStarterPackage = {
  siteStructure: {
    pages: [
      { name: "Home", sections: ["Hero", "Intro", "CTA"] },
      { name: "About", sections: ["Bio", "Mission"] },
      { name: "Services", sections: ["Offerings"] },
      { name: "Contact", sections: ["Form"] },
    ],
  },
  heroHeadline: "Welcome to Your Business",
  heroSubheadline: "Professional services tailored to your needs.",
  draftCopy: {
    home: "We help businesses succeed with tailored solutions. Get in touch to learn more.",
    services: "We offer a range of services designed to meet your specific needs. Contact us for details.",
    about: "Our team brings expertise and dedication to every project.",
    contact: "Ready to get started? Reach out and we'll respond within 1–2 business days.",
  },
  ctaRecommendations: [{ label: "Get in Touch", placement: "Hero", type: "button" }],
  colorStyleDirection: "Clean, professional, minimal.",
  seoStarter: { keywords: ["services", "business"], metaTitle: "Your Business", metaDescription: "Professional business services." },
  nextStepsDomainHosting: {
    haveDomainHosting: {
      whatWeNeed: ["Registrar login (or DNS access)", "Admin/panel access for hosting", "Point DNS to our hosting"],
    },
    needHelp: {
      recommendedRegistrar: "Namecheap, Google Domains, or Cloudflare Registrar",
      recommendedHosting: "Vercel, Netlify, or managed hosting",
      stepsWeHandle: ["Register domain (with your approval)", "Configure DNS", "Deploy and connect"],
    },
  },
  disclaimer: "This is a draft. Final copy and design will be refined during the project.",
};

function buildPrompt(data: LeadFormData): string {
  const industry = data.industry?.replace(/_/g, " ") || "business";
  const type = data.projectType?.replace(/_/g, " ") || "website";
  const goals = data.projectGoals?.join(", ") || "informational";
  const name = data.businessName || data.fullName || "Your Business";
  const notes = data.additionalNotes || "";
  const sections = data.requiredSections || "";
  return `Generate a JSON object for a website starter package for this business. Business name: "${name}". Industry: ${industry}. Project type: ${type}. Goals: ${goals}. ${sections ? `Required sections: ${sections}.` : ""} ${notes ? `Notes: ${notes}` : ""}

Return ONLY valid JSON matching this structure (no markdown):
{
  "siteStructure": { "pages": [{"name":"Home","sections":["Hero","Intro","CTA"]},{"name":"About","sections":["Bio"]},{"name":"Services","sections":["Offerings"]},{"name":"Contact","sections":["Form"]}] },
  "heroHeadline": "string (compelling, 5-12 words)",
  "heroSubheadline": "string (supporting tagline)",
  "draftCopy": { "home": "string", "services": "string", "about": "string", "contact": "string" },
  "ctaRecommendations": [{ "label": "string", "placement": "string", "type": "button|form|link" }],
  "colorStyleDirection": "string (brief design direction)",
  "seoStarter": { "keywords": ["string"], "metaTitle": "string", "metaDescription": "string" },
  "nextStepsDomainHosting": {
    "haveDomainHosting": { "whatWeNeed": ["string"] },
    "needHelp": { "recommendedRegistrar": "string", "recommendedHosting": "string", "stepsWeHandle": ["string"] }
  },
  "disclaimer": "This is a draft. Final copy and design will be refined during the project."
}`;
}

export async function generateWebsiteStarterPackage(data: LeadFormData): Promise<AiStarterPackage> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    console.warn("[aiWebsiteStarter] OPENAI_API_KEY missing, returning default package");
    return DEFAULT_PKG;
  }

  try {
    const openai = new OpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You generate JSON only. No markdown, no code fences." },
        { role: "user", content: buildPrompt(data) },
      ],
      temperature: 0.6,
      max_tokens: 2000,
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return DEFAULT_PKG;

    let parsed: unknown;
    const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      parsed = JSON.parse(json);
    } catch {
      return DEFAULT_PKG;
    }

    const p = parsed as Record<string, unknown>;
    const dc = (p.draftCopy as Record<string, unknown>) ?? {};
    return {
      siteStructure: (p.siteStructure as AiStarterPackage["siteStructure"]) ?? DEFAULT_PKG.siteStructure,
      heroHeadline: (typeof p.heroHeadline === "string" ? p.heroHeadline : "") || DEFAULT_PKG.heroHeadline,
      heroSubheadline: (typeof p.heroSubheadline === "string" ? p.heroSubheadline : "") || DEFAULT_PKG.heroSubheadline,
      draftCopy: {
        home: typeof dc.home === "string" ? dc.home : DEFAULT_PKG.draftCopy.home,
        services: typeof dc.services === "string" ? dc.services : DEFAULT_PKG.draftCopy.services,
        about: typeof dc.about === "string" ? dc.about : DEFAULT_PKG.draftCopy.about,
        contact: typeof dc.contact === "string" ? dc.contact : DEFAULT_PKG.draftCopy.contact,
      },
      ctaRecommendations: Array.isArray(p.ctaRecommendations) ? (p.ctaRecommendations as AiStarterPackage["ctaRecommendations"]) : DEFAULT_PKG.ctaRecommendations,
      colorStyleDirection: typeof p.colorStyleDirection === "string" ? p.colorStyleDirection : DEFAULT_PKG.colorStyleDirection,
      seoStarter: (p.seoStarter as AiStarterPackage["seoStarter"]) ?? DEFAULT_PKG.seoStarter,
      nextStepsDomainHosting: (p.nextStepsDomainHosting as AiStarterPackage["nextStepsDomainHosting"]) ?? DEFAULT_PKG.nextStepsDomainHosting,
      disclaimer: typeof p.disclaimer === "string" ? p.disclaimer : DEFAULT_PKG.disclaimer,
    };
  } catch (e) {
    console.warn("[aiWebsiteStarter] AI failed:", e instanceof Error ? e.message : String(e));
    return DEFAULT_PKG;
  }
}
