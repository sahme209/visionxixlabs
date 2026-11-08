import { prisma } from "@/lib/db";
import { isWorkspaceAdminRole } from "@/lib/desktop/desktopAuthorization";

/**
 * Workspace authority for /api/axiom/* routes that take an `organizationId` from the request.
 * Session identity and subscription are NOT workspace authority: accepted membership in that
 * exact workspace is rechecked on every request. Invitations, store failures and unknown users
 * deny. `mutation` additionally requires a workspace admin role.
 * (Same rule as app/api/axiom/scheduler; tenant-scoping audit 2026-11-08.)
 */
export async function authorizedForOrganization(userId: string, organizationId: unknown, mutation = false): Promise<boolean> {
  if (typeof organizationId !== "string" || organizationId.length === 0 || organizationId.length > 200) return false;
  try {
    const membership = await prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true, acceptedAt: true },
    });
    return Boolean(membership?.acceptedAt && (!mutation || isWorkspaceAdminRole(membership.role)));
  } catch {
    return false;
  }
}
