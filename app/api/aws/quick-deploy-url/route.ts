/**
 * GET /api/aws/quick-deploy-url?externalId=axiom-…
 *
 * Returns the CloudFormation Quick-Create URL the onboarding page
 * should open when the customer clicks the 1-click button — but ONLY
 * when the platform operator has set AWS_CFN_TEMPLATE_S3_URL to a
 * supported S3 URL. Otherwise returns { available: false } so the
 * onboarding UI can hide the button and promote the manual fallback.
 *
 * Why this is server-side instead of a hardcoded client URL:
 *   AWS console's Quick-Create deep-link rejects non-S3 templateURLs
 *   ("TemplateURL must be a supported URL"). The S3 URL is platform-
 *   operator config, not customer-facing. Surfacing it through this
 *   tiny endpoint keeps the UI honest about availability.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { isValidExternalId } from "@/lib/cloud/aws/quickDeploy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const env = loadAppEnv();
  const externalId = req.nextUrl.searchParams.get("externalId");

  if (!env.awsCfnTemplateS3Url) {
    return NextResponse.json({
      available: false,
      reason: "cfn_template_not_hosted",
      hint:
        "The 1-click button is disabled because AWS_CFN_TEMPLATE_S3_URL is not set on this deployment. " +
        "Upload public/aws/axiom-agent-quick-deploy.yaml to a public S3 bucket and set the env var. " +
        "See scripts/upload-cfn-template.sh for the helper.",
    }, { status: 200 });
  }

  if (!externalId || !isValidExternalId(externalId)) {
    return NextResponse.json({
      available: false,
      reason: "invalid_external_id",
      hint: "Pass ?externalId=axiom-… (8-32 alphanumerics after the prefix).",
    }, { status: 400 });
  }

  const params = new URLSearchParams({
    templateURL: env.awsCfnTemplateS3Url,
    stackName: "axiom-agent",
    param_ExternalId: externalId,
  });
  const region = "us-east-1";
  const url =
    `https://${region}.console.aws.amazon.com/cloudformation/home?region=${region}` +
    `#/stacks/quickcreate?${params.toString()}`;

  return NextResponse.json({
    available: true,
    url,
    templateUrl: env.awsCfnTemplateS3Url,
  }, { status: 200 });
}
