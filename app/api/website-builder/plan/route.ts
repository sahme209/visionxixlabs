import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export type WebsitePlan = {
  sections: { id: string; name: string; description: string }[];
  designLanguage: string;
  colorPalette: { primary: string; secondary: string; accent: string };
  siteName: string;
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
 * Returns: { sections, designLanguage, colorPalette, siteName }
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
    const completion = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a website builder AI. Given a user prompt describing the site they want, output a JSON object with:
- sections: array of { id, name, description } for each page section (e.g. Hero, Services, About, Process, Testimonials, FAQ, Contact)
- designLanguage: 1-2 sentence aesthetic (e.g. "Clean, professional, trustworthy")
- colorPalette: { primary, secondary, accent } hex colors (e.g. "#1e3a5f", "#f97316", "#06b6d4")
- siteName: short name for the site

Output ONLY valid JSON. No markdown, no code blocks.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "{}";
    const parsed = parseJSON<WebsitePlan>(text);

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

    return NextResponse.json({
      sections,
      designLanguage: String(parsed.designLanguage ?? "").trim() || "Clean, professional, modern",
      colorPalette: {
        primary: String(parsed.colorPalette?.primary ?? "#1e3a5f").trim(),
        secondary: String(parsed.colorPalette?.secondary ?? "#64748b").trim(),
        accent: String(parsed.colorPalette?.accent ?? "#f97316").trim(),
      },
      siteName: String(parsed.siteName ?? "").trim() || "Your Site",
    });
  } catch (e) {
    console.error("[website-builder plan]", e);
    return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
  }
}
