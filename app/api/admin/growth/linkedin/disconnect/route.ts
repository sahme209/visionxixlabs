/**
 * POST /api/admin/growth/linkedin/disconnect
 *
 * Marks the current admin's LinkedInAccountConnection row as revoked
 * and zeroes out the access token. NOTE: this does not revoke the token
 * server-side at LinkedIn — operators should also revoke the app from
 * their LinkedIn settings if they want full revocation.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { writeGrowthAudit } from "@/lib/growth/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const email = gate.user.email ?? "admin";

  const existing = await prisma.linkedInAccountConnection.findUnique({ where: { ownerEmail: email } });
  if (!existing) {
    return NextResponse.json({ ok: true, alreadyDisconnected: true });
  }

  await prisma.linkedInAccountConnection.update({
    where: { ownerEmail: email },
    data:  { status: "revoked", accessToken: "", refreshToken: null, lastError: null },
  });

  await writeGrowthAudit({
    actor: email,
    action: "linkedin.disconnected",
    targetKind: "linkedin_connection",
    targetId: existing.id,
  });

  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    return NextResponse.redirect(new URL("/admin/growth/linkedin", req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true });
}
