/**
 * AI Website Starter Package generator.
 * Uses unified provider (OpenAI, Gemini, Anthropic) per AI_PROVIDER or fallback order.
 * Env: OPENAI_API_KEY | GEMINI_API_KEY | ANTHROPIC_API_KEY, AI_PROVIDER (optional), NEXT_PUBLIC_BASE_URL.
 */

import { generateCompletion } from "@/lib/ai/provider";
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

const EXPECTED_JSON_SCHEMA = `{
  "siteStructure": { "pages": [{ "name": string, "sections": string[] }] },
  "heroHeadline": string,
  "heroSubheadline": string,
  "draftCopy": { "home": string, "services": string, "about": string, "contact": string },
  "ctaRecommendations": [{ "label": string, "placement": string, "type": "button"|"form"|"link" }],
  "colorStyleDirection": string,
  "seoStarter": { "keywords": string[], "metaTitle": string, "metaDescription": string },
  "nextStepsDomainHosting": {
    "haveDomainHosting": { "whatWeNeed": string[] },
    "needHelp": { "recommendedRegistrar": string, "recommendedHosting": string, "stepsWeHandle": string[] }
  },
  "disclaimer": string
}`;

const SYSTEM_PROMPT = `You are an expert web strategist and copywriter for a professional web agency. Your job is to produce a structured "Website Starter Package" for a client based on their project brief. Output ONLY valid JSON matching this schema (no markdown, no code blocks):

${EXPECTED_JSON_SCHEMA}

Rules:
- siteStructure.pages: 3–5 pages (e.g. Home, About, Services, Contact); each page has 2–5 section names
- heroHeadline: punchy, benefit-focused, max 12 words
- heroSubheadline: supporting line, max 25 words
- draftCopy: 2–4 sentences per section, professional tone, industry-appropriate
- ctaRecommendations: 3–5 CTAs (label, placement e.g. "hero", "footer", type)
- colorStyleDirection: 1–2 sentences on palette and style based on industry
- seoStarter: exactly 5 keywords, metaTitle 50–60 chars, metaDescription 150–160 chars
- nextStepsDomainHosting: actionable lists; haveDomainHosting.whatWeNeed = what access we need (registrar, DNS, hosting login); needHelp = recommended registrar + hosting + what we'll handle
- disclaimer: "Draft content generated for planning. Final content refined during build."`;

function buildUserPrompt(data: LeadFormData): string {
  const lines = [
    `Business: ${data.businessName || "(not provided)"}`,
    `Industry: ${data.industry}`,
    `Project type: ${data.projectType}`,
    `Number of pages: ${data.numberOfPages}`,
    `Project goals: ${data.projectGoals?.join(", ") || "—"}`,
    `Required sections: ${data.requiredSections || "—"}`,
    `Design preference: ${data.designPreference || "—"}`,
    `Copywriting needed: ${data.copywritingNeeded ? "Yes" : "No"}`,
    `Hosting/domain status: ${data.hostingDomainStatus || "unsure"}`,
    `Timeline: ${data.timeline || "—"}`,
    `Budget: ${data.budgetRange || "—"}`,
    `Additional notes: ${data.additionalNotes || "—"}`,
  ];
  return `Generate a Website Starter Package for this project:\n\n${lines.join("\n")}\n\nOutput JSON only.`;
}

export async function generateWebsiteStarterPackage(
  data: LeadFormData
): Promise<AiStarterPackage> {
  const prompt = buildUserPrompt(data);
  const { text } = await generateCompletion({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
    temperature: 0.5,
    maxTokens: 2048,
    responseFormat: "json",
  });

  const raw = (text ?? "").trim();
  if (!raw) throw new Error("Empty AI response");
  const parsed = JSON.parse(raw) as unknown;
  return validateAndNormalize(parsed);
}

function validateAndNormalize(obj: unknown): AiStarterPackage {
  const o = obj as Record<string, unknown>;
  const siteStruct = o.siteStructure as Record<string, unknown> | undefined;
  const pages = Array.isArray(siteStruct?.pages)
    ? (siteStruct.pages as Array<{ name?: string; sections?: unknown }>).map((p) => ({
        name: String(p?.name ?? ""),
        sections: Array.isArray(p?.sections) ? (p.sections as string[]).map(String) : [],
      }))
    : [];
  return {
    siteStructure: { pages },
    heroHeadline: String(o.heroHeadline ?? ""),
    heroSubheadline: String(o.heroSubheadline ?? ""),
    draftCopy: {
      home: String((o.draftCopy as Record<string, unknown>)?.home ?? ""),
      services: String((o.draftCopy as Record<string, unknown>)?.services ?? ""),
      about: String((o.draftCopy as Record<string, unknown>)?.about ?? ""),
      contact: String((o.draftCopy as Record<string, unknown>)?.contact ?? ""),
    },
    ctaRecommendations: Array.isArray(o.ctaRecommendations)
      ? (o.ctaRecommendations as Array<{ label: string; placement: string; type: string }>).map(
          (c) => ({
            label: String(c?.label ?? ""),
            placement: String(c?.placement ?? ""),
            type: ["button", "form", "link"].includes(String(c?.type ?? ""))
              ? (c.type as "button" | "form" | "link")
              : "button",
          })
        )
      : [],
    colorStyleDirection: String(o.colorStyleDirection ?? ""),
    seoStarter: {
      keywords: Array.isArray((o.seoStarter as Record<string, unknown>)?.keywords)
        ? ((o.seoStarter as Record<string, unknown>).keywords as string[]).map(String).slice(0, 5)
        : [],
      metaTitle: String((o.seoStarter as Record<string, unknown>)?.metaTitle ?? ""),
      metaDescription: String((o.seoStarter as Record<string, unknown>)?.metaDescription ?? ""),
    },
    nextStepsDomainHosting: {
      haveDomainHosting: {
        whatWeNeed: Array.isArray(
          ((o.nextStepsDomainHosting as Record<string, unknown>)?.haveDomainHosting as Record<
            string,
            unknown
          >)?.whatWeNeed
        )
          ? (
              ((o.nextStepsDomainHosting as Record<string, unknown>).haveDomainHosting as Record<
                string,
                unknown
              >).whatWeNeed as string[]
            ).map(String)
          : [],
      },
      needHelp: {
        recommendedRegistrar: String(
          ((o.nextStepsDomainHosting as Record<string, unknown>)?.needHelp as Record<
            string,
            unknown
          >)?.recommendedRegistrar ?? ""
        ),
        recommendedHosting: String(
          ((o.nextStepsDomainHosting as Record<string, unknown>)?.needHelp as Record<
            string,
            unknown
          >)?.recommendedHosting ?? ""
        ),
        stepsWeHandle: Array.isArray(
          ((o.nextStepsDomainHosting as Record<string, unknown>)?.needHelp as Record<
            string,
            unknown
          >)?.stepsWeHandle
        )
          ? (
              ((o.nextStepsDomainHosting as Record<string, unknown>).needHelp as Record<
                string,
                unknown
              >).stepsWeHandle as string[]
            ).map(String)
          : [],
      },
    },
    disclaimer:
      String(o.disclaimer ?? "").trim() ||
      "Draft content generated for planning. Final content refined during build.",
  };
}

export function aiStarterToMarkdown(pkg: AiStarterPackage, businessName: string): string {
  const lines: string[] = [
    `# Website Starter Package — ${businessName || "Your Business"}`,
    "",
    "## Site Structure",
    ...pkg.siteStructure.pages.flatMap((p) => [
      `### ${p.name}`,
      ...p.sections.map((s) => `- ${s}`),
      "",
    ]),
    "## Hero",
    `**Headline:** ${pkg.heroHeadline}`,
    `**Subheadline:** ${pkg.heroSubheadline}`,
    "",
    "## Draft Copy",
    "### Home",
    pkg.draftCopy.home,
    "",
    "### Services",
    pkg.draftCopy.services,
    "",
    "### About",
    pkg.draftCopy.about,
    "",
    "### Contact",
    pkg.draftCopy.contact,
    "",
    "## CTA Recommendations",
    ...pkg.ctaRecommendations.map(
      (c) => `- **${c.label}** (${c.placement}, ${c.type})`
    ),
    "",
    "## Color & Style",
    pkg.colorStyleDirection,
    "",
    "## SEO Starter",
    `**Keywords:** ${pkg.seoStarter.keywords.join(", ")}`,
    `**Meta Title:** ${pkg.seoStarter.metaTitle}`,
    `**Meta Description:** ${pkg.seoStarter.metaDescription}`,
    "",
    "## Next Steps — Domain & Hosting",
    "### If you have domain/hosting",
    ...pkg.nextStepsDomainHosting.haveDomainHosting.whatWeNeed.map((w) => `- ${w}`),
    "",
    "### If you need help",
    `**Recommended registrar:** ${pkg.nextStepsDomainHosting.needHelp.recommendedRegistrar}`,
    `**Recommended hosting:** ${pkg.nextStepsDomainHosting.needHelp.recommendedHosting}`,
    "**What we'll handle:**",
    ...pkg.nextStepsDomainHosting.needHelp.stepsWeHandle.map((s) => `- ${s}`),
    "",
    "---",
    `*${pkg.disclaimer}*`,
  ];
  return lines.join("\n");
}
