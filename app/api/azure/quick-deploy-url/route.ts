/**
 * GET /api/azure/quick-deploy-url
 *
 * Returns the Azure Cloud Shell deep-link. The connect component opens
 * this URL in a new tab; the customer pastes one az CLI command in
 * Cloud Shell, runs it, and copies the resulting JSON back into our
 * form.
 *
 * No platform-side ENV is required — the customer creates their own
 * service principal in their own tenant. This mirrors the GCP flow.
 */

import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    available: true,
    url: "https://shell.azure.com/",
  }, { status: 200 });
}
