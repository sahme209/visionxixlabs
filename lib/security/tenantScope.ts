/**
 * Tenant scope guards for the API and service boundaries.
 *
 * Every API route handler must resolve a TenantScope before reading or
 * writing tenant-owned data. This module centralises that lookup so the
 * rule lives in one place rather than being re-implemented per route.
 */

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type { Tenanted } from "@/lib/domain/tenancy";
import { id } from "@/lib/domain/ids";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export interface TenantScope {
  organizationId: OrganizationId;
  userId: UserId;
  /** Roles relevant to authorization checks downstream. */
  roles: string[];
}

/**
 * Resolve a tenant scope from a minimal session shape. Returns null when the
 * session cannot supply a tenant — callers should map that to a 401/403.
 *
 * Kept structural (no NextAuth dependency) so it can be unit-tested without
 * mounting the auth layer.
 */
export interface SessionLike {
  user?: { id?: string | null; organizationId?: string | null; roles?: string[] | null } | null;
}

export function tenantScopeFromSession(session: SessionLike | null): TenantScope | null {
  const userId = session?.user?.id;
  const orgId = session?.user?.organizationId;
  if (!userId || !orgId) return null;
  return {
    organizationId: id.organization(orgId),
    userId: id.user(userId),
    roles: session?.user?.roles ?? [],
  };
}

/**
 * Assert that a tenant-owned record belongs to the scope. Throws an
 * AxiomError(category=tenancy) on mismatch so the API layer maps it to 403.
 */
export function enforceTenant<T extends Tenanted>(scope: TenantScope, record: T): T {
  if (record.organizationId !== scope.organizationId) {
    throw AxiomErrors.tenancy("tenancy.mismatch", "Resource does not belong to your organization.", {
      expected: scope.organizationId,
      actual: record.organizationId,
    });
  }
  return record;
}

/** Filter a collection to records owned by this tenant. */
export function filterByTenant<T extends Tenanted>(scope: TenantScope, records: T[]): T[] {
  return records.filter((r) => r.organizationId === scope.organizationId);
}

/** Convenience: require a given role on the resolved scope. */
export function requireRole(scope: TenantScope, role: string): void {
  if (!scope.roles.includes(role)) {
    throw AxiomErrors.policy("authz.role_required", `This action requires the "${role}" role.`, {
      role,
    });
  }
}
