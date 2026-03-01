import { NextRequest, NextResponse } from "next/server";
import { orchestrateGenerate } from "@/lib/ai/orchestrator";

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
    { pattern: /restaurant|food|cafe|dining/, keywords: "food,restaurant,cozy" },
    { pattern: /health|medical|clinic|wellness/, keywords: "healthcare,medical,professional" },
    { pattern: /law|legal|attorney/, keywords: "law,office,professional" },
    { pattern: /real.?estate|property|housing/, keywords: "architecture,real-estate,modern" },
    { pattern: /education|school|course|learning/, keywords: "education,learning,people" },
    { pattern: /agency|marketing|creative/, keywords: "business,team,creative" },
    { pattern: /fitness|gym|yoga|sport/, keywords: "fitness,workout,energy" },
    { pattern: /travel|tour|hotel|vacation/, keywords: "travel,adventure,landscape" },
    { pattern: /finance|bank|invest|money/, keywords: "finance,office,trust" },
    { pattern: /spa|beauty|salon|cosmetic/, keywords: "spa,wellness,relax" },
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
      planResult = await orchestrateGenerate({
        taskType: "content_generation",
        systemPrompt: `You are an expert website builder AI. Output a JSON object with:
- sections: array of { id, name, description }. Include 5–8 sections tailored to the prompt. Examples: Hero, Services/Features, About, Team, Process/HowItWorks, Testimonials, Pricing (if relevant), FAQ, CTA, Contact. Each description should be 1 sentence.
- designLanguage: 2–3 sentences on aesthetic, vibe, and emotional resonance (e.g. "Bold, futuristic, trustworthy. Feels like Stripe meets Vercel. High-conversion, premium feel.")
- colorPalette: { primary, secondary, accent } — VIBRANT hex colors. Match industry: tech=blues/purples, wellness=greens/teals, luxury=gold/navy, creative=bold gradients.
- siteName: short, memorable name (2–4 words)
- layout: "bento"|"zigzag"|"split"|"grid"|"editorial"
- visualStyle: "minimal"|"bold"|"glassmorphism"|"editorial"|"corporate"|"creative"
- inferredOperatorProfile: { projectType, hostingProvider, trafficLevel, hasCiCd, publicExposure, primaryGoal }

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

    // 2. Full-page HTML — premium, conversion-focused, competitive with Wix/Webflow
    const fullPageResult = await orchestrateGenerate({
      taskType: "code_generation",
      systemPrompt: `You generate PREMIUM single-page websites. Output ONLY raw HTML (no markdown, no code blocks).

=== DESIGN PRINCIPLES ===
- VISUAL BALANCE: Generous whitespace, 60/30/10 color rule. Max-width 1200px, sections min 80px vertical padding. Clear visual hierarchy.
- RICH VISUALS: 4–7 real images via Unsplash. Use https://source.unsplash.com/SIZE/?KEYWORDS (SIZE: 1920x1080 hero, 800x600 sections). Vary keywords per section.
- VIBRANT COLORS: Primary ${colorPalette.primary}, secondary ${colorPalette.secondary}, accent ${colorPalette.accent}. Gradients: linear-gradient(135deg, primary, accent). Never flat/boring.
- ANIMATIONS: @keyframes fadeInUp, float, pulse. Staggered reveals (animation-delay 0.1s, 0.2s, 0.3s). Hover: transform scale(1.02), transition 0.3s.
- TYPOGRAPHY: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">. H1: 2.75–3.5rem 800. H2: 2rem. Body: 1.125rem, line-height 1.7.
- LAYOUT: ${layoutType}. Responsive grid/flexbox. Cards: border-radius 16–24px, box-shadow, hover lift.

=== SECTIONS (all required) ===
1. NAV: Sticky, glassmorphism. Links: #hero #services #about #contact. Mobile: hamburger with simple inline script to toggle menu.
2. HERO: 80vh, Unsplash bg or gradient. Compelling headline, subheadline, primary CTA.
3. SERVICES/FEATURES: 3–4 cards with icons, images, staggered fadeInUp. Real content matching the theme.
4. ABOUT: Image + text, fadeInUp.
5. TESTIMONIALS: 2–3 quotes, gradient borders.
6. FAQ: Accordion using <details><summary>. Each Q/A pair in details. Style open/closed states.
7. CONTACT: Form (name, email, message) or CTA. Footer with links.

=== INTERACTIVITY ===
- You MAY use minimal inline <script> for: smooth scroll on anchor click, FAQ accordion if details/summary needs enhancement, mobile nav toggle. Keep scripts minimal and safe (no eval, no external load).
- Prefer <details><summary> for FAQ (no script needed). Use CSS for accordion styling.

=== IMAGE RULES ===
- Hero: https://source.unsplash.com/1920x1080/?${imageKeywords}
- Sections: vary keywords (e.g. team, office, product) — 4–6 different images total.
- All images: border-radius, object-fit:cover.

=== OUTPUT ===
- Full HTML: <!DOCTYPE html>, <head> (viewport, title, Google Fonts), <body>.
- <style> with keyframes, base styles, @media (max-width: 768px) responsive.
- 350–600 lines. Production-quality. Conversion-focused. Industry-appropriate copy.`,
      userPrompt: `Site: ${siteName}. Theme: ${prompt}. Design: ${designLang}. Layout: ${layoutType}. Vibe: ${vibe}. Image keywords for Unsplash: ${imageKeywords}. Sections: ${sections.map((s) => s.name).join(", ")}. Write compelling, industry-appropriate copy for each section. Create a STUNNING, premium HTML site.`,
      temperature: 0.7,
      maxTokens: 14000,
    });

    let fullPageHtml = fullPageResult.text?.trim() ?? "";
    if (fullPageHtml) {
      fullPageHtml = fullPageHtml.replace(/```html?\s*/gi, "").replace(/```\s*/g, "").trim();
      if (!fullPageHtml.startsWith("<")) fullPageHtml = "";
      // Inject CSP meta for iframe preview: allow Google Fonts, Unsplash images
      const cspMeta =
        '<meta http-equiv="Content-Security-Policy" content="style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' https://fonts.gstatic.com; img-src \'self\' https: data: blob:;">';
      if (fullPageHtml.includes("<head>")) {
        fullPageHtml = fullPageHtml.replace("<head>", `<head>${cspMeta}`);
      } else if (fullPageHtml.includes("<html")) {
        fullPageHtml = fullPageHtml.replace(/<html[^>]*>/i, (m) => m + `<head>${cspMeta}</head>`);
      }
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
