import { NextResponse } from "next/server";
import {
  COUNTRY_ADVISORIES,
  US_AIRPORTS,
  INTERNATIONAL_AIRPORTS,
  type AdvisoryLevel,
  type CountryAdvisory,
  type AirportInfo,
} from "@/lib/data/travelSafetyData";

/** POST body for date-sensitive travel safety score */
interface ScoreRequest {
  departureAirport: string;
  destinationAirport: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  formType?: string;
  processingPath?: "Consular" | "AOS";
  destinationCountry?: string;
}

function getAdvisoryForCountry(country: string): CountryAdvisory | undefined {
  const normalized = country.trim().toLowerCase();
  return COUNTRY_ADVISORIES.find((c) => c.name.toLowerCase() === normalized);
}

function computeVisaRisk(formType: string, processingPath?: string): { score: number; label: string; details: string } {
  const t = (formType || "Other").trim();
  const tu = t.toUpperCase();

  // US Citizen — safest
  if (t === "US Citizen" || tu === "US CITIZEN" || tu === "USC") {
    return { score: 100, label: "Full freedom to travel", details: "U.S. citizens can travel and return freely. No visa or re-entry concerns." };
  }
  // Green Card (LPR)
  if (t === "Green Card" || tu === "GREEN CARD" || tu === "N-400" || tu === "LPR") {
    return { score: 90, label: "Generally safe with green card", details: "As an LPR you can travel but must return within required timeframes." };
  }
  // Work visas
  if (t === "H-1B" || tu === "H1B" || t === "L-1" || tu === "L1") {
    return { score: 85, label: "Generally safe with valid visa", details: "Keep valid visa and employment documents. Travel during approved dates." };
  }
  // Student
  if (t === "F-1" || tu === "F1") {
    return { score: 75, label: "Check I-20 and travel signature", details: "Ensure valid F-1 status, I-20 with travel signature, and SEVIS compliance." };
  }
  // Tourist / B
  if (t === "B-1/B-2" || tu === "B1B2" || tu === "B-1" || tu === "B-2") {
    return { score: 70, label: "Verify stay duration", details: "B visa holders must not overstay. Confirm I-94 and return date." };
  }
  // Pending applications
  if (t === "I-485 (pending)" || tu === "I-485" || (t === "I-130 (pending)" && processingPath === "AOS")) {
    return { score: 30, label: "High risk — need Advance Parole", details: "If you leave the U.S. without Advance Parole while your I-485 is pending, your application may be considered abandoned." };
  }
  if (t === "I-130 (pending)" || tu === "I-130" || tu === "I-129F") {
    return { score: 85, label: "Generally safe for consular processing", details: "You can travel and return for your visa interview. Keep I-94 and valid status documents." };
  }

  return { score: 60, label: "Check your status", details: "Verify your current immigration status before traveling." };
}

function computeCountryRisk(level: AdvisoryLevel): { score: number; label: string } {
  const map: Record<AdvisoryLevel, { score: number; label: string }> = {
    1: { score: 95, label: "Low risk" },
    2: { score: 70, label: "Moderate risk" },
    3: { score: 40, label: "Elevated risk" },
    4: { score: 10, label: "Do not travel" },
  };
  return map[level];
}

function computeAirportRisk(us: AirportInfo, intl: AirportInfo): { score: number; label: string } {
  const usOk = us.tier === "major" ? 95 : us.tier === "regional" ? 85 : 75;
  const intlOk = intl.tier === "major" ? 95 : intl.tier === "regional" ? 80 : 70;
  const avg = (usOk + intlOk) / 2;
  return { score: Math.round(avg), label: avg >= 90 ? "Major hubs — low transit risk" : avg >= 80 ? "Moderate transit risk" : "Consider direct flights" };
}

/** Date-sensitive risk factors: policy changes, geopolitical, seasonal, USCIS trends */
function computeDateSensitiveModifier(startDate: string, endDate: string, baseScore: number): {
  modifier: number;
  trend: "increasing" | "decreasing" | "stable";
  factors: string[];
} {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const daysUntilStart = Math.floor((start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const tripLength = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

  let modifier = 0;
  const factors: string[] = [];

  // Seasonal: holiday periods slightly higher risk (policy/processing changes often cluster)
  const month = start.getMonth();
  if (month === 11 || month === 0) {
    modifier -= 3;
    factors.push("Holiday season — higher scrutiny at borders");
  }
  if (month >= 5 && month <= 8) {
    modifier -= 2;
    factors.push("Peak travel season — more crowded processing");
  }

  // Trip length: longer trips carry more re-entry uncertainty
  if (tripLength > 14) {
    modifier -= 2;
    factors.push("Extended trip — verify re-entry eligibility");
  }

  // Advance planning: more lead time = slightly better certainty
  if (daysUntilStart > 60) {
    modifier += 2;
    factors.push("Advance planning — time to verify documents");
  }
  if (daysUntilStart < 14 && daysUntilStart >= 0) {
    modifier -= 2;
    factors.push("Short notice — confirm document validity");
  }

  // Day-of-week: midweek often smoother
  const startDay = start.getDay();
  if (startDay >= 1 && startDay <= 5) {
    modifier += 1;
    factors.push("Midweek departure — typically smoother processing");
  }

  // Trend: increasing/decreasing based on date range
  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (modifier < -3) trend = "increasing";
  else if (modifier > 2) trend = "decreasing";
  if (factors.length === 0) factors.push("No date-specific risk factors identified");

  return { modifier: Math.max(-10, Math.min(10, modifier)), trend, factors };
}

export async function POST(request: Request) {
  try {
    const body: ScoreRequest = await request.json();
    const {
      departureAirport,
      destinationAirport,
      startDate,
      endDate,
      formType = "",
      processingPath = "Consular",
      destinationCountry,
    } = body;

    if (!departureAirport || !destinationAirport || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields: departureAirport, destinationAirport, startDate, endDate" },
        { status: 400 }
      );
    }

    const usAirportInfo = US_AIRPORTS.find((a) => a.code === departureAirport);
    const intlAirportInfo = INTERNATIONAL_AIRPORTS.find((a) => a.code === destinationAirport);

    if (!usAirportInfo || !intlAirportInfo) {
      return NextResponse.json({ error: "Invalid airport code" }, { status: 400 });
    }

    const country = destinationCountry || intlAirportInfo.country;
    const destAdvisory = getAdvisoryForCountry(country);

    const visaRisk = computeVisaRisk(formType, formType === "I-130 (pending)" ? processingPath : undefined);
    const countryRisk = destAdvisory ? computeCountryRisk(destAdvisory.level) : { score: 70, label: "Unknown — verify advisories" };
    const airportRisk = computeAirportRisk(usAirportInfo, intlAirportInfo);

    const baseScore = Math.round(visaRisk.score * 0.4 + countryRisk.score * 0.4 + airportRisk.score * 0.2);
    const { modifier, trend, factors } = computeDateSensitiveModifier(startDate, endDate, baseScore);
    const finalScore = Math.max(0, Math.min(100, baseScore + modifier));

    return NextResponse.json({
      score: finalScore,
      baseScore,
      modifier,
      trend,
      factors,
      breakdown: {
        visa: { score: visaRisk.score, label: visaRisk.label, details: visaRisk.details },
        country: { score: countryRisk.score, label: countryRisk.label },
        airport: { score: airportRisk.score, label: airportRisk.label },
      },
      label: finalScore >= 80 ? "Safe to travel" : finalScore >= 60 ? "Travel with caution" : finalScore >= 40 ? "Reconsider travel" : "Not recommended",
    });
  } catch (e) {
    console.error("[TravelSafetyScore] Error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
