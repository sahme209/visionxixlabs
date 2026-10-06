/**
 * /accept-invite/[token] — Phase 639.
 *
 * Receives a signed invite token. Validates the signature + expiry,
 * then either:
 *   · If invitee is signed in with the matching email: creates the
 *     OrgMembership row and redirects to the workspace dashboard.
 *   · If signed out: redirects to /auth/signin with callback set
 *     to come back here.
 *   · If signed in with a different email: shows a friendly error
 *     asking them to sign in with the invited email.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { validateInviteToken, ROLE_LABEL, type InviteRole } from "@/lib/workforce/domains/inviteLinks";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const validation = validateInviteToken(token);

  if (!validation.ok || !validation.payload) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="rounded-md border border-rose-500/20 bg-rose-500/[0.04] p-6 text-center">
          <ExclamationTriangleIcon className="h-8 w-8 text-rose-300 mx-auto mb-3" />
          <p className="text-[14px] text-zinc-100 font-mono mb-2">
            {validation.error === "expired" ? "this invite has expired" :
              validation.error === "bad_signature" ? "invite signature invalid" :
              "invite link malformed"}
          </p>
          <p className="text-[12px] text-zinc-400">
            Ask the workspace admin to mint a fresh invitation.
          </p>
        </div>
      </div>
    );
  }

  const { organizationId, email, role, invitedByUserId } = validation.payload;
  const ctx = await currentContext();

  // Not signed in? Send them through auth and bring them back here.
  if (!ctx.isAuthenticated || !ctx.email) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/accept-invite/${token}`)}`);
  }

  // Signed in as a different email? Friendly explanation.
  if (ctx.email.toLowerCase() !== email.toLowerCase()) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="rounded-md border border-white/20 bg-white/[0.04] p-6 text-center">
          <ExclamationTriangleIcon className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-[14px] text-zinc-100 font-mono mb-2">
            this invite is for <span className="text-emerald-300">{email}</span>
          </p>
          <p className="text-[12px] text-zinc-400 mb-4">
            You&apos;re signed in as <span className="font-mono text-zinc-300">{ctx.email}</span>. Sign out and back in with the invited email to accept.
          </p>
          <Link href="/api/auth/signout" className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-white/30 text-zinc-200 hover:text-white hover:border-white/60 hover:bg-white/10 transition-colors">
            sign out →
          </Link>
        </div>
      </div>
    );
  }

  // Permission check passed. Create or update the membership.
  const correlationId = `team_accept_${Date.now().toString(36)}` as CorrelationId;
  let result: "created" | "already_member" | "error" = "error";
  try {
    const existing = await prisma.orgMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: String(ctx.userId),
          organizationId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      // Already a member — accept the invite as a role refresh.
      await prisma.orgMembership.update({
        where: { id: existing.id },
        data: { role: role as InviteRole, acceptedAt: new Date() },
      });
      result = "already_member";
    } else {
      await prisma.orgMembership.create({
        data: {
          userId: String(ctx.userId),
          organizationId,
          role: role as InviteRole,
          invitedBy: invitedByUserId,
          acceptedAt: new Date(),
        },
      });
      result = "created";
    }
  } catch (err) {
    console.warn("[accept-invite] failed:", err instanceof Error ? err.message : err);
    result = "error";
  }

  void auditRecord({
    organizationId: ids.organization(organizationId),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "members.invite",
    outcome: result === "error" ? "failure" : "success",
    entityRef: `membership:${email}:${role}`,
    correlationId,
    detail: { action: "team_invite_accepted", email, role, result },
  });

  if (result === "error") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="rounded-md border border-rose-500/20 bg-rose-500/[0.04] p-6 text-center">
          <ExclamationTriangleIcon className="h-8 w-8 text-rose-300 mx-auto mb-3" />
          <p className="text-[14px] text-zinc-100 font-mono mb-2">membership creation failed</p>
          <p className="text-[12px] text-zinc-400">Contact the workspace admin.</p>
        </div>
      </div>
    );
  }

  // Success — land them in the workspace dashboard.
  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
        <ShieldCheckIcon className="h-8 w-8 text-emerald-300 mx-auto mb-3" />
        <p className="text-[15px] text-zinc-100 font-mono mb-2">
          {result === "created" ? "welcome to the workspace" : "role refreshed"}
        </p>
        <p className="text-[12px] text-zinc-400 mb-1 font-mono">
          role :: <span className="text-emerald-300">{role}</span> · {ROLE_LABEL[role as InviteRole]?.label}
        </p>
        <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
          {ROLE_LABEL[role as InviteRole]?.description}
        </p>
        <Link href="/dashboard" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors inline-block">
          enter dashboard →
        </Link>
      </div>
    </div>
  );
}
