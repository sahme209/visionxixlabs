/**
 * GET /api/aws/quick-deploy-url?externalId=axiom-…
 *
 * Returns the CloudFormation Quick-Create URL the onboarding page
 * should open when the customer clicks the 1-click button. The
 * template is auto-published to S3 by the platform on the first
 * request — see lib/cloud/aws/templateHosting.ts. Customer never
 * does anything. Operator never does anything either, as long as
 * AWS_CONNECTOR_BROKER_* creds are configured (which is already
 * required for the scan to work at all).
 *
 * If broker creds AREN'T configured, the endpoint returns
 * { available: false } so the UI can show a config-gap banner.
 * But the customer's path is always exactly: click button → land
 * in AWS console → click Create stack → copy RoleArn back.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isValidExternalId } from "@/lib/cloud/aws/quickDeploy";
import { ensureTemplatePublished } from "@/lib/cloud/aws/templateHosting";

export const dynamic = "force-dynamic";

// SDK can take a beat the very first time (bucket create + policy +
// upload). Give Vercel headroom so we don't 504 on first publish.
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const externalId = req.nextUrl.searchParams.get("externalId");
  if (!externalId || !isValidExternalId(externalId)) {
    return NextResponse.json({
      available: false,
      reason: "invalid_external_id",
      hint: "Pass ?externalId=axiom-… (8-32 alphanumerics after the prefix).",
    }, { status: 400 });
  }

  const publish = await ensureTemplatePublished();
  if (!publish.available) {
    return NextResponse.json({
      available: false,
      reason: publish.reason,
      hint: publish.detail,
    }, { status: 200 });
  }

  const params = new URLSearchParams({
    templateURL: publish.url,
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
    templateUrl: publish.url,
    bucket: publish.bucket,
    publishedNow: publish.publishedNow,
  }, { status: 200 });
}
