/**
 * GET /api/azure/quick-deploy-url
 *
 * Returns the Azure Portal "Deploy to Azure" deep-link that opens the
 * ARM deployment blade with our reader-role template prefilled. The
 * customer clicks Review + Create in Azure portal and a role
 * assignment binding the platform service principal to the chosen
 * subscription with the built-in Reader role is created.
 *
 * Customer never sees JSON. They click → portal opens → click Create.
 *
 * Required env: AZURE_AXIOM_PRINCIPAL_OBJECT_ID — the Object ID of the
 * platform's Azure AD service principal. Without it the role assignment
 * has nothing to bind, so the endpoint returns available:false with a
 * customer-honest hint (no env-var name leakage).
 */

import { NextResponse, type NextRequest } from "next/server";
import { buildAzureDeployUrl } from "@/lib/cloud/azure/quickDeploy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const principalObjectId = process.env.AZURE_AXIOM_PRINCIPAL_OBJECT_ID?.trim();
  if (!principalObjectId) {
    return NextResponse.json({
      available: false,
      reason: "service_principal_unavailable",
      hint: "The platform isn't ready to connect Azure subscriptions yet. Try again in a few minutes — or contact support if this persists.",
    }, { status: 200 });
  }

  // Derive the origin from the request so the template URL points at
  // this deployment (works on localhost, preview, and prod).
  const origin = req.nextUrl.origin;
  const url = buildAzureDeployUrl({ origin, principalObjectId });

  return NextResponse.json({
    available: true,
    url,
    principalObjectId,
  }, { status: 200 });
}
