/**
 * POST /api/azure/validate-subscription
 *
 * Parses the JSON blob the customer pastes back from Azure Cloud Shell
 * (output of `az ad sp create-for-rbac --sdk-auth`) and then performs
 * a REAL provider-side validation:
 *
 *   1. Acquires a management token via @azure/identity ClientSecretCredential
 *   2. Calls ARM REST /subscriptions/{id} to confirm the SP has access
 *
 * Only returns ok:true if the real Azure call succeeds. Never marks a
 * connection valid based on JSON shape alone.
 *
 * Body:  { credentialsJson }   (string — raw JSON pasted by customer)
 * Reply: { ok: true, tenantId, subscriptionId, clientId, subscriptionName }
 *      | { ok: false, error, hint }
 *
 * The client secret is never returned. Persisted server-side (encrypted)
 * during the /api/connectors/link step that runs next.
 */

import { NextResponse, type NextRequest } from "next/server";
import { validateAzureConnection } from "@/lib/connectors/azure";
import { logAudit } from "@/lib/security/auditLog";

export const dynamic = "force-dynamic";
// Real token acquisition + ARM call can take a few seconds.
export const maxDuration = 30;

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

  // Accept both --sdk-auth output and the default az output keys.
  const tenantId       = (parsed.tenantId       ?? parsed.tenant       ?? "").trim();
  const subscriptionId = (parsed.subscriptionId ?? parsed.subscription ?? "").trim();
  const clientId       = (parsed.clientId       ?? parsed.appId        ?? "").trim();
  const clientSecret   = (parsed.clientSecret   ?? parsed.password     ?? "").trim();

  if (!tenantId || !GUID.test(tenantId)) {
    return NextResponse.json({
      ok: false, error: "malformed_tenant_id",
      hint: "Tenant ID is missing or malformed. Re-run the az command and paste the full JSON.",
    }, { status: 400 });
  }
  if (!subscriptionId || !GUID.test(subscriptionId)) {
    return NextResponse.json({
      ok: false, error: "malformed_subscription_id",
      hint: "Subscription ID is missing or malformed.",
    }, { status: 400 });
  }
  if (!clientId || !GUID.test(clientId)) {
    return NextResponse.json({
      ok: false, error: "malformed_client_id",
      hint: "Client/app ID is missing.",
    }, { status: 400 });
  }
  if (!clientSecret) {
    return NextResponse.json({
      ok: false, error: "missing_client_secret",
      hint: "Client secret is missing. The az command should print it once — re-run if you lost it.",
    }, { status: 400 });
  }

  // Real provider-side validation — actually acquire a token and hit ARM.
  const result = await validateAzureConnection({
    tenantId, clientId, clientSecret, subscriptionId,
  });

  if (!result.valid) {
    await logAudit({
      action: "azure.validation_failed",
      actor: "system",
      metadata: { errorCode: result.errorCode, subscriptionId, tenantId, clientId },
    });
    const hint =
      result.errorCode === "TOKEN_ACQUISITION_FAILED"
        ? "Azure rejected the service principal credentials. Re-run the az command and paste the fresh JSON."
        : result.errorCode === "SUBSCRIPTION_ACCESS_DENIED"
        ? "The service principal authenticated but doesn't have Reader access to this subscription. Verify the --scopes /subscriptions/<id> matches the subscription you intend to connect."
        : result.errorCode === "FEATURE_DISABLED"
        ? "Azure connections are temporarily disabled. Contact support if this persists."
        : "Azure didn't accept the credentials. Re-run the az command and paste the fresh JSON.";
    return NextResponse.json({
      ok: false,
      error: result.errorCode ?? "validation_failed",
      hint,
    }, { status: 400 });
  }

  await logAudit({
    action: "azure.validation_succeeded",
    actor: "system",
    metadata: {
      subscriptionId: result.subscriptionId ?? subscriptionId,
      tenantId,
      clientId,
      subscriptionName: result.subscriptionName,
    },
  });

  return NextResponse.json({
    ok: true,
    tenantId,
    subscriptionId: result.subscriptionId ?? subscriptionId,
    clientId,
    subscriptionName: result.subscriptionName,
  }, { status: 200 });
}
