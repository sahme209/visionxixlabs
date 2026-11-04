import "server-only";
import { createDesktopSessionResolverCore, type SessionResolverDependencies } from "./desktopSessionResolverCore";
import type { DesktopWorkspaceRole } from "./desktopAuthorization";
export interface PrivateSessionMembershipRepository {
 orgMembership: { findUnique(args: { where: { userId_organizationId: { userId: string; organizationId: string } }; select: { acceptedAt: true; role: true } }): PromiseLike<{ acceptedAt: Date | null; role: string } | null> };
}
/** Trusted composition dependencies only. Personal membership repair may be explicitly disabled.
 * API keys never satisfy this resolver, regardless of route options. */
export function createPrivateRequestDesktopSessionResolver(deps: Omit<SessionResolverDependencies, "readActiveWorkspaceRole"> & { repo: PrivateSessionMembershipRepository }) {
 const readActiveWorkspaceRole = async (userId: string, organizationId: string): Promise<DesktopWorkspaceRole | null> => {
  try {
   const membership = await deps.repo.orgMembership.findUnique({ where: { userId_organizationId: { userId, organizationId } }, select: { acceptedAt: true, role: true } });
   const roles: readonly string[] = ["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"];
   return membership?.acceptedAt && roles.includes(membership.role) ? membership.role as DesktopWorkspaceRole : null;
  } catch { return null; }
 };
 return createDesktopSessionResolverCore({ ...deps, readActiveWorkspaceRole }, null, { info() {}, error() {} });
}
