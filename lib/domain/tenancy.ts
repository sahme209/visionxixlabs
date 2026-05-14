/**
 * Tenant scope contracts. Every persisted or transported record in Axiom is
 * scoped to an organization — `Tenanted` is the structural guard.
 */

import type { OrganizationId } from "./ids";

export interface Tenanted {
  organizationId: OrganizationId;
}

/** Type predicate: an object carries a tenant scope. */
export function isTenanted<T extends object>(o: T): o is T & Tenanted {
  return typeof (o as { organizationId?: unknown }).organizationId === "string";
}

/**
 * Assert that a record belongs to the expected tenant. Throws otherwise.
 * Use this at API/service boundaries — never silently mismatch.
 */
export function assertTenant<T extends Tenanted>(record: T, expected: OrganizationId): T {
  if (record.organizationId !== expected) {
    throw new Error(
      `Tenant scope violation: record organizationId=${record.organizationId} does not match expected=${expected}`
    );
  }
  return record;
}
