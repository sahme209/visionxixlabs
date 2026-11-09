/**
 * Ask Axiom governed actions (support roadmap step 4). Pure kernel.
 *
 * Ask Axiom is an agent too, so it is governed like one: it may only offer a
 * fixed, closed set of actions; each names the roles allowed to run it; every
 * action needs the person's explicit confirmation of the exact action; and the
 * server re-checks all of this (the client copy only decides what to offer).
 * Nothing here is free-form: no arbitrary targets, no parameters, no chaining.
 */
export const SUPPORT_ACTIONS = ["seal_audit_log", "verify_audit_log"] as const;
export type SupportAction = (typeof SUPPORT_ACTIONS)[number];

export interface SupportActionInfo {
  label: string;
  /** Shown before the person confirms; states exactly what will happen. */
  confirmText: string;
  /** Read-only actions change nothing; "append" adds a record and never edits or deletes one. */
  effect: "read_only" | "append";
  /** Roles allowed to run it, or any accepted member (matches the Trust tools screen). */
  roles: readonly string[] | "any_member";
}

export const SUPPORT_ACTION_INFO: Readonly<Record<SupportAction, SupportActionInfo>> = {
  seal_audit_log: {
    label: "Seal the audit log now",
    confirmText: "Adds one tamper-evident seal covering audit events since the last seal. It never edits or deletes events, and it is recorded in the audit log.",
    effect: "append",
    roles: ["owner", "admin"],
  },
  verify_audit_log: {
    label: "Verify the audit log",
    confirmText: "Recomputes every seal and reports whether the sealed events are intact. Read-only. If tampering is found, your integrity webhook is notified.",
    effect: "read_only",
    roles: "any_member",
  },
};

export const isSupportAction = (v: unknown): v is SupportAction => typeof v === "string" && (SUPPORT_ACTIONS as readonly string[]).includes(v);

const RULES: ReadonlyArray<{ action: SupportAction; test: RegExp }> = [
  { action: "verify_audit_log", test: /\b(verify|check|prove|test)\b.*\b(audit|seals?|tamper\w*|integrity)\b|\b(audit|seals?)\b.*\b(intact|tamper\w*|verified?|integrity)\b/i },
  { action: "seal_audit_log", test: /\bseal\b.*\b(audit|log|events?)\b|\b(audit log)\b.*\bseal\b/i },
];

/** Which action, if any, to offer for a question. Offering is not permission. */
export function classifySupportAction(question: string): SupportAction | null {
  const q = question.slice(0, 500);
  return RULES.find((r) => r.test.test(q))?.action ?? null;
}

export type SupportActionDecision =
  | { ok: true; action: SupportAction; info: SupportActionInfo }
  | { ok: false; error: "unknown_action" | "role_not_allowed" | "confirmation_required" };

/**
 * Server-side gate. `confirmed` must be the exact action name the person
 * confirmed, so a confirmation for one action can never run another.
 */
export function decideSupportAction(input: { action: unknown; role: string | null | undefined; confirmed: unknown }): SupportActionDecision {
  if (!isSupportAction(input.action)) return { ok: false, error: "unknown_action" };
  const info = SUPPORT_ACTION_INFO[input.action];
  if (!roleAllowed(info, input.role)) return { ok: false, error: "role_not_allowed" };
  if (input.confirmed !== input.action) return { ok: false, error: "confirmation_required" };
  return { ok: true, action: input.action, info };
}

/** Whether to show the action button at all for this role (UI only). */
export function mayOffer(action: SupportAction, role: string | null | undefined): boolean {
  return roleAllowed(SUPPORT_ACTION_INFO[action], role);
}

/** Callers pass the role of an accepted membership only; no role means not a member. */
function roleAllowed(info: SupportActionInfo, role: string | null | undefined): boolean {
  if (!role) return false;
  return info.roles === "any_member" || info.roles.includes(role);
}
