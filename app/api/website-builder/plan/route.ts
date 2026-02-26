import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export type WebsitePlan = {
  sections: { id: string; name: string; description: string }[];
  designLanguage: string;
  colorPalette: { primary: string; secondary: string; accent: string };
  siteName: string;
  heroHtml?: string;
  inferredOperatorProfile?: {
    projectType: string;
    hostingProvider: string;
    trafficLevel: string;
    hasCiCd: string;
    publicExposure: string;
    primaryGoal: string;
  };
};

function parseJSON<T>(text: string): Partial<T> {
  const s = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(s) as Partial<T>;
  } catch {
    return {};
  }
}

/**
 * POST /api/website-builder/plan
 * Body: { prompt: string }
 * Returns: { sections, designLanguage, colorPalette, siteName, heroHtml, inferredOperatorProfile }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt ?? "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const openai = new OpenAI({ apiKey });

    // 1. Plan (sections, design, colors, inferred infra profile)
    const planCompletion = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a website builder AI. Given a user prompt, output a JSON object with:
- sections: array of { id, name, description } (e.g. Hero, Services, About, Process, Testimonials, FAQ, Contact)
- designLanguage: 1-2 sentence aesthetic
- colorPalette: { primary, secondary, accent } hex colors
- siteName: short name for the site
- inferredOperatorProfile: { projectType, hostingProvider, trafficLevel, hasCiCd, publicExposure, primaryGoal }
  projectType: "SaaS"|"Static Site"|"E-commerce"|"Internal Tool"|"API"|"Microservices"
  hostingProvider: "AWS"|"GCP"|"Azure"|"Vercel"|"Other"
  trafficLevel: "Low"|"Medium"|"High"
  hasCiCd: "yes"|"no"
  publicExposure: "API"|"Public Web"|"Internal Only"
  primaryGoal: "Launch faster"|"Reduce costs"|"Improve security"|"Scale architecture"

Output ONLY valid JSON. No markdown.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
    });

    const planText = planCompletion.choices[0]?.message?.content?.trim() || "{}";
    const parsed = parseJSON<WebsitePlan>(planText);

    const sections = Array.isArray(parsed.sections)
      ? parsed.sections.slice(0, 10).map((s) => ({
          id: String(s?.id ?? "").trim() || "section",
          name: String(s?.name ?? "").trim() || "Section",
          description: String(s?.description ?? "").trim() || "",
        }))
      : [
          { id: "hero", name: "Hero", description: "Landing with headline and call-to-action" },
          { id: "services", name: "Services", description: "What you offer" },
          { id: "about", name: "About", description: "Company credibility" },
          { id: "contact", name: "Contact", description: "Get in touch form" },
        ];

    const siteName = String(parsed.siteName ?? "").trim() || "Your Site";
    const colorPalette = {
      primary: String(parsed.colorPalette?.primary ?? "#1e3a5f").trim(),
      secondary: String(parsed.colorPalette?.secondary ?? "#64748b").trim(),
      accent: String(parsed.colorPalette?.accent ?? "#f97316").trim(),
    };

    const inferredOperatorProfile = parsed.inferredOperatorProfile
      ? {
          projectType: String(parsed.inferredOperatorProfile.projectType ?? "Static Site").trim(),
          hostingProvider: String(parsed.inferredOperatorProfile.hostingProvider ?? "Vercel").trim(),
          trafficLevel: String(parsed.inferredOperatorProfile.trafficLevel ?? "Low").trim(),
          hasCiCd: String(parsed.inferredOperatorProfile.hasCiCd ?? "no").trim(),
          publicExposure: String(parsed.inferredOperatorProfile.publicExposure ?? "Public Web").trim(),
          primaryGoal: String(parsed.inferredOperatorProfile.primaryGoal ?? "Launch faster").trim(),
        }
      : undefined;

    // 2. Hero HTML preview (GPT generates self-contained HTML)
    const heroCompletion = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You generate a self-contained HTML hero section for a website. Output ONLY raw HTML (no markdown, no code blocks). Use inline styles. The HTML must be a single block: a hero section with:
- A compelling headline for "${siteName}"
- A subheadline (1-2 sentences)
- A primary CTA button
- Use colors: primary ${colorPalette.primary}, accent ${colorPalette.accent}
- Modern, professional layout
- Max 80 lines of HTML
- No script tags, no external links
- Use system fonts (sans-serif)`,
        },
        {
          role: "user",
          content: `Create hero HTML for: ${prompt}. Design: ${parsed.designLanguage ?? "Clean, professional"}`,
        },
      ],
      temperature: 0.6,
    });

    let heroHtml = heroCompletion.choices[0]?.message?.content?.trim() ?? "";
    if (heroHtml) {
      heroHtml = heroHtml.replace(/```html?\s*/gi, "").replace(/```\s*/g, "").trim();
      if (!heroHtml.startsWith("<")) heroHtml = "";
    }

    return NextResponse.json({
      sections,
      designLanguage: String(parsed.designLanguage ?? "").trim() || "Clean, professional, modern",
      colorPalette,
      siteName,
      heroHtml: heroHtml || undefined,
      inferredOperatorProfile,
    });
  } catch (e) {
    console.error("[website-builder plan]", e);
    return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
  }
}
