/**
 * POST /api/azure/validate-subscription
 *
 * Parses the JSON blob the customer pastes back from Azure Cloud Shell
 * (output of `az ad sp create-for-rbac --sdk-auth`). Confirms the
 * shape (tenantId, subscriptionId, clientId, clientSecret) and echoes
 * the identifiers back so the onboarding flow can advance to scan.
 *
 * Body:  { credentialsJson }   (string — raw JSON pasted by customer)
 * Reply: { ok: true, tenantId, subscriptionId, clientId }
 *      | { ok: false, error, hint }
 *
 * The client secret is never returned. We persist it server-side
 * (encrypted) during the /api/connectors/link step.
 */

import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface Body {
  credentialsJson?: unknown;
}

interface ParsedCreds {
  tenantId?: string;
  tenant?: string;
  subscriptionId?: string;
  subscription?: string;
  clientId?: string;
  appId?: string;
  clientSecret?: string;
  password?: string;
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* empty body */ }
  const raw = typeof body.credentialsJson === "string" ? body.credentialsJson.trim() : "";

  if (!raw) {
    return NextResponse.json({
      ok: false,
      error: "missing_credentials",
      hint: "Paste the entire JSON output from the az command — including the opening { and closing }.",
    }, { status: 400 });
  }

  let parsed: ParsedCreds;
  try {
    parsed = JSON.parse(raw) as ParsedCreds;
  } catch {
    return NextResponse.json({
      ok: false,
      error: "malformed_json",
      hint: "That doesn't look like valid JSON. Re-copy the entire output from Cloud Shell, including the braces.",
    }, { status: 400 });
  }

  // Accept both --sdk-auth output (tenantId/subscriptionId/clientId/clientSecret)
  // and the default output (tenant/appId/password).
  const tenantId       = (parsed.tenantId       ?? parsed.tenant   ?? "").trim();
  const subscriptionId = (parsed.subscriptionId ?? parsed.subscription ?? "").trim();
  const clientId       = (parsed.clientId       ?? parsed.appId    ?? "").trim();
  const clientSecret   = (parsed.clientSecret   ?? parsed.password ?? "").trim();

  if (!tenantId || !GUID.test(tenantId)) {
    return NextResponse.json({
      ok: false,
      error: "malformed_tenant_id",
      hint: "Tenant ID is missing or malformed. Re-run the az command and paste the full JSON.",
    }, { status: 400 });
  }
  if (!subscriptionId || !GUID.test(subscriptionId)) {
    return NextResponse.json({
      ok: false,
      error: "malformed_subscription_id",
      hint: "Subscription ID is missing or malformed. Re-run the az command with the correct --scopes /subscriptions/<id>.",
    }, { status: 400 });
  }
  if (!clientId || !GUID.test(clientId)) {
    return NextResponse.json({
      ok: false,
      error: "malformed_client_id",
      hint: "Client/app ID is missing. Re-run the az command and paste the full output.",
    }, { status: 400 });
  }
  if (!clientSecret) {
    return NextResponse.json({
      ok: false,
      error: "missing_client_secret",
      hint: "Client secret/password is missing. The az command should print it once — re-run if you lost it.",
    }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    tenantId,
    subscriptionId,
    clientId,
  }, { status: 200 });
}
