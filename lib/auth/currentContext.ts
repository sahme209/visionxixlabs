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
import { createHash } from "node:crypto";

export interface CurrentContext {
  isAuthenticated: boolean;
  userId?: UserId;
  email?: string;
  displayName?: string;
  organizationId?: OrganizationId;
  /** Stable workspace label rendered in the UI. */
  workspaceLabel?: string;
  /** Roles attached to the session. Empty for the default workspace until
   *  the session shape is extended in a future migration. */
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
  const orgId = deriveDefaultWorkspaceId(userEmail);
  return {
    isAuthenticated: true,
    userId,
    email: userEmail,
    displayName: session.user.name ?? userEmail,
    organizationId: orgId,
    workspaceLabel: deriveWorkspaceLabel(userEmail),
    roles: deriveRolesFromSession(session.user as { roles?: string[] | null }),
  };
}

/**
 * Default workspace id derivation — until the User → Organization model
 * lands, every email gets a stable "ws_<sha256-prefix>" id. This keeps
 * tenant-scoped queries deterministic without requiring the full multi-
 * tenant schema migration.
 *
 * Same email + same workspace id forever. Different emails → different
 * workspace ids → tenant isolation still holds.
 */
function deriveDefaultWorkspaceId(email: string): OrganizationId {
  const hash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
  return id.organization(`ws_${hash}`);
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

function deriveRolesFromSession(user: { roles?: string[] | null }): string[] {
  // When the session augmentation lands, real roles come from here. Until
  // then, the first user in a workspace is owner — which the apiGuard
  // permission engine can promote conservatively.
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles;
  return ["owner"];
}

/** Require an authenticated context — throws when not signed in. */
export async function requireContext(): Promise<Required<Pick<CurrentContext, "userId" | "organizationId" | "email">> & CurrentContext> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId || !ctx.email) {
    throw new Error("Authentication required.");
  }
  return ctx as Required<Pick<CurrentContext, "userId" | "organizationId" | "email">> & CurrentContext;
}
