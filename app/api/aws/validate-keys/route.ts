/**
 * POST /api/aws/validate-keys
 *
 * Customer-supplied access key validation. No broker. No platform-side
 * AWS config. The customer creates a read-only IAM user in their own
 * AWS console, generates an access key, pastes it here. We call
 * sts:GetCallerIdentity to confirm the keys are real + read-only.
 *
 * Body:
 *   { accessKeyId, secretAccessKey, region? }   (region defaults us-east-1)
 *
 * Response:
 *   { ok: true,  accountId, arn, userId }       — keys validated
 *   { ok: false, error, hint }                  — common AWS error mapped
 *
 * Keys are NOT persisted by this route. A later /scan call sends them
 * again so the customer keeps explicit control over what we see. (The
 * eventual prisma row for live workspaces will encrypt them with a
 * customer-rotatable KEK.)
 */

import { NextResponse, type NextRequest } from "next/server";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export const dynamic = "force-dynamic";

interface ValidateBody {
  accessKeyId?: unknown;
  secretAccessKey?: unknown;
  region?: unknown;
}

function looksLikeAccessKeyId(s: string): boolean {
  // AKIA / ASIA / AGPA / AIDA / AROA — AWS key prefixes. 20 chars total.
  return /^(AKIA|ASIA|AGPA|AIDA|AROA)[A-Z0-9]{16}$/.test(s);
}

export async function POST(req: NextRequest) {
  let body: ValidateBody = {};
  try { body = (await req.json()) as ValidateBody; } catch { /* empty body */ }
  const accessKeyId = typeof body.accessKeyId === "string" ? body.accessKeyId.trim() : "";
  const secretAccessKey = typeof body.secretAccessKey === "string" ? body.secretAccessKey.trim() : "";
  const region = typeof body.region === "string" && body.region.length > 0
    ? body.region.trim()
    : "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    return NextResponse.json({
      ok: false,
      error: "missing_credentials",
      hint: "Paste both the Access Key ID and the Secret Access Key generated in the AWS console.",
    }, { status: 400 });
  }

  if (!looksLikeAccessKeyId(accessKeyId)) {
    return NextResponse.json({
      ok: false,
      error: "malformed_access_key_id",
      hint: "Access Key ID should look like AKIA…/ASIA…/AGPA…/AIDA…/AROA… (20 chars uppercase + digits).",
    }, { status: 400 });
  }
  if (secretAccessKey.length < 30) {
    return NextResponse.json({
      ok: false,
      error: "malformed_secret",
      hint: "Secret Access Key looks too short — it's normally 40 characters. Re-paste it (no surrounding whitespace).",
    }, { status: 400 });
  }

  const sts = new STSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  try {
    const ident = await sts.send(new GetCallerIdentityCommand({}));
    return NextResponse.json({
      ok: true,
      accountId: ident.Account ?? null,
      arn:       ident.Arn ?? null,
      userId:    ident.UserId ?? null,
      region,
    });
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err ? String((err as { name?: string }).name) : "Unknown";
    const message = err instanceof Error ? err.message : String(err);
    // Map every AWS error code to a clear hint the customer can act on.
    if (name === "InvalidClientTokenId") {
      return NextResponse.json({
        ok: false,
        error: "invalid_access_key",
        hint: "AWS rejected the Access Key ID. Re-create the access key in the IAM console and paste the new pair here.",
      }, { status: 401 });
    }
    if (name === "SignatureDoesNotMatch") {
      return NextResponse.json({
        ok: false,
        error: "invalid_secret",
        hint: "The Secret Access Key doesn't match the Access Key ID. AWS only shows the secret once at creation — if you lost it, generate a new key pair.",
      }, { status: 401 });
    }
    if (name === "AccessDenied" || name === "UnauthorizedOperation") {
      return NextResponse.json({
        ok: false,
        error: "access_denied",
        hint: "Keys authenticated, but the IAM user has no sts:GetCallerIdentity permission. Attach the AWS-managed ReadOnlyAccess policy and retry.",
      }, { status: 403 });
    }
    return NextResponse.json({
      ok: false,
      error: "validation_failed",
      hint: `AWS rejected the credentials: ${message.slice(0, 200)}`,
    }, { status: 400 });
  }
}
