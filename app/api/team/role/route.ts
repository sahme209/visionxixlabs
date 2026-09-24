/**
 * POST /api/team/role — Phase 639.
 *
 * Updates the role of an existing OrgMembership or removes the
 * member entirely. Caller must be owner or admin in this workspace,
 * and the target row's role cannot be "owner" (transferring
 * ownership requires a separate hand-off flow).
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { ASSIGNABLE_ROLES, type InviteRole } from "@/lib/workforce/domains/inviteLinks";
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

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const membershipId = s(f.get("membershipId"));
  const action = s(f.get("action"));
  const correlationId = `team_role_${Date.now().toString(36)}` as CorrelationId;

  if (!membershipId) {
    return NextResponse.redirect(new URL("/dashboard/team?error=missing_membership_id", req.url), 303);
  }

  // Caller permission check.
  let canManage = false;
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
      canManage = me?.role === "owner" || me?.role === "admin";
    }
  } catch {
    canManage = false;
  }
  if (!canManage) {
    return NextResponse.redirect(new URL("/dashboard/team?error=insufficient_permission", req.url), 303);
  }

  // Target row must be in the same workspace and not the owner.
  const target = await prisma.orgMembership.findUnique({
    where: { id: membershipId },
    select: { id: true, role: true, organizationId: true, userId: true },
  }).catch(() => null);
  if (!target || target.organizationId !== org) {
    return NextResponse.redirect(new URL("/dashboard/team?error=not_found", req.url), 303);
  }
  if (target.role === "owner") {
    return NextResponse.redirect(new URL("/dashboard/team?error=cannot_modify_owner", req.url), 303);
  }
  // Prevent admins from modifying themselves into a lower role through
  // this surface — they should use a separate "leave workspace" flow.
  if (String(target.userId) === String(ctx.userId)) {
    return NextResponse.redirect(new URL("/dashboard/team?error=cannot_modify_self", req.url), 303);
  }

  if (action === "remove") {
    try {
      await prisma.orgMembership.delete({ where: { id: membershipId } });
    } catch {
      return NextResponse.redirect(new URL("/dashboard/team?error=delete_failed", req.url), 303);
    }
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "members.remove",
      outcome: "success",
      entityRef: `membership:${membershipId}`,
      correlationId,
      detail: { action: "team_member_removed", priorRole: target.role },
    });
    return NextResponse.redirect(new URL("/dashboard/team?notice=removed", req.url), 303);
  }

  const role = parseRole(s(f.get("role")));
  if (!role) {
    return NextResponse.redirect(new URL("/dashboard/team?error=invalid_role", req.url), 303);
  }
  try {
    await prisma.orgMembership.update({
      where: { id: membershipId },
      data: { role },
    });
  } catch {
    return NextResponse.redirect(new URL("/dashboard/team?error=update_failed", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "governance.update",
    outcome: "success",
    entityRef: `membership:${membershipId}`,
    correlationId,
    detail: { action: "team_role_updated", priorRole: target.role, newRole: role },
  });
  return NextResponse.redirect(new URL("/dashboard/team?notice=role_updated", req.url), 303);
}
