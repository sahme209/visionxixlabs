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

/** Derive Unsplash image keywords from prompt and site name */
function deriveImageKeywords(prompt: string, siteName: string): string {
  const text = `${prompt} ${siteName}`.toLowerCase();
  const mappings: { pattern: RegExp; keywords: string }[] = [
    { pattern: /immigration|visa|consulting/, keywords: "immigration,office,professional" },
    { pattern: /saas|software|startup|tech/, keywords: "technology,startup,office" },
    { pattern: /e-commerce|store|shop|fashion/, keywords: "fashion,product,minimal" },
    { pattern: /portfolio|creative|design/, keywords: "creative,workspace,minimal" },
    { pattern: /restaurant|food|cafe/, keywords: "food,restaurant,cozy" },
    { pattern: /health|medical|clinic/, keywords: "healthcare,medical,professional" },
    { pattern: /law|legal|attorney/, keywords: "law,office,professional" },
    { pattern: /real.?estate|property/, keywords: "architecture,real-estate,modern" },
    { pattern: /education|school|course/, keywords: "education,learning,people" },
    { pattern: /agency|marketing/, keywords: "business,team,creative" },
  ];
  for (const { pattern, keywords } of mappings) {
    if (pattern.test(text)) return keywords;
  }
  return "business,professional,modern";
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
        systemPrompt: `You are an expert website builder AI. Given a user prompt, output a JSON object with:
- sections: array of { id, name, description } (e.g. Hero, Services, About, Process, Testimonials, FAQ, Contact)
- designLanguage: 1-2 sentence aesthetic + vibe (e.g. "Bold, futuristic, trustworthy. Feels like Stripe meets Vercel.")
- colorPalette: { primary, secondary, accent } — use VIBRANT hex colors (e.g. #6366f1 #8b5cf6 #ec4899 or #0ea5e9 #06b6d4). Avoid dull grays.
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

    // Derive image keywords from prompt for Unsplash (e.g. "immigration consulting" -> "immigration,office,professional")
    const imageKeywords = deriveImageKeywords(prompt, siteName);

    // 2. Full-page HTML — premium, futuristic, competitive with top website builders
    const fullPageResult = await generateCompletion({
      systemPrompt: `You generate PREMIUM, FUTURISTIC single-page websites that compete with Wix, Webflow, and Framer. Output ONLY raw HTML (no markdown, no code blocks).

=== DESIGN PRINCIPLES ===
- VISUAL BALANCE: Generous whitespace, clear hierarchy, 60/30/10 color rule. Max-width 1200px, sections min 80px vertical padding.
- RICH VISUALS: Must include 3–6 real images via Unsplash. Use: https://source.unsplash.com/1200x800/?KEYWORDS (replace KEYWORDS with 2-3 comma-separated terms like "business,office" or "immigration,professional" or "technology,startup").
- VIBRANT COLORS: Use ${colorPalette.primary}, ${colorPalette.secondary}, ${colorPalette.accent} as base. Add gradients: linear-gradient(135deg, primary, accent), radial-gradient for hero backgrounds. Never flat/boring.
- ANIMATIONS: Include @keyframes in <style>: fadeInUp (opacity 0→1, translateY 24px→0), float (subtle translateY -6px), pulse (scale 1→1.02). Apply animation: fadeInUp 0.8s ease-out both with animation-delay (0.1s, 0.2s, 0.3s) for staggered reveal. Hover: transform scale(1.02), transition 0.3s.
- TYPOGRAPHY: Use <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">. H1: 2.75–3.5rem, font-weight 800. H2: 2rem. Body: 1.125rem, line-height 1.7.
- LAYOUT: ${layoutType}. Responsive grid/flexbox. Hero: full-width with gradient overlay on image. Cards: border-radius 16–24px, box-shadow, hover lift.

=== SECTIONS (all required) ===
1. NAV: Sticky, glassmorphism (backdrop-filter: blur(12px); background: rgba(255,255,255,0.8)), links to #hero #services #about #contact.
2. HERO: Full-viewport or 80vh, background image from Unsplash OR bold gradient. Headline + subheadline + primary CTA button (gradient, rounded-2xl). Overlay if image.
3. SERVICES/FEATURES: 3–4 cards with icons (SVG or emoji), images, staggered fadeInUp.
4. ABOUT: Image + text side-by-side (or stacked on mobile), fadeInUp.
5. TESTIMONIALS: 2–3 quotes with gradient borders or cards.
6. FAQ: Accordion-style (details/summary) or expandable cards.
7. CONTACT: Form or CTA with gradient button. Footer with links.

=== IMAGE RULES ===
- Hero: <img src="https://source.unsplash.com/1920x1080/?${imageKeywords}" alt="..." style="object-fit:cover;width:100%;height:100%;position:absolute;inset:0">
- Section images: https://source.unsplash.com/800x600/?keyword1,keyword2 — use 3–5 different images across sections.
- All images: border-radius, optional overlay.

=== OUTPUT ===
- Full HTML document with <!DOCTYPE html>, <head> (meta viewport, title, Google Fonts), <body>.
- <style> block with keyframes, base styles, responsive @media (max-width: 768px).
- NO external script. Inline/CSS only.
- 300–500 lines. Production-quality. Conversion-focused. UNIQUE and FUTURISTIC.`,
      userPrompt: `Site: ${siteName}. Theme: ${prompt}. Design: ${designLang}. Layout: ${layoutType}. Vibe: ${vibe}. Image keywords for Unsplash: ${imageKeywords}. Sections: ${sections.map((s) => s.name).join(", ")}. Create a STUNNING, premium HTML site.`,
      temperature: 0.65,
      maxTokens: 12000,
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
