import { NextResponse } from "next/server";
import { isCloudConnectorEnabled } from "@/lib/featureFlags";

/**
 * GET /api/connectors/availability
 * Public endpoint — returns which cloud connectors are enabled.
 * No auth required. Used by onboarding to guard IAM setup instructions.
 */
export async function GET() {
  return NextResponse.json({
    aws: isCloudConnectorEnabled("aws"),
    azure: isCloudConnectorEnabled("azure"),
    gcp: isCloudConnectorEnabled("gcp"),
  });
}
