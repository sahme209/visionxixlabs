/**
 * Ask Axiom: request access (support roadmap step 4). Pure.
 *
 * A member asks for a higher role; the request is a notification to workspace
 * admins, never a grant. Admins change the role through the normal Members
 * flow. Owner cannot be requested here (ownership transfer is separate).
 */
import { ASSIGNABLE_ROLES, type InviteRole } from "@/lib/workforce/domains/inviteLinks";

const RANK: Record<string, number> = { read_only: 0, finance_viewer: 1, security_reviewer: 1, operator: 2, admin: 3, owner: 4 };

export type AccessRequestDecision =
  | { ok: true; requestedRole: InviteRole; reason: string }
  | { ok: false; error: "invalid_role" | "already_has_role" | "reason_required" };

export function decideAccessRequest(input: { requestedRole: unknown; reason: unknown; currentRole: string }): AccessRequestDecision {
  const role = input.requestedRole;
  if (typeof role !== "string" || !(ASSIGNABLE_ROLES as readonly string[]).includes(role)) return { ok: false, error: "invalid_role" };
  const current = RANK[input.currentRole] ?? 0;
  // Same or lower rank is not an upgrade; a peer role (e.g. finance → security reviewer) is allowed.
  if (role === input.currentRole || (RANK[role] ?? 0) < current) return { ok: false, error: "already_has_role" };
  const reason = typeof input.reason === "string" ? input.reason.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 500) : "";
  if (reason.length < 5) return { ok: false, error: "reason_required" };
  return { ok: true, requestedRole: role as InviteRole, reason };
}

/** Recognises "I need admin access" style questions so the chat can offer the request form. */
export function looksLikeAccessRequest(question: string): boolean {
  return /\b(need|want|request|get|give me|grant|upgrade)\b.*\b(access|permission|permissions|role|admin|operator|approver)\b|\bwhy can'?t i\b|\bnot allowed\b|\bpermission denied\b/i.test(question.slice(0, 500));
}
