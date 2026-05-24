/**
 * GET /api/gcp/quick-deploy-url
 *
 * Returns the GCP Cloud Shell deep-link that opens the customer's
 * Cloud Shell with the Axiom Agent tutorial pre-cloned. The tutorial
 * walks them through creating a read-only service account and emits
 * a JSON key they paste back.
 */

import { NextResponse, type NextRequest } from "next/server";
import { buildGcpCloudShellUrl } from "@/lib/cloud/gcp/quickDeploy";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const tutorialRepoUrl = process.env.GCP_TUTORIAL_REPO_URL?.trim() || undefined;
  const tutorialPath    = process.env.GCP_TUTORIAL_PATH?.trim()     || undefined;
  const url = buildGcpCloudShellUrl({ tutorialRepoUrl, tutorialPath });
  return NextResponse.json({ available: true, url }, { status: 200 });
}
