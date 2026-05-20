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
