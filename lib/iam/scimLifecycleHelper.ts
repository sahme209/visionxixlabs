/**
 * Pure SCIM identity-lifecycle helper.
 *
 * Operators upload (employees, current_grants) from their HR system +
 * SSO directory. We diff against tenant grants to derive the
 * joiner / mover / leaver actions Axiom should stage. Stage only —
 * approval-only-no-execution; the operator confirms before any grant
 * actually mutates.
 *
 * Pure / deterministic.
 */

export type LifecycleActionKind = "grant_role" | "revoke_role" | "swap_role" | "deactivate_user";

export interface DirectoryEmployee {
  /** SCIM externalId or HR id. */
  id: string;
  email: string;
  /** Employment status from HRIS. */
  status: "active" | "on_leave" | "terminated";
  /** Roles the directory says this user should have right now. */
  desiredRoles: readonly string[];
}

export interface CurrentGrant {
  userId: string;
  role: string;
  /** ISO when this grant was created. */
  grantedAtIso: string;
}

export interface LifecycleAction {
  kind: LifecycleActionKind;
  userId: string;
  /** Role being touched. May be empty for deactivate_user. */
  role: string;
  /** Human-readable reason. */
  reason: string;
}

export interface LifecyclePlan {
  actions: LifecycleAction[];
  joinersCount: number;
  moversCount: number;
  leaversCount: number;
}

export function computeLifecyclePlan(input: {
  employees: readonly DirectoryEmployee[];
  currentGrants: readonly CurrentGrant[];
}): LifecyclePlan {
  const grantsByUser = new Map<string, Set<string>>();
  for (const g of input.currentGrants) {
    const set = grantsByUser.get(g.userId) ?? new Set();
    set.add(g.role);
    grantsByUser.set(g.userId, set);
  }

  const actions: LifecycleAction[] = [];
  let joiners = 0;
  let movers = 0;
  let leavers = 0;
  const seenUsers = new Set<string>();

  for (const emp of input.employees) {
    seenUsers.add(emp.id);
    const current = grantsByUser.get(emp.id) ?? new Set<string>();

    if (emp.status === "terminated") {
      // Revoke every active grant for this user.
      for (const role of current) {
        actions.push({
          kind: "revoke_role",
          userId: emp.id,
          role,
          reason: `HRIS marked ${emp.email} as terminated`,
        });
      }
      actions.push({
        kind: "deactivate_user",
        userId: emp.id,
        role: "",
        reason: `HRIS marked ${emp.email} as terminated`,
      });
      leavers += 1;
      continue;
    }

    if (emp.status === "on_leave") {
      // Don't auto-revoke — leave grants in place for return.
      continue;
    }

    const desired = new Set(emp.desiredRoles);
    const isJoiner = current.size === 0 && desired.size > 0;
    if (isJoiner) joiners += 1;

    let touched = false;

    for (const role of desired) {
      if (!current.has(role)) {
        actions.push({
          kind: "grant_role",
          userId: emp.id,
          role,
          reason: isJoiner ? `joiner — HRIS says ${emp.email} needs ${role}` : `mover — directory adds ${role} to ${emp.email}`,
        });
        touched = true;
      }
    }
    for (const role of current) {
      if (!desired.has(role)) {
        actions.push({
          kind: "revoke_role",
          userId: emp.id,
          role,
          reason: `mover — directory no longer assigns ${role} to ${emp.email}`,
        });
        touched = true;
      }
    }
    if (!isJoiner && touched) movers += 1;
  }

  // Users present in current grants but missing from the directory →
  // assume they left HRIS without proper offboarding. Stage revokes.
  for (const [userId, roles] of grantsByUser) {
    if (seenUsers.has(userId)) continue;
    for (const role of roles) {
      actions.push({
        kind: "revoke_role",
        userId,
        role,
        reason: `user not in HRIS — possible missed offboarding`,
      });
    }
    actions.push({
      kind: "deactivate_user",
      userId,
      role: "",
      reason: "user not present in HRIS feed",
    });
    leavers += 1;
  }

  return { actions, joinersCount: joiners, moversCount: movers, leaversCount: leavers };
}
