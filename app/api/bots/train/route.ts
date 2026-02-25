import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as cheerio from "cheerio";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; VisionXIXBot/1.0; +https://visionxixlabs.com)",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, aside").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return text.slice(0, 50000);
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { botId?: string; url?: string; text?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { botId, url, text } = body;
    if (!botId || typeof botId !== "string") {
      return NextResponse.json({ error: "botId required" }, { status: 400 });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.user.id },
    });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    let content = "";
    let type = "text";

    if (url && typeof url === "string") {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }
        content = await scrapeUrl(url);
        type = "url";
      } catch (err) {
        console.error("[Train] Scrape error:", err);
        return NextResponse.json({ error: "Failed to fetch URL" }, { status: 400 });
      }
    } else if (text && typeof text === "string") {
      content = text.slice(0, 50000);
      type = "text";
    } else {
      return NextResponse.json({ error: "url or text required" }, { status: 400 });
    }

    const charCount = content.length;
    const pageCount = Math.ceil(charCount / 2500);

    if (bot.pageCount + pageCount > bot.pageLimit) {
      return NextResponse.json(
        { error: `Page limit (${bot.pageLimit}) exceeded. Upgrade your plan.` },
        { status: 403 }
      );
    }

    await prisma.$transaction([
      prisma.knowledgeSource.create({
        data: {
          botId,
          type,
          url: type === "url" ? url : undefined,
          content,
          charCount,
        },
      }),
      prisma.bot.update({
        where: { id: botId },
        data: { pageCount: { increment: pageCount } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Train API]", e);
    return NextResponse.json({ error: "Training failed" }, { status: 500 });
  }
}
