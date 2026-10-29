/**
 * POST /api/team/role — Phase 639.
 *
 * Updates the role of an existing OrgMembership or removes the
 * member entirely. Caller must be owner or admin in this workspace,
 * and the target row's role cannot be "owner" (transferring
 * ownership requires a separate hand-off flow).
 */

import { type BrowserNavigationIntent, BROWSER_NAVIGATION_FIELDS, browserNavigationIntentPath, matchesBrowserNavigationMembership, parseBrowserNavigationIntent } from "@/lib/desktop/browserNavigationIntent";
import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { ASSIGNABLE_ROLES, type InviteRole } from "@/lib/workforce/domains/inviteLinks";
import { recordRequiredAudit as auditRecord } from "@/lib/audit/requiredAudit";
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
  const hasIntent = f.has("returnIntent") || BROWSER_NAVIGATION_FIELDS.some(key => f.has(key));
  let intent: BrowserNavigationIntent | null = null;
  if (hasIntent) {
    const allowed = new Set<string>([...BROWSER_NAVIGATION_FIELDS, "returnIntent", "membershipId", "role", "action"]);
    const fields = [...f.entries()];
    if (req.headers.get("origin") !== new URL(req.url).origin || !req.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") || fields.some(([key, value]) => !allowed.has(key) || typeof value !== "string") || fields.reduce((size, [key, value]) => size + key.length + String(value).length, 0) > 16_384 || [...allowed].some(key => f.getAll(key).length > 1) || BROWSER_NAVIGATION_FIELDS.some(key => f.getAll(key).length !== 1) || f.get("returnIntent") !== "members_handoff") return NextResponse.json({ ok: false, error: "invalid_navigation_intent" }, { status: 400 });
    intent = parseBrowserNavigationIntent(Object.fromEntries(BROWSER_NAVIGATION_FIELDS.map(key => [key, f.get(key)])), Date.now());
    if (!intent || !ctx.sessionUserId || String(ctx.sessionUserId) !== intent.expectedUserId || String(ctx.userId) !== intent.expectedUserId || org !== intent.organizationId) return NextResponse.json({ ok: false, error: "navigation_context_changed" }, { status: 403 });
  }
  function teamResponse(destination: string) {
    if (!intent) return NextResponse.redirect(new URL(destination, req.url), 303);
    const error = new URL(destination, req.url).searchParams.get("error");
    if (error) return NextResponse.json({ ok: false, error, message: "The member action was not confirmed. Review current workspace state before retrying. An audit-unconfirmed result may already have changed the role." }, { status: 409 });
    // Do not label an advisory hint as a success receipt. Re-open the guarded
    // destination to observe current state under the same expected context.
    return NextResponse.redirect(new URL(browserNavigationIntentPath(intent), req.url), 303);
  }
  async function freshNavigationAuthority(): Promise<boolean> {
    if (!intent) return true;
    const fresh = await requireContext();
    if (!fresh.sessionUserId || String(fresh.sessionUserId) !== intent.expectedUserId || String(fresh.userId) !== intent.expectedUserId || String(fresh.organizationId) !== intent.organizationId) return false;
    const own = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId: intent.expectedUserId, organizationId: intent.organizationId } }, select: { role: true, acceptedAt: true, updatedAt: true } });
    return Boolean(own && (own.role === "owner" || own.role === "admin") && matchesBrowserNavigationMembership(intent, own) && parseBrowserNavigationIntent(intent, Date.now()));
  }
  const membershipId = s(f.get("membershipId"));
  const action = s(f.get("action"));
  const correlationId = `team_role_${Date.now().toString(36)}` as CorrelationId;

  if (!membershipId) {
    return teamResponse("/dashboard/team?error=missing_membership_id");
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
        select: { role: true, acceptedAt: true, ...(intent ? { updatedAt: true } : {}) },
      });
      canManage = Boolean(me?.acceptedAt) && (me?.role === "owner" || me?.role === "admin") && (!intent || (matchesBrowserNavigationMembership(intent, me as { acceptedAt: Date | null; updatedAt: Date } | null) && Boolean(parseBrowserNavigationIntent(intent, Date.now()))));
    }
  } catch {
    canManage = false;
  }
  if (!canManage) {
    return teamResponse("/dashboard/team?error=insufficient_permission");
  }

  // Target row must be in the same workspace and not the owner.
  const target = await prisma.orgMembership.findUnique({
    where: { id: membershipId },
    select: { id: true, role: true, organizationId: true, userId: true },
  }).catch(() => null);
  if (!target || target.organizationId !== org) {
    return teamResponse("/dashboard/team?error=not_found");
  }
  if (target.role === "owner") {
    return teamResponse("/dashboard/team?error=cannot_modify_owner");
  }
  // Prevent admins from modifying themselves into a lower role through
  // this surface — they should use a separate "leave workspace" flow.
  if (String(target.userId) === String(ctx.userId)) {
    return teamResponse("/dashboard/team?error=cannot_modify_self");
  }

  if (intent) {
    try { if (!await freshNavigationAuthority()) return NextResponse.json({ ok: false, error: "navigation_context_changed" }, { status: 409 }); }
    catch { return NextResponse.json({ ok: false, error: "navigation_context_unavailable" }, { status: 503 }); }
  }
  if (action === "remove") {
    try {
      if (intent) {
        const changed = await prisma.orgMembership.deleteMany({ where: { id: membershipId, organizationId: org, userId: target.userId, role: target.role, NOT: [{ userId: String(ctx.userId) }, { role: "owner" }] } });
        if (changed.count !== 1) return NextResponse.json({ ok: false, error: "navigation_target_changed" }, { status: 409 });
      } else await prisma.orgMembership.delete({ where: { id: membershipId } });
    } catch {
      return teamResponse("/dashboard/team?error=delete_failed");
    }
    try {
      await auditRecord({
        organizationId: ids.organization(org),
        actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
        action: "members.remove",
        outcome: "success",
        entityRef: `membership:${membershipId}`,
        correlationId,
        detail: { action: "team_member_removed", priorRole: target.role },
      });
    } catch {
      return teamResponse("/dashboard/team?error=audit_unconfirmed");
    }
    return teamResponse("/dashboard/team?notice=removed");
  }

  const role = parseRole(s(f.get("role")));
  if (!role) {
    return teamResponse("/dashboard/team?error=invalid_role");
  }
  try {
    if (intent) {
      const changed = await prisma.orgMembership.updateMany({ where: { id: membershipId, organizationId: org, userId: target.userId, role: target.role, NOT: [{ userId: String(ctx.userId) }, { role: "owner" }] }, data: { role } });
      if (changed.count !== 1) return NextResponse.json({ ok: false, error: "navigation_target_changed" }, { status: 409 });
    } else await prisma.orgMembership.update({
      where: { id: membershipId },
      data: { role },
    });
  } catch {
    return teamResponse("/dashboard/team?error=update_failed");
  }
  try {
    await auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "governance.update",
      outcome: "success",
      entityRef: `membership:${membershipId}`,
      correlationId,
      detail: { action: "team_role_updated", priorRole: target.role, newRole: role },
    });
  } catch {
    return teamResponse("/dashboard/team?error=audit_unconfirmed");
  }
  return teamResponse("/dashboard/team?notice=role_updated");
}
