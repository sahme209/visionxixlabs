/**
 * POST /api/gcp/validate-key
 *
 * Parses the customer-pasted service-account JSON key, then performs
 * a REAL provider-side validation:
 *
 *   1. Authenticates with the service account credentials
 *   2. Calls projects.get() via @google-cloud/resource-manager
 *
 * Only returns ok:true if the GCP call succeeds. Never marks a
 * connection valid on JSON shape alone.
 *
 * Body:  { serviceAccountJson, projectId? }
 *        (projectId optional — falls back to project_id in the JSON)
 * Reply: { ok: true, projectId, clientEmail, projectName }
 *      | { ok: false, error, hint }
 */

import { NextResponse, type NextRequest } from "next/server";
import { validateGCPConnection } from "@/lib/connectors/gcp";
import { logAudit } from "@/lib/security/auditLog";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Body {
  serviceAccountJson?: unknown;
  projectId?: unknown;
}

interface ParsedKey {
  type?: string;
  project_id?: string;
  client_email?: string;
  private_key_id?: string;
  private_key?: string;
}

/**
 * Robust JSON extraction. Cloud Shell mixes the gcloud key output
 * with `Created key [...]` log lines, prompts, and shell echoes.
 * Customers naturally select-all → copy → paste, and the resulting
 * blob isn't strictly parseable. We try strict JSON first; if that
 * fails we walk the text for the first balanced { ... } block.
 *
 * String-aware so a real { inside a JSON value never confuses the
 * counter. Same shape as the Azure validator's extractor.
 */
function extractGcpKey(raw: string): ParsedKey | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as ParsedKey;
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* fall through to walker */ }

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
          const parsed = JSON.parse(candidate) as ParsedKey;
          // Service-account keys always carry "type":"service_account".
          // If the first balanced block is some other JSON object, keep
          // walking — the right one comes later in the stream.
          if (parsed && typeof parsed === "object") return parsed;
        } catch { /* keep walking */ }
        start = -1;
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* empty body */ }
  const raw = typeof body.serviceAccountJson === "string" ? body.serviceAccountJson.trim() : "";
  const requestedProjectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!raw) {
    return NextResponse.json({
      ok: false,
      error: "missing_key",
      hint: "Paste the entire JSON key — including the opening { and closing }.",
    }, { status: 400 });
  }

  const parsed = extractGcpKey(raw);
  if (!parsed) {
    const looksLikeCommand = /gcloud\s+iam\s+service-accounts\s+create/i.test(raw.trim());
    const hint = looksLikeCommand
      ? "That's the gcloud command, not its output. Paste the command into Cloud Shell to run it; it prints a JSON key — copy that key (everything from { through the matching }) and paste here."
      : raw.includes("{") && raw.includes("}")
        ? "Found braces but couldn't parse a JSON object out of them. Make sure the closing } is included and the JSON isn't truncated."
        : "No JSON key found in the pasted text. Run the gcloud command in Cloud Shell — it prints the JSON key on stdout.";
    return NextResponse.json({
      ok: false,
      error: "malformed_json",
      hint,
    }, { status: 400 });
  }

  if (parsed.type !== "service_account") {
    return NextResponse.json({
      ok: false,
      error: "wrong_key_type",
      hint: "Expected a service-account key (type: \"service_account\"). Re-run the gcloud setup command in Cloud Shell and paste the new JSON.",
    }, { status: 400 });
  }

  const projectId   = requestedProjectId || (typeof parsed.project_id === "string" ? parsed.project_id.trim() : "");
  const clientEmail = typeof parsed.client_email === "string" ? parsed.client_email.trim() : "";

  if (!projectId) {
    return NextResponse.json({
      ok: false,
      error: "missing_project_id",
      hint: "Service-account JSON has no project_id field. Re-run the Cloud Shell tutorial.",
    }, { status: 400 });
  }
  if (!clientEmail) {
    return NextResponse.json({
      ok: false,
      error: "missing_client_email",
      hint: "Service-account JSON has no client_email field.",
    }, { status: 400 });
  }

  // Real provider-side validation — authenticate and fetch project metadata.
  const result = await validateGCPConnection({
    projectId,
    serviceAccountJson: raw,
  });

  if (!result.valid) {
    await logAudit({
      action: "gcp.validation_failed",
      actor: "system",
      metadata: { errorCode: result.errorCode, projectId, clientEmail },
    });
    const hint =
      result.errorCode === "PROJECT_NOT_FOUND"
        ? "GCP authenticated the service account but couldn't find this project. Verify the project_id and that the account has Viewer access."
        : result.errorCode === "FEATURE_DISABLED"
        ? "GCP connections are temporarily disabled. Contact support if this persists."
        : "GCP rejected the service-account key. Re-run the Cloud Shell tutorial and paste the fresh JSON.";
    return NextResponse.json({
      ok: false,
      error: result.errorCode ?? "validation_failed",
      hint,
    }, { status: 400 });
  }

  await logAudit({
    action: "gcp.validation_succeeded",
    actor: "system",
    metadata: {
      projectId: result.projectId ?? projectId,
      clientEmail: result.serviceAccountEmail ?? clientEmail,
      projectName: result.projectName,
    },
  });

  return NextResponse.json({
    ok: true,
    projectId: result.projectId ?? projectId,
    clientEmail: result.serviceAccountEmail ?? clientEmail,
    projectName: result.projectName,
  }, { status: 200 });
}
