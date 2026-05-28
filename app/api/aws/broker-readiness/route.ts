/**
 * GET /api/aws/broker-readiness — Phase 535.
 *
 * Customer-honest platform-readiness probe. Tells the operator
 * whether the PLATFORM SIDE of AWS connect is functional before
 * they spend 10 minutes deploying CloudFormation:
 *
 *   - broker_keys_present: Vercel env vars are set
 *   - broker_caller_ok:     STS GetCallerIdentity returns 2xx
 *   - broker_account_id:    the account those keys belong to
 *
 * If any of these is false, the customer sees an "AWS connect is
 * temporarily down — try the demo while we fix it" path instead of
 * being routed through the doomed CloudFormation dance.
 */

import { NextResponse } from "next/server";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { loadAppEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const env = loadAppEnv();
  const brokerKeysPresent = !!(env.awsBrokerAccessKeyId && env.awsBrokerSecretAccessKey);
  if (!brokerKeysPresent) {
    return NextResponse.json({
      ok: true,
      ready: false,
      brokerKeysPresent: false,
      brokerCallerOk: false,
      brokerAccountId: null,
      reason: "Platform broker credentials aren't configured on the server. The platform operator needs to set AWS_BROKER_ACCESS_KEY_ID + AWS_BROKER_SECRET_ACCESS_KEY in the deployment environment.",
    });
  }

  const sts = new STSClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: env.awsBrokerAccessKeyId!,
      secretAccessKey: env.awsBrokerSecretAccessKey!,
    },
  });

  try {
    const ident = await sts.send(new GetCallerIdentityCommand({}));
    return NextResponse.json({
      ok: true,
      ready: true,
      brokerKeysPresent: true,
      brokerCallerOk: true,
      brokerAccountId: ident.Account ?? null,
      brokerArn: ident.Arn ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: true,
      ready: false,
      brokerKeysPresent: true,
      brokerCallerOk: false,
      brokerAccountId: null,
      reason: `Platform broker credentials are set but STS rejected them. Either the keys are stale or the IAM user has been disabled: ${msg.slice(0, 200)}`,
    });
  }
}
