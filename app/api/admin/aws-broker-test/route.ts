/**
 * GET /api/admin/aws-broker-test — Admin only.
 * Tests broker credentials with STS GetCallerIdentity (no assume-role).
 * Do not proceed to assume-role until broker identity works.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { testBrokerIdentity, type TestBrokerResult } from "@/lib/connectors/aws";

const LOG_PREFIX = "[admin aws-broker-test]";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const rawKey = process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID ?? "";
  const rawSecret = process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY ?? "";
  const accessKeySet = !!rawKey.trim();
  const secretKeySet = !!rawSecret.trim();
  const regionSet = (process.env.AWS_CONNECTOR_BROKER_REGION ?? "").trim() || "(default)";

  // Safe metadata about loaded env vars — exposes shape only, never the secret.
  // accessKeyPrefix shows first 4 chars (e.g. "AKIA") to confirm it's an AWS key,
  // not a quote, not whitespace, not a session token (ASIA).
  const envDebug = {
    accessKeySet,
    accessKeyLength: rawKey.length,                        // expect 20
    accessKeyPrefix: rawKey.slice(0, 4),                   // expect "AKIA"
    accessKeyHasWhitespace: /\s/.test(rawKey),
    accessKeyHasQuotes: rawKey.includes('"') || rawKey.includes("'"),
    secretSet: secretKeySet,
    secretLength: rawSecret.length,                        // expect 40
    secretHasWhitespace: /\s/.test(rawSecret),
    secretHasQuotes: rawSecret.includes('"') || rawSecret.includes("'"),
    region: regionSet,
  };
  console.log(`${LOG_PREFIX} Env shape:`, envDebug);

  let result: TestBrokerResult;
  try {
    result = await testBrokerIdentity();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const redacted = msg.replace(/\b(AKIA[A-Z0-9]{16}|[A-Za-z0-9/+=]{40})\b/g, "[REDACTED]");
    console.error(`${LOG_PREFIX} Unexpected error:`, redacted);
    return NextResponse.json({
      brokerValid: false,
      brokerAccountId: "",
      brokerArn: "",
      failureReason: `UNEXPECTED: ${redacted}`,
      envDebug,
    });
  }

  if (result.brokerValid) {
    console.log(`${LOG_PREFIX} Broker OK: accountId=${result.brokerAccountId}, arn=${result.brokerArn}`);
  } else {
    console.warn(`${LOG_PREFIX} Broker FAILED: ${result.failureReason}`);
  }

  return NextResponse.json({
    brokerValid: result.brokerValid,
    brokerAccountId: result.brokerAccountId,
    brokerArn: result.brokerArn,
    ...(result.failureReason && { failureReason: result.failureReason }),
    envDebug,
  });
}
