/**
 * Platform-admin gate.
 *
 * Cross-tenant admin surfaces (e.g. the global charter dashboard at
 * /dashboard/admin/charters) check this gate so only operators
 * named in `ADMIN_EMAILS` can read other tenants' state.
 *
 * Hard rules:
 *   - Empty / unset ADMIN_EMAILS env → no one is admin. Surfaces
 *     return 403 honestly.
 *   - Case-insensitive email match, trimmed.
 *   - Pure: no DB call, no fetch.
 */

import "server-only";

export function isPlatformAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return false;
  const set = new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  return set.has(email.trim().toLowerCase());
}

export function listAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Tenant-scope role guard. Right now the session shape's roles array
 * is the only signal; "owner" or "admin" pass, anything else fails.
 * Layered with isPlatformAdmin: caller passes when EITHER they're a
 * tenant admin OR a platform admin. Lets us scope cross-tenant
 * surfaces to platform admins while in-tenant admin surfaces also
 * accept "owner" on their own workspace.
 */
export function isTenantAdmin(roles: string[] | undefined): boolean {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  const set = new Set(roles.map((r) => r.toLowerCase()));
  return set.has("owner") || set.has("admin");
}

/** OR of the two: a tenant owner OR a platform admin gets through. */
export function isAdminOrOwner(opts: { email: string | undefined; roles: string[] | undefined }): boolean {
  return isPlatformAdmin(opts.email) || isTenantAdmin(opts.roles);
}

/**
 * Approval-authority role guard for "decide" routes (grant/reject,
 * approve/snooze, etc. on queued recommendations, proposals, and
 * findings). Mirrors the `recommendations:approve` grant in
 * lib/axiom/agent/rbacEngine.ts's ROLE_PERMISSIONS table and the
 * security_reviewer role description in
 * lib/workforce/domains/inviteLinks.ts ("Can vote on approvals but
 * not initiate engineer actions") — owner, admin, operator, and
 * security_reviewer may decide; finance_viewer and read_only may not.
 * Fails closed on a missing/empty roles array.
 */
export function isApproverRole(roles: string[] | undefined): boolean {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  const set = new Set(roles.map((r) => r.toLowerCase()));
  return set.has("owner") || set.has("admin") || set.has("operator") || set.has("security_reviewer");
}

/** OR of the two: an in-tenant approver role OR a platform admin gets through. */
export function canDecideApprovals(opts: { email: string | undefined; roles: string[] | undefined }): boolean {
  return isPlatformAdmin(opts.email) || isApproverRole(opts.roles);
}
