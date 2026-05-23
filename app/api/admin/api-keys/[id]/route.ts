/**
 * DELETE /api/admin/api-keys/[id] — Phase 394.
 *
 * Revokes an API key. Idempotent: if the key is already revoked or
 * doesn't exist, returns ok:false with a specific reason instead
 * of double-recording the revoke audit.
 *
 * Gated by ADMIN_EMAILS.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { revokeApiKey } from "@/lib/security/mintApiKeyRecord";

export const dynamic = "force-dynamic";

interface RevokeBody {
  reason?: unknown;
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: RevokeBody = {};
  try { body = (await req.json()) as RevokeBody; } catch { /* empty */ }

  const reason = typeof body.reason === "string" && body.reason.trim().length > 0
    ? body.reason.trim()
    : "revoked_by_admin";

  const correlationId = `apikey_revoke_${Date.now().toString(36)}`;
  const result = await revokeApiKey({
    apiKeyId: id,
    reason,
    revokedBy: session.user.email,
    correlationId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
