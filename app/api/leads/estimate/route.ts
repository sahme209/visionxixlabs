import { NextRequest, NextResponse } from "next/server";
import { leadEstimatePayloadSchema } from "@/lib/leads/leadSchema";
import { estimatePricing } from "@/lib/leads/pricingEstimate";
import type { LeadFormData } from "@/lib/leads/leadSchema";

/**
 * POST /api/leads/estimate
 * Returns pricing estimate for given (possibly partial) form payload. Does not create a lead or send emails.
 * Used by /request page for live pricing preview. Accepts partial data with defaults.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = leadEstimatePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const payload = parsed.data as LeadFormData;
  if (!payload.projectGoals?.length) {
    payload.projectGoals = ["informational"];
  }
  const estimate = estimatePricing(payload);
  return NextResponse.json({
    min: estimate.min,
    max: estimate.max,
    breakdown: estimate.breakdown,
  });
}
