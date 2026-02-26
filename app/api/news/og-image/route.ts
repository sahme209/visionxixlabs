import { NextRequest, NextResponse } from "next/server";

const ALLOWED_DOMAINS = [
  "uscis.gov",
  "dhs.gov",
  "travel.state.gov",
  "state.gov",
  "whitehouse.gov",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "npr.org",
  "nytimes.com",
  "washingtonpost.com",
  "theguardian.com",
  "cnn.com",
  "axios.com",
  "politico.com",
  "bloomberg.com",
  "wsj.com",
  "law360.com",
  "lexisnexis.com",
  "jdsupra.com",
  "natlawreview.com",
  "news.google.com",
  "googlenews.com",
  "huffpost.com",
  "nbcnews.com",
  "abcnews.go.com",
  "cbsnews.com",
  "foxnews.com",
  "usatoday.com",
  "latimes.com",
  "chicagotribune.com",
  "denverpost.com",
  "miamiherald.com",
  "immigrationimpact.com",
  "aila.org",
  "ilw.com",
  "forbes.com",
  "www.forbes.com",
];

function extractOgImage(html: string): string | null {
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogImageMatch) return ogImageMatch[1].trim();

  const twitterImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  if (twitterImageMatch) return twitterImageMatch[1].trim();

  const imgMatch = html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1].trim();

  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const targetUrl = new URL(url);
    const isAllowed = ALLOWED_DOMAINS.some(
      (d) => targetUrl.hostname === d || targetUrl.hostname.endsWith("." + d)
    );
    if (!isAllowed) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VisaNova/1.0; +https://visanova.app)",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ imageUrl: null });
    }

    const html = await response.text();
    const imageUrl = extractOgImage(html);

    return NextResponse.json(
      { imageUrl },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
