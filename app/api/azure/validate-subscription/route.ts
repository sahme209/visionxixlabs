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

/**
 * Robust JSON extraction. Cloud Shell prints VERBOSE: lines, MOTD
 * banners, role-assignment messages, and the JSON block all in one
 * scroll. Customers naturally select-all → copy → paste, and the
 * resulting blob isn't strictly parseable. We try strict JSON first
 * (so a clean copy still hits the fast path), then walk the text to
 * find the first balanced { ... } block and parse THAT.
 *
 * Balance is tracked with a tiny brace counter that respects string
 * literals — the JSON output never contains nested unescaped braces
 * inside strings in practice, but we honor the escape rules so a
 * customer pasting a payload with a real {} inside a value still
 * parses cleanly.
 */
function extractAzureJson(raw: string): ParsedCreds | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Fast path — strict JSON.
  try {
    const parsed = JSON.parse(trimmed) as ParsedCreds;
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* fall through to brace walker */ }

  // Slow path — find the first balanced { ... } block in arbitrary text.
  let depth = 0;
  let start = -1;
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === "\\" && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = trimmed.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate) as ParsedCreds;
          if (parsed && typeof parsed === "object") return parsed;
        } catch { /* try the next block */ }
        start = -1;
      }
    }
  }
  return null;
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

  // We accept either strict JSON or arbitrary Cloud Shell terminal
  // output that contains the JSON block. extractAzureJson walks
  // braces to find the first balanced { ... } and parses that. This
  // is the difference between "customer selects only the JSON" and
  // "customer pastes everything visible in the terminal" — both
  // should work.
  const parsed = extractAzureJson(raw);
  if (!parsed) {
    // Heuristic: if the customer pasted ONLY the az command (no JSON
    // braces at all), tell them where the JSON lives. Otherwise
    // generic malformed message.
    const looksLikeCommand = /^az\s+ad\s+sp\s+create-for-rbac/i.test(raw.trim());
    const hint = looksLikeCommand
      ? "That's the az command, not its output. Run the command in Cloud Shell first; when it finishes it prints a JSON block starting with { — copy that block (everything from { through the matching }) and paste it here."
      : raw.includes("{") && raw.includes("}")
        ? "Found braces but couldn't parse a JSON object out of them. Make sure the JSON block is complete — including the trailing } — and re-paste."
        : "No JSON block found in the pasted text. Re-run the az command in Cloud Shell and copy the JSON output it prints (the part wrapped in { and }).";
    return NextResponse.json({
      ok: false,
      error: "malformed_json",
      hint,
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
