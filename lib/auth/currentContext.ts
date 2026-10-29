/**
 * Canonical "what is the current operating context?" resolver.
 *
 * Every server-side handler — API route, server action, scan pipeline,
 * audit writer — calls `currentContext()` to know who is acting and which
 * workspace they're acting in. Until the NextAuth session officially
 * carries `organizationId`, the resolver derives a stable workspace id
 * from the user id so tenant-scoped queries still work in production.
 *
 * Hard rule: this module is server-only. Never import from a client
 * component — the session can leak otherwise.
 */

import "server-only";
import { cookies } from "next/headers";
import { readWorkspaceSelection, WORKSPACE_COOKIE } from "./workspaceSelection";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { id } from "@/lib/domain/ids";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";
import { ensurePersonalWorkspaceMembership } from "@/lib/auth/ensurePersonalWorkspaceMembership";
import { createLogger } from "@/lib/observability/logger";

const log = createLogger("auth.currentContext.membershipRetry");
import { prisma } from "@/lib/db";

export interface CurrentContext {
  isAuthenticated: boolean;
  userId?: UserId;
  /** Present only when NextAuth supplied a stable ID; userId may retain the legacy email fallback. */
  sessionUserId?: UserId;
  email?: string;
  displayName?: string;
  organizationId?: OrganizationId;
  /** Stable workspace label rendered in the UI. */
  workspaceLabel?: string;
  /** Roles confirmed for the active workspace. */
  roles: string[];
}

/**
 * Resolve the current operating context. Pure-async — every call hits
 * NextAuth + computes a stable workspace id. Cheap enough to call per
 * request handler.
 */
export async function currentContext(): Promise<CurrentContext> {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email ?? undefined;
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userEmail) {
    return { isAuthenticated: false, roles: [] };
  }
  const userId = sessionUserId ? id.user(sessionUserId) : id.user(userEmail);
  const personalOrgId = deriveWorkspaceIdFromEmail(userEmail);
  const selectedOrgId = sessionUserId ? readWorkspaceSelection((await cookies()).get(WORKSPACE_COOKIE)?.value, sessionUserId) : null;
  const orgId = selectedOrgId ? id.organization(selectedOrgId) : personalOrgId;
  const roles = await resolveWorkspaceRoles({
    userId: String(userId),
    organizationId: String(orgId),
    email: userEmail,
  });
  // A preference is never tenant authority. Withhold the selected scope when
  // membership was revoked/pending/unverifiable, including read-only routes.
  if (selectedOrgId && !roles.length) return {
    isAuthenticated: true, userId,
    ...(sessionUserId ? { sessionUserId: id.user(sessionUserId) } : {}),
    email: userEmail, displayName: session.user.name ?? userEmail,
    workspaceLabel: "Workspace access unavailable", roles: [],
  };
  return {
    isAuthenticated: true,
    userId,
    ...(sessionUserId ? { sessionUserId: id.user(sessionUserId) } : {}),
    email: userEmail,
    displayName: session.user.name ?? userEmail,
    organizationId: orgId,
    workspaceLabel: selectedOrgId && selectedOrgId !== String(personalOrgId) ? `Shared workspace · ${selectedOrgId.slice(-8)}` : deriveWorkspaceLabel(userEmail),
    roles,
  };
}

function deriveWorkspaceLabel(email: string): string {
  // Use the email's domain as a friendly label when we don't have a real
  // workspace name. "alice@acme.com" → "acme" workspace.
  const domain = email.split("@")[1]?.split(".")[0];
  if (!domain || domain === "gmail" || domain === "outlook" || domain === "hotmail" || domain === "yahoo") {
    return email.split("@")[0];
  }
  return domain;
}

async function resolveWorkspaceRoles(input: {
  userId: string;
  organizationId: string;
  email: string;
}): Promise<string[]> {
  // Membership is the source of truth for workspace authority. A signed-in
  // identity without a current membership can read only public browser
  // surfaces; it cannot gain integration or provider-policy authority by
  // falling back to a synthetic "owner" role.
  try {
    const membership = await prisma.orgMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: input.userId,
          organizationId: input.organizationId,
        },
      },
      select: { role: true, acceptedAt: true },
    });
    // An invitation is not authority. Preserve a pending membership without
    // invoking personal-workspace recovery over it, matching the desktop gate.
    if (membership) return membership.acceptedAt && membership.role ? [membership.role] : [];
  } catch (err) {
    // A missing migration or transient store failure must not expand access.
    log.error("initial membership lookup failed", {
      userId: input.userId,
      organizationId: input.organizationId,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorCode: err instanceof Error && "code" in err ? (err as { code?: unknown }).code : undefined,
    });
    return [];
  }

  const derivedPersonalWorkspaceId = String(deriveWorkspaceIdFromEmail(input.email));

  // The bootstrap that grants a new identity ownership of its own derived
  // workspace runs once, best-effort, at sign-in (see lib/auth.ts) with its
  // own error swallowed. If that single attempt silently failed (a
  // transient DB blip at that exact moment), the user would otherwise be
  // locked out of their own workspace indefinitely, with no self-healing
  // path. Retry it once, here, scoped only to the user's own derived
  // workspace — never a shared/invited organization, where a missing
  // membership legitimately means "not a member," not "bootstrap failed."
  if (input.organizationId === derivedPersonalWorkspaceId) {
    try {
      await ensurePersonalWorkspaceMembership({ userId: input.userId, email: input.email });
      const membership = await prisma.orgMembership.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: input.organizationId } },
        select: { role: true, acceptedAt: true },
      });
      if (membership?.acceptedAt && membership.role) return [membership.role];
      log.error("membership bootstrap retry ran without throwing but still produced no role", {
        userId: input.userId,
        organizationId: input.organizationId,
      });
    } catch (err) {
      // Still best-effort — a retry failure must not expand access either.
      log.error("membership bootstrap retry failed", {
        userId: input.userId,
        organizationId: input.organizationId,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: err instanceof Error && "code" in err ? (err as { code?: unknown }).code : undefined,
      });
      return [];
    }
  } else {
    // This is the other real failure mode worth being able to see: the
    // session's organizationId does not match this identity's own derived
    // personal workspace at all, so the retry above is correctly skipped —
    // but if that's unexpected (e.g. nobody ever intentionally invited this
    // user into a different workspace), this log line is the only way to
    // tell "bootstrap is broken" apart from "this genuinely isn't your
    // personal workspace."
    log.error("session organizationId does not match this identity's derived personal workspace; bootstrap retry skipped", {
      userId: input.userId,
      sessionOrganizationId: input.organizationId,
      derivedPersonalWorkspaceId,
    });
  }

  // Login-session claims are not authority. A revoked or deleted membership
  // must take effect on the next request, rather than lasting until the
  // session expires. New identities therefore have no privileged workspace
  // role until the durable membership exists.
  return [];
}

/** Require an authenticated context — throws when not signed in. */
export async function requireContext(): Promise<Required<Pick<CurrentContext, "userId" | "organizationId" | "email">> & CurrentContext> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId || !ctx.email) {
    throw new Error("Authentication required.");
  }
  return ctx as Required<Pick<CurrentContext, "userId" | "organizationId" | "email">> & CurrentContext;
}
