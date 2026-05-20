/**
 * Agent bus — typed contract.
 *
 * Closed-union AgentRole + AgentMessageKind so adding a new role or
 * message kind is a deliberate edit that breaks every consumer in
 * the TS exhaustiveness check. The bus itself is in lib/agents/agentBus.
 *
 * Pure data — safe to import from anywhere (client or server).
 */

export type AgentRole =
  | "detector"        // surfaces signals from telemetry / cloud inventory
  | "reasoner"        // builds a hypothesis from one signal
  | "simulator"       // proves the proposed change is safe in a sandbox
  | "policy_gate"     // checks against tenant charter + RBAC
  | "boundary_gate"   // checks against automation boundary classes
  | "approver"        // packages for human approval
  | "verifier"        // post-execution verification
  | "auditor"         // writes the durable rationale row
  | "council"         // synthesizes N agent verdicts into one
  | "improver";       // proposes method / template improvements

export type AgentMessageKind =
  | "broadcast_signal"      // detector → all
  | "hypothesis_proposed"   // reasoner → simulator / policy_gate
  | "simulation_result"     // simulator → policy_gate / approver
  | "policy_verdict"        // policy_gate → boundary_gate
  | "boundary_verdict"      // boundary_gate → approver
  | "approval_request"      // approver → human (out-of-band via outbound lane)
  | "verification_outcome"  // verifier → auditor
  | "audit_completed"       // auditor → council
  | "council_consensus"     // council → all
  | "method_improvement"    // improver → MethodProposal store
  | "freeform_note";        // generic operator-readable note

export interface AgentMessage<P = unknown> {
  id: string;
  tenantId: string;
  sender: AgentRole;
  /** null = broadcast. */
  recipient: AgentRole | null;
  kind: AgentMessageKind;
  /** Operator-readable one-line summary (capped at 500 chars by the bus). */
  summary: string;
  /** Structured payload (kind-specific). */
  payload: P;
  /** Stable thread id linking related back-and-forth. */
  threadId?: string;
  publishedAt: string;
}

/** All known roles in declaration order — for the introspection UI. */
export const AGENT_ROLES: AgentRole[] = [
  "detector", "reasoner", "simulator", "policy_gate", "boundary_gate",
  "approver", "verifier", "auditor", "council", "improver",
];

export const AGENT_MESSAGE_KINDS: AgentMessageKind[] = [
  "broadcast_signal", "hypothesis_proposed", "simulation_result",
  "policy_verdict", "boundary_verdict", "approval_request",
  "verification_outcome", "audit_completed", "council_consensus",
  "method_improvement", "freeform_note",
];

const ROLE_SET = new Set<string>(AGENT_ROLES);
const KIND_SET = new Set<string>(AGENT_MESSAGE_KINDS);

export function isAgentRole(v: string): v is AgentRole { return ROLE_SET.has(v); }
export function isAgentMessageKind(v: string): v is AgentMessageKind { return KIND_SET.has(v); }
