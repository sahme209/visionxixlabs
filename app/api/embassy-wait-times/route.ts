import { NextResponse } from "next/server";

/**
 * API route to fetch embassy wait times from U.S. State Department website
 * Source: https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html
 * This avoids CORS issues by doing server-side scraping
 */

interface EmbassyWaitTime {
  city: string;
  b1b2WaitTimeMonths?: number;
  b1b2NextAvailableMonths?: number;
  fMjNextAvailableMonths?: number;
  petitionBasedNextAvailableMonths?: number;
  crewTransitNextAvailableMonths?: number;
  // Computed for I-129F (K-1 fiancé visa)
  i129fWaitTimeDays?: number;
}

// Simple cache (in production, use Redis or similar)
let cachedWaitTimes: Map<string, EmbassyWaitTime> = new Map();
let cacheTimestamp: Date | null = null;
let isLoading = false; // Prevent concurrent loads
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");

    // Check cache
    if (cacheTimestamp && Date.now() - cacheTimestamp.getTime() < CACHE_TTL && cachedWaitTimes.size > 0) {
      if (city) {
        const normalizedCity = city.toLowerCase();
        // Try exact match
        if (cachedWaitTimes.has(normalizedCity)) {
          return NextResponse.json({ waitTime: cachedWaitTimes.get(normalizedCity) });
        }
        // Try fuzzy match
        for (const [cachedCity, waitTime] of cachedWaitTimes.entries()) {
          if (normalizedCity.includes(cachedCity) || cachedCity.includes(normalizedCity)) {
            return NextResponse.json({ waitTime });
          }
        }
      } else {
        // Return all wait times
        return NextResponse.json({
          waitTimes: Array.from(cachedWaitTimes.values()),
        });
      }
    }

    // Prevent concurrent loads
    if (isLoading) {
      // Wait a bit and return cached data if available, or empty array
      if (cachedWaitTimes.size > 0) {
        return NextResponse.json({
          waitTimes: Array.from(cachedWaitTimes.values()),
        });
      }
      return NextResponse.json({ waitTimes: [] });
    }

    isLoading = true;

    try {
      // Fetch from State Department website
      const response = await fetch(
        "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; VisaNova/1.0)",
          },
        }
      );

      if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch wait times" }, { status: 500 });
      }

      const html = await response.text();
      const waitTimes = parseWaitTimeTable(html);

      // Update cache
      cachedWaitTimes = new Map();
      for (const wt of waitTimes) {
        cachedWaitTimes.set(wt.city.toLowerCase(), wt);
      }
      cacheTimestamp = new Date();
      
      // Only log once per cache refresh (not on every request)
      if (waitTimes.length > 0 && !city) {
        // Log is intentionally minimal to avoid spam
      }

      if (city) {
        const normalizedCity = city.toLowerCase();
        // Try exact match
        if (cachedWaitTimes.has(normalizedCity)) {
          return NextResponse.json({ waitTime: cachedWaitTimes.get(normalizedCity) });
        }
        // Try fuzzy match
        for (const [cachedCity, waitTime] of cachedWaitTimes.entries()) {
          if (normalizedCity.includes(cachedCity) || cachedCity.includes(normalizedCity)) {
            return NextResponse.json({ waitTime });
          }
        }
        return NextResponse.json({ error: "City not found" }, { status: 404 });
      }

      return NextResponse.json({
        waitTimes: Array.from(cachedWaitTimes.values()),
      });
    } catch (error) {
      console.error("[EmbassyWaitTimesAPI] Error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    } finally {
      isLoading = false;
    }
  } catch (error) {
    console.error("[EmbassyWaitTimesAPI] Outer error:", error);
    isLoading = false;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function parseWaitTimeTable(html: string): EmbassyWaitTime[] {
  const waitTimes: EmbassyWaitTime[] = [];

  // Extract table rows - look for <tr> tags with <td> cells
  // The table structure is:
  // <tr><td>City</td><td>B1/B2 Avg</td><td>B1/B2 Next</td><td>F/M/J Next</td><td>Petition-Based Next</td><td>Crew/Transit Next</td></tr>

  // Use regex to find table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];

    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      cells.push(cleanHTML(cellMatch[1]));
    }

    if (cells.length >= 6) {
      const city = cells[0].trim();
      // Skip header row
      if (city.toLowerCase().includes("city/post") || city.toLowerCase().includes("interview required")) {
        continue;
      }

      if (city) {
        const b1b2Avg = parseWaitTimeMonths(cells[1]);
        const b1b2Next = parseWaitTimeMonths(cells[2]);
        const fMjNext = parseWaitTimeMonths(cells[3]);
        const petitionNext = parseWaitTimeMonths(cells[4]);
        const crewNext = parseWaitTimeMonths(cells[5]);

        // For I-129F (K-1 fiancé visa), use F/M/J category or B1/B2 as fallback
        const i129fWaitTimeDays = fMjNext
          ? Math.round(fMjNext * 30)
          : b1b2Next
          ? Math.round(b1b2Next * 30)
          : undefined;

        waitTimes.push({
          city,
          b1b2WaitTimeMonths: b1b2Avg,
          b1b2NextAvailableMonths: b1b2Next,
          fMjNextAvailableMonths: fMjNext,
          petitionBasedNextAvailableMonths: petitionNext,
          crewTransitNextAvailableMonths: crewNext,
          i129fWaitTimeDays,
        });
      }
    }
  }

  return waitTimes;
}

function parseWaitTimeMonths(text: string): number | undefined {
  const cleaned = text.trim();
  if (!cleaned || cleaned.toUpperCase() === "NA" || cleaned === "") {
    return undefined;
  }

  // Handle "< 0.5 Month" format
  if (cleaned.includes("< 0.5") || cleaned.includes("<0.5")) {
    return 0.5;
  }

  // Extract number (e.g., "2 Months" -> 2, "3.5 Months" -> 3.5)
  const match = cleaned.match(/([\d.]+)/);
  if (match) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? undefined : num;
  }

  return undefined;
}

function cleanHTML(html: string): string {
  // Remove HTML tags
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}
