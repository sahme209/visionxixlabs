/**
 * Representatives Service
 * Fetches real senators and representatives based on ZIP code
 * Uses WhoIsMyRepresentative.com API (free, no API key required)
 */

export interface Representative {
  id: string;
  name: string;
  chamber: "Senate" | "House";
  state: string;
  district?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface WhoIsMyRepResponse {
  results: Array<{
    name: string;
    party: string;
    state: string;
    district?: string;
    phone?: string;
    office?: string;
    link?: string;
  }>;
}

/**
 * Fetch representatives from WhoIsMyRepresentative.com API
 * Free API, no key required
 * Uses server-side proxy to avoid CORS issues
 */
export async function fetchRepresentativesFromAPI(zipCode: string): Promise<Representative[]> {
  try {
    // Clean ZIP code (5 digits only)
    const cleanZip = zipCode.trim().replace(/\D/g, "").substring(0, 5);
    
    if (cleanZip.length < 5) {
      throw new Error("ZIP code must be 5 digits");
    }

    console.log(`[RepresentativesService] Fetching representatives for ZIP: ${cleanZip}`);

    // Use our API route as proxy to avoid CORS issues
    const response = await fetch(`/api/representatives?zip=${cleanZip}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RepresentativesService] API error ${response.status}:`, errorText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Handle different response formats
    const results = data.results || data || [];
    
    if (!Array.isArray(results) || results.length === 0) {
      console.warn(`[RepresentativesService] No results found for ZIP ${cleanZip}`);
      return [];
    }

    // Convert API response to our Representative format
    const representatives: Representative[] = [];
    const senators: Representative[] = [];
    const houseMembers: Representative[] = [];

    for (const item of results) {
      // Handle different API response formats
      const name = item.name || item.Name || "";
      const state = item.state || item.State || "";
      const district = item.district || item.District || undefined;
      const phone = item.phone || item.Phone || item.office || item.Office || undefined;
      const website = item.link || item.Link || item.website || item.Website || undefined;
      
      // Determine chamber based on presence of district or office title
      const officeName = item.office || item.Office || "";
      const isSenator = !district && (officeName.toLowerCase().includes("senate") || officeName === "" || !officeName);
      const chamber: "Senate" | "House" = isSenator ? "Senate" : "House";
      
      // Generate ID
      const id = chamber === "Senate" 
        ? `sen-${state}-${senators.length + 1}`
        : `rep-${state}-${district || "unknown"}`;

      const rep: Representative = {
        id,
        name: name.trim(),
        chamber,
        state: state.trim(),
        district: district?.trim(),
        phone: phone?.trim(),
        website: website?.trim(),
      };

      if (chamber === "Senate") {
        senators.push(rep);
      } else {
        houseMembers.push(rep);
      }
    }

    // Combine: Senators first, then Representatives
    const allReps = [...senators, ...houseMembers];

    console.log(`[RepresentativesService] Successfully fetched ${allReps.length} representatives for ZIP ${cleanZip}`, allReps);
    return allReps;
  } catch (error) {
    console.error("[RepresentativesService] Error fetching representatives:", error);
    throw error;
  }
}

/**
 * Get representatives with fallback to local data
 * Tries API first, falls back to local ZIP prefix matching
 * NOTE: ZIP codes are always US-based, so we treat any 5-digit ZIP as US regardless of country parameter
 */
export async function getRepresentatives(
  zipCode: string, 
  country: string,
  fallbackFunction: (zipCode: string, country: string) => Representative[]
): Promise<Representative[]> {
  const cleanZip = zipCode.trim().replace(/\D/g, "");
  
  // ZIP codes are US-specific, so any valid 5-digit ZIP is treated as US
  if (cleanZip.length < 5) {
    console.log(`[RepresentativesService] ZIP code too short: ${cleanZip.length} digits`);
    return [];
  }

  console.log(`[RepresentativesService] Fetching representatives for ZIP: ${cleanZip} (treating as US ZIP)`);

  try {
    // Try API first - always treat as US ZIP
    const apiReps = await fetchRepresentativesFromAPI(cleanZip);
    if (apiReps.length > 0) {
      console.log(`[RepresentativesService] ✅ Got ${apiReps.length} representatives from API`);
      return apiReps;
    } else {
      console.warn(`[RepresentativesService] API returned empty results, using fallback`);
    }
  } catch (error) {
    console.warn("[RepresentativesService] API failed, using fallback:", error);
  }

  // Fallback to local ZIP prefix matching (always use "United States" for ZIP codes)
  const fallbackReps = fallbackFunction(zipCode, "United States");
  console.log(`[RepresentativesService] Using fallback: ${fallbackReps.length} representatives`);
  return fallbackReps;
}
