import { NextResponse } from "next/server";
import { clinicVRubioCaseData } from "@/lib/data/clinicVRubioCase";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
}

/**
 * Parses Google News RSS XML into items
 */
function parseRSS(xmlText: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const itemXml = match[1];
    const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || itemXml.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

    if (title && link) {
      items.push({ title, link, pubDate });
    }
  }

  return items;
}

/**
 * Fetches news about visa freeze / Rubio from Google News RSS
 */
async function fetchVisaFreezeNews(): Promise<{ title: string; url: string; date: string }[]> {
  try {
    const query = encodeURIComponent("visa freeze Rubio State Department 75 countries");
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VisaNova/1.0; +https://visanova.com)",
      },
      next: { revalidate: 90 }, // Refresh news every 90s for near–real-time case updates
    });

    if (!response.ok) return [];

    const xmlText = await response.text();
    const items = parseRSS(xmlText);

    const relevantKeywords = ["visa", "rubio", "freeze", "state department", "immigrant", "75 countries", "clinic", "lawsuit"];
    return items
      .slice(0, 8)
      .filter((item) => {
        const combined = (item.title + " " + item.link).toLowerCase();
        return relevantKeywords.some((kw) => combined.includes(kw));
      })
      .map((item) => ({
        title: item.title.replace(/<[^>]+>/g, ""),
        url: item.link,
        date: item.pubDate ? new Date(item.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      }));
  } catch (error) {
    console.error("Error fetching visa freeze news:", error);
    return [];
  }
}

/**
 * GET /api/clinic-v-rubio
 * Returns case info + curated updates + live news about the visa freeze lawsuit
 */
export async function GET() {
  try {
    const [curatedData, liveNews] = await Promise.all([Promise.resolve(clinicVRubioCaseData), fetchVisaFreezeNews()]);

    const updates = [
      ...curatedData.curatedUpdates.map((u) => ({
        id: u.id,
        date: u.date,
        title: u.title,
        summary: u.summary,
        source: u.source,
        sourceUrl: u.sourceUrl,
        type: "curated" as const,
      })),
      ...liveNews.map((n, i) => ({
        id: `news-${i}`,
        date: n.date,
        title: n.title,
        summary: n.title,
        source: "News",
        sourceUrl: n.url,
        type: "news" as const,
      })),
    ];

    // Sort by date (newest first) – approximate since formats vary
    updates.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (isNaN(da) || isNaN(db)) return 0;
      return db - da;
    });

    return NextResponse.json(
      {
        ...curatedData,
        updates,
        lastFetched: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=90",
        },
      }
    );
  } catch (error) {
    console.error("Error in clinic-v-rubio API:", error);
    return NextResponse.json(
      { error: "Failed to load case data" },
      { status: 500 }
    );
  }
}
