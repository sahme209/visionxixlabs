/**
 * Validates and runs computeLifecyclePlan() against an uploaded directory
 * snapshot. Stage-only, same posture as scimLifecycleHelper.ts itself —
 * this never writes a grant/revoke, it only returns the plan an operator
 * would need to confirm before anything executes. No execution path
 * exists yet.
 */

import { computeLifecyclePlan, type DirectoryEmployee, type CurrentGrant, type LifecyclePlan } from "./scimLifecycleHelper";

export type PreviewBody =
  | { ok: true; data: LifecyclePlan }
  | { ok: false; error: "invalid_payload"; hint?: string };

const VALID_STATUSES = new Set(["active", "on_leave", "terminated"]);

function isValidEmployee(value: unknown): value is DirectoryEmployee {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" && e.id.length > 0 &&
    typeof e.email === "string" && e.email.includes("@") &&
    typeof e.status === "string" && VALID_STATUSES.has(e.status) &&
    Array.isArray(e.desiredRoles) && e.desiredRoles.every((r) => typeof r === "string")
  );
}

function isValidGrant(value: unknown): value is CurrentGrant {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  return typeof g.userId === "string" && g.userId.length > 0 && typeof g.role === "string" && typeof g.grantedAtIso === "string";
}

export function buildScimLifecyclePreviewResponse(input: { employees: unknown; currentGrants: unknown }): { status: number; body: PreviewBody } {
  if (!Array.isArray(input.employees) || !input.employees.every(isValidEmployee)) {
    return { status: 422, body: { ok: false, error: "invalid_payload", hint: "employees must be an array of { id, email, status: active|on_leave|terminated, desiredRoles: string[] }." } };
  }
  if (!Array.isArray(input.currentGrants) || !input.currentGrants.every(isValidGrant)) {
    return { status: 422, body: { ok: false, error: "invalid_payload", hint: "currentGrants must be an array of { userId, role, grantedAtIso }." } };
  }

  const plan = computeLifecyclePlan({ employees: input.employees, currentGrants: input.currentGrants });
  return { status: 200, body: { ok: true, data: plan } };
}
