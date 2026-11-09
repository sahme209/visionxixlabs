/**
 * Ask Axiom account-aware help (support roadmap step 3). Pure intent kernel.
 *
 * Maps a signed-in person's question about their own workspace to one fixed,
 * read-only intent. Each intent is a bounded count or status lookup scoped to
 * the caller's accepted membership; there is no free-form query, no write and
 * no cross-workspace read. Unknown questions return null and fall back to the
 * public docs answer.
 */
export const ACCOUNT_INTENTS = ["pending_approvals", "agent_requests", "connections", "audit_integrity", "recent_activity"] as const;
export type AccountIntent = (typeof ACCOUNT_INTENTS)[number];

const RULES: ReadonlyArray<{ intent: AccountIntent; test: RegExp }> = [
  { intent: "agent_requests", test: /\b(agent|cursor|claude|codex|copilot|mcp|gateway)\b.*\b(request|waiting|pending|approv)|\b(request|waiting|pending)\b.*\bagents?\b/i },
  { intent: "pending_approvals", test: /\b(pending|waiting|need|needs|awaiting|open)\b.*\b(approv|review|decision)|\bapprovals?\b.*\b(pending|waiting|open|queue)\b|what('s| is)? waiting for me/i },
  { intent: "audit_integrity", test: /\b(audit|seal|tamper|integrity)\b/i },
  { intent: "connections", test: /\b(connection|connections|connected|integration|integrations|connector|connectors)\b/i },
  { intent: "recent_activity", test: /\b(recent|latest|last|today|happened|activity|what changed)\b/i },
];

export function classifyAccountIntent(question: string): AccountIntent | null {
  const q = question.slice(0, 500);
  return RULES.find((r) => r.test.test(q))?.intent ?? null;
}

export interface AccountFacts {
  pendingAgentRequests?: number;
  pendingProposals?: number;
  pendingCloudItems?: number;
  connections?: { provider: string; status: string }[];
  latestSeal?: { sequence: number; at: string } | null;
  recentEvents?: { summary: string; at: string }[];
}

/** Turns bounded facts into a short answer with a link to where the person can act. */
export function composeAccountAnswer(intent: AccountIntent, f: AccountFacts): { answer: string; href: string; title: string } {
  switch (intent) {
    case "agent_requests": {
      const n = f.pendingAgentRequests ?? 0;
      return { answer: n === 0 ? "No AI agent is waiting for approval in this workspace." : `${n} AI agent request${n === 1 ? " is" : "s are"} waiting for a decision. Approvers must not be the person who created the agent's key.`, href: "/dashboard/agent-gateway", title: "Agent gateway" };
    }
    case "pending_approvals": {
      const total = (f.pendingProposals ?? 0) + (f.pendingCloudItems ?? 0) + (f.pendingAgentRequests ?? 0);
      return { answer: total === 0 ? "Nothing is waiting for approval in this workspace." : `Waiting for a decision: ${f.pendingProposals ?? 0} Agent proposals, ${f.pendingCloudItems ?? 0} cloud actions and ${f.pendingAgentRequests ?? 0} external agent requests.`, href: "/dashboard/approvals", title: "Approvals" };
    }
    case "connections": {
      const list = f.connections ?? [];
      if (list.length === 0) return { answer: "This workspace has no saved integration connections yet.", href: "/integrations", title: "Integrations" };
      const active = list.filter((c) => c.status === "active").map((c) => c.provider);
      const other = list.filter((c) => c.status !== "active").map((c) => `${c.provider} (${c.status})`);
      return { answer: `Active: ${active.join(", ") || "none"}.${other.length ? ` Not active: ${other.join(", ")}.` : ""} Active means the saved connection last validated; it does not prove every operation works.`, href: "/dashboard/integrations", title: "Integrations" };
    }
    case "audit_integrity":
      return { answer: f.latestSeal ? `The latest audit seal is #${f.latestSeal.sequence} from ${f.latestSeal.at}. Run Verify on Trust tools to check the whole chain now; a seal is evidence, not prevention.` : "The audit log has not been sealed yet. An owner or admin can seal it on Trust tools.", href: "/dashboard/trust-tools", title: "Trust tools" };
    case "recent_activity": {
      const ev = f.recentEvents ?? [];
      return { answer: ev.length === 0 ? "No recorded activity yet." : `Most recent: ${ev.slice(0, 5).map((e) => `${e.summary} (${e.at})`).join("; ")}.`, href: "/dashboard/audit", title: "Audit log" };
    }
  }
}
