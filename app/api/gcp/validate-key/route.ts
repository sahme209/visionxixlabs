/**
 * POST /api/gcp/validate-key
 *
 * Lightweight onboarding-side check for a customer-pasted GCP service
 * account JSON key. Confirms the shape (project_id, client_email,
 * private_key_id, type=service_account) and echoes the project id back
 * so the onboarding flow can advance to scan.
 *
 * Body:  { serviceAccountJson }   (string — raw JSON pasted by customer)
 * Reply: { ok: true, projectId, clientEmail }
 *      | { ok: false, error, hint }
 *
 * No live GCP API calls — that lands in /api/gcp/validate (auth'd) when
 * the scan endpoint actually uses the key. We only need a shape check
 * here to let the flow advance honestly.
 */

import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface Body {
  serviceAccountJson?: unknown;
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

  const projectId    = typeof parsed.project_id    === "string" ? parsed.project_id.trim()    : "";
  const clientEmail  = typeof parsed.client_email  === "string" ? parsed.client_email.trim()  : "";
  const privateKeyId = typeof parsed.private_key_id === "string" ? parsed.private_key_id.trim() : "";
  const privateKey   = typeof parsed.private_key   === "string" ? parsed.private_key.trim()   : "";

  if (!projectId || !clientEmail || !privateKeyId || !privateKey) {
    return NextResponse.json({
      ok: false,
      error: "incomplete_key",
      hint: "The JSON is missing one of project_id, client_email, private_key_id, private_key. Generate a fresh key in Cloud Shell.",
    }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    projectId,
    clientEmail,
  }, { status: 200 });
}
