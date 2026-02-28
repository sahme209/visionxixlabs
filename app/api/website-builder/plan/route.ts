import { NextRequest, NextResponse } from "next/server";
import { generateCompletion } from "@/lib/ai/provider";

export type WebsitePlan = {
  sections: { id: string; name: string; description: string }[];
  designLanguage: string;
  colorPalette: { primary: string; secondary: string; accent: string };
  siteName: string;
  heroHtml?: string;
  /** Full-page HTML — design, structure, all sections, graphics (Base44-style) */
  fullPageHtml?: string;
  /** Layout: bento | zigzag | split | grid | editorial */
  layout?: string;
  /** Visual style: minimal | bold | glassmorphism | editorial | corporate */
  visualStyle?: string;
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
 * Body: { prompt: string, visualStyle?: string, layout?: string }
 * Returns: { sections, designLanguage, colorPalette, siteName, heroHtml, fullPageHtml, inferredOperatorProfile }
 * fullPageHtml: complete single-page HTML (design, structure, graphics) — Base44-style full build
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt ?? "").trim();
    const visualStyle = String(body?.visualStyle ?? "").trim() || "modern professional";
    const layout = String(body?.layout ?? "").trim() || "split";
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 1. Plan (sections, design, colors, layout, vibe, inferred infra profile)
    let planResult;
    try {
      planResult = await generateCompletion({
        systemPrompt: `You are an expert website builder AI (Base44-style). Given a user prompt, output a JSON object with:
- sections: array of { id, name, description } (e.g. Hero, Services, About, Process, Testimonials, FAQ, Contact)
- designLanguage: 1-2 sentence aesthetic + vibe (e.g. "Clean, enterprise, trustworthy. Feels like Stripe.")
- colorPalette: { primary, secondary, accent } hex colors
- siteName: short name for the site
- layout: "bento"|"zigzag"|"split"|"grid"|"editorial" — structure style
- visualStyle: "minimal"|"bold"|"glassmorphism"|"editorial"|"corporate" — aesthetic
- inferredOperatorProfile: { projectType, hostingProvider, trafficLevel, hasCiCd, publicExposure, primaryGoal }
  projectType: "SaaS"|"Static Site"|"E-commerce"|"Internal Tool"|"API"|"Microservices"
  hostingProvider: "AWS"|"GCP"|"Azure"|"Vercel"|"Other"
  trafficLevel: "Low"|"Medium"|"High"
  hasCiCd: "yes"|"no"
  publicExposure: "API"|"Public Web"|"Internal Only"
  primaryGoal: "Launch faster"|"Reduce costs"|"Improve security"|"Scale architecture"

Output ONLY valid JSON. No markdown.`,
        userPrompt: `User prompt: ${prompt}${visualStyle ? `\nVisual style: ${visualStyle}` : ""}${layout ? `\nLayout preference: ${layout}` : ""}`,
        temperature: 0.5,
        maxTokens: 2048,
        responseFormat: "json",
      });
    } catch (aiErr) {
      return NextResponse.json(
        { error: "AI not configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY." },
        { status: 503 }
      );
    }

    const planText = planResult.text?.trim() || "{}";
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

    const designLang = String(parsed.designLanguage ?? "").trim() || "Clean, professional, modern";
    const layoutType = String(parsed.layout ?? layout).trim() || "split";
    const vibe = String(parsed.visualStyle ?? visualStyle).trim() || "modern professional";

    // 2. Full-page HTML (Base44-style: design, structure, graphics, all sections)
    const fullPageResult = await generateCompletion({
      systemPrompt: `You generate a complete, self-contained single-page website. Output ONLY raw HTML (no markdown, no code blocks).

REQUIREMENTS:
- Full page: nav, hero, and ALL sections from the plan. Each section with real content.
- Design: ${designLang}. Layout: ${layoutType}. Vibe: ${vibe}.
- Colors: primary ${colorPalette.primary}, secondary ${colorPalette.secondary}, accent ${colorPalette.accent}
- Use inline CSS. Modern, responsive (flexbox/grid). System fonts (sans-serif) or Georgia for editorial.
- Graphics: Use CSS gradients, subtle patterns, or data:image/svg+xml for icons. No external images.
- Nav: sticky, links to section anchors (#hero, #services, #about, #contact, etc.)
- Sections: Hero (headline, subheadline, CTA), Services/Features, About, Testimonials (optional), FAQ (accordion-style), Contact (form or email)
- Max 200 lines. No script tags. No external links. Self-contained only.
- Make it production-quality, conversion-focused.`,
      userPrompt: `Site: ${siteName}. Prompt: ${prompt}. Sections: ${sections.map((s) => s.name).join(", ")}. Create full HTML.`,
      temperature: 0.6,
      maxTokens: 8192,
    });

    let fullPageHtml = fullPageResult.text?.trim() ?? "";
    if (fullPageHtml) {
      fullPageHtml = fullPageHtml.replace(/```html?\s*/gi, "").replace(/```\s*/g, "").trim();
      if (!fullPageHtml.startsWith("<")) fullPageHtml = "";
    }

    // Hero-only for backward compat (extract or generate minimal)
    let heroHtml = fullPageHtml;
    if (heroHtml) {
      const heroMatch = heroHtml.match(/<body[^>]*>([\s\S]*?)<(?:section|div)[^>]*id=["']?(?:services|features|about)["']?/i);
      if (heroMatch) heroHtml = `<div>${heroMatch[1]}</div>`;
      else heroHtml = heroHtml.slice(0, 8000);
    }

    return NextResponse.json({
      sections,
      designLanguage: designLang,
      colorPalette,
      siteName,
      heroHtml: heroHtml || undefined,
      fullPageHtml: fullPageHtml || undefined,
      layout: layoutType,
      visualStyle: vibe,
      inferredOperatorProfile,
    });
  } catch (e) {
    console.error("[website-builder plan]", e);
    return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
  }
}
