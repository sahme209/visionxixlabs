import { NextRequest, NextResponse } from "next/server";

/**
 * API Route to proxy RSS feeds (fixes CORS issues)
 * This allows the client to fetch RSS feeds from external sources
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    // Validate URL
    const targetUrl = new URL(url);
    
    // Only allow specific domains for security
    const allowedDomains = [
      "uscis.gov",
      "dhs.gov",
      "travel.state.gov",
      "news.google.com",
    ];

    const isAllowed = allowedDomains.some((domain) => targetUrl.hostname.includes(domain));

    if (!isAllowed) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }

    // Fetch the RSS feed
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VisaNova/1.0; +https://visanova.com)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: response.status }
      );
    }

    const xmlText = await response.text();

    // Return as XML with proper headers
    return new NextResponse(xmlText, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error: any) {
    console.error("Error proxying RSS feed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch RSS feed" },
      { status: 500 }
    );
  }
}
