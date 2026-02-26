import { NextRequest, NextResponse } from "next/server";

/**
 * API Route: /api/representatives?zip=30044
 * Proxy to WhoIsMyRepresentative.com API to avoid CORS issues
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const zipCode = searchParams.get("zip");

    if (!zipCode) {
      return NextResponse.json(
        { error: "ZIP code is required" },
        { status: 400 }
      );
    }

    // Clean ZIP code (5 digits only)
    const cleanZip = zipCode.trim().replace(/\D/g, "").substring(0, 5);
    
    if (cleanZip.length < 5) {
      return NextResponse.json(
        { error: "ZIP code must be 5 digits" },
        { status: 400 }
      );
    }

    console.log(`[API] 📍 Fetching representatives for ZIP: ${cleanZip}`);

    // Fetch from WhoIsMyRepresentative.com API
    const apiUrl = `https://whoismyrepresentative.com/getall_mems.php?zip=${cleanZip}&output=json`;
    console.log(`[API] 🌐 Request URL: ${apiUrl}`);
    
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; VisaNova/1.0)",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`[API] ❌ WhoIsMyRepresentative API returned ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.error(`[API] Error response:`, errorText);
          // Return empty results instead of error to allow fallback
          return NextResponse.json({ results: [] });
        }

        const contentType = response.headers.get("content-type");
        console.log(`[API] Response Content-Type: ${contentType}`);
        
        let data;
        if (contentType?.includes("application/json")) {
          data = await response.json();
        } else {
          // Try to parse as text first, then JSON
          const text = await response.text();
          console.log(`[API] Raw response (first 500 chars):`, text.substring(0, 500));
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            console.error(`[API] Failed to parse response as JSON:`, parseError);
            return NextResponse.json({ results: [] });
          }
        }
        
        console.log(`[API] ✅ Successfully fetched ${data?.results?.length || 0} representatives for ZIP ${cleanZip}`);
        console.log(`[API] Sample data:`, data?.results?.slice(0, 2));
        
        return NextResponse.json(data);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (fetchError: any) {
      console.error("[API] ❌ Error fetching from WhoIsMyRepresentative API:", fetchError);
      console.error("[API] Error details:", {
        name: fetchError?.name,
        message: fetchError?.message,
        cause: fetchError?.cause,
      });
      
      // If fetch fails (network error, timeout, etc.), return empty results
      // This allows the client to use fallback data
      return NextResponse.json({ 
        results: [],
        error: fetchError.message || "Failed to fetch representatives"
      });
    }
  } catch (error: any) {
    console.error("[API] Unexpected error in representatives route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
