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

  let parsed: ParsedKey;
  try {
    parsed = JSON.parse(raw) as ParsedKey;
  } catch {
    return NextResponse.json({
      ok: false,
      error: "malformed_json",
      hint: "That doesn't look like valid JSON. Re-copy the entire output from Cloud Shell, including the braces.",
    }, { status: 400 });
  }

  if (parsed.type !== "service_account") {
    return NextResponse.json({
      ok: false,
      error: "wrong_key_type",
      hint: "Expected a service-account key (type: \"service_account\"). Re-run the Cloud Shell tutorial and copy the new JSON.",
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
