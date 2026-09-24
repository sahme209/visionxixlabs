/**
 * POST /api/team/invite — Phase 639.
 *
 * Mints a signed invite token for a new workspace member. Caller
 * must be owner or admin in this workspace.
 *
 * Returns 303 → /dashboard/team?notice=invite_sent&inviteUrl=... so
 * the operator can copy the URL and send it to the invitee.
 *
 * The actual acceptance happens at /accept-invite/[token] which
 * creates the OrgMembership row after the invitee signs in.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  createInviteToken,
  ASSIGNABLE_ROLES,
  type InviteRole,
} from "@/lib/workforce/domains/inviteLinks";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

function parseRole(raw: string): InviteRole | null {
  if (ASSIGNABLE_ROLES.includes(raw as InviteRole)) return raw as InviteRole;
  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const email = s(f.get("email")).trim().toLowerCase();
  const role = parseRole(s(f.get("role")));
  const correlationId = `team_invite_${Date.now().toString(36)}` as CorrelationId;

  if (!isValidEmail(email)) {
    return NextResponse.redirect(new URL("/dashboard/team?error=invalid_email", req.url), 303);
  }
  if (!role) {
    return NextResponse.redirect(new URL("/dashboard/team?error=invalid_role", req.url), 303);
  }

  // Permission check: caller must be owner or admin in this workspace.
  let canInvite = false;
  try {
    if (ctx.userId) {
      const me = await prisma.orgMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: String(ctx.userId),
            organizationId: org,
          },
        },
        select: { role: true },
      });
      canInvite = me?.role === "owner" || me?.role === "admin";
    }
  } catch {
    canInvite = false;
  }
  if (!canInvite) {
    return NextResponse.redirect(new URL("/dashboard/team?error=insufficient_permission", req.url), 303);
  }

  let token: string;
  try {
    token = createInviteToken(org, email, role, String(ctx.userId ?? "system"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg === "invite_link_secret_missing_or_too_short") {
      return NextResponse.redirect(new URL("/dashboard/team?error=secret_misconfigured", req.url), 303);
    }
    throw err;
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const inviteUrl = `${baseUrl.replace(/\/$/, "")}/accept-invite/${token}`;

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "members.invite",
    outcome: "success",
    entityRef: `invite:${email}:${role}`,
    correlationId,
    detail: { action: "team_invite_minted", email, role },
  });

  return NextResponse.redirect(
    new URL(`/dashboard/team?notice=invite_sent&inviteUrl=${encodeURIComponent(inviteUrl)}`, req.url),
    303,
  );
}
