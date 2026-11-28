import "server-only";

export interface CustomRoleRepo {
  orgMembership: { findUnique(args: { where: { userId_organizationId: { userId: string; organizationId: string } }; select: { customRoleId: true } }): PromiseLike<{ customRoleId: string | null } | null> };
  workspaceCustomRole: { findFirst(args: { where: { id: string; organizationId: string }; select: { removedCapabilities: true } }): PromiseLike<{ removedCapabilities: string[] } | null> };
}

/** Capabilities a member's workspace custom role removes. A missing role or a read failure refuses the request. */
export function createCustomRoleRestrictionReader(repo: CustomRoleRepo) {
  return async (userId: string, organizationId: string): Promise<{ removed: string[] } | "unavailable"> => {
    try {
      const membership = await repo.orgMembership.findUnique({ where: { userId_organizationId: { userId, organizationId } }, select: { customRoleId: true } });
      if (!membership?.customRoleId) return { removed: [] };
      const role = await repo.workspaceCustomRole.findFirst({ where: { id: membership.customRoleId, organizationId }, select: { removedCapabilities: true } });
      return role ? { removed: role.removedCapabilities } : "unavailable";
    } catch {
      return "unavailable";
    }
  };
}
