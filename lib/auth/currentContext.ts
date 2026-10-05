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
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { id } from "@/lib/domain/ids";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";
import { ensurePersonalWorkspaceMembership } from "@/lib/auth/ensurePersonalWorkspaceMembership";
import { prisma } from "@/lib/db";

export interface CurrentContext {
  isAuthenticated: boolean;
  userId?: UserId;
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
  const orgId = deriveWorkspaceIdFromEmail(userEmail);
  const roles = await resolveWorkspaceRoles({
    userId: String(userId),
    organizationId: String(orgId),
    email: userEmail,
  });
  return {
    isAuthenticated: true,
    userId,
    email: userEmail,
    displayName: session.user.name ?? userEmail,
    organizationId: orgId,
    workspaceLabel: deriveWorkspaceLabel(userEmail),
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
      select: { role: true },
    });
    if (membership?.role) return [membership.role];
  } catch {
    // A missing migration or transient store failure must not expand access.
    return [];
  }

  // The bootstrap that grants a new identity ownership of its own derived
  // workspace runs once, best-effort, at sign-in (see lib/auth.ts) with its
  // own error swallowed. If that single attempt silently failed (a
  // transient DB blip at that exact moment), the user would otherwise be
  // locked out of their own workspace indefinitely, with no self-healing
  // path. Retry it once, here, scoped only to the user's own derived
  // workspace — never a shared/invited organization, where a missing
  // membership legitimately means "not a member," not "bootstrap failed."
  if (input.organizationId === String(deriveWorkspaceIdFromEmail(input.email))) {
    try {
      await ensurePersonalWorkspaceMembership({ userId: input.userId, email: input.email });
      const membership = await prisma.orgMembership.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: input.organizationId } },
        select: { role: true },
      });
      if (membership?.role) return [membership.role];
    } catch {
      // Still best-effort — a retry failure must not expand access either.
      return [];
    }
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
