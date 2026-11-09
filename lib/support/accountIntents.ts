/**
 * Ask Axiom account-aware help (support roadmap step 3). Pure intent kernel.
 *
 * Maps a signed-in person's question about their own workspace to one fixed,
 * read-only intent. Each intent is a bounded count or status lookup scoped to
 * the caller's accepted membership; there is no free-form query, no write and
 * no cross-workspace read. Unknown questions return null and fall back to the
 * public docs answer.
 */
export const ACCOUNT_INTENTS = ["diagnostic", "access_request", "pending_approvals", "agent_requests", "connections", "audit_integrity", "recent_activity"] as const;
export type AccountIntent = (typeof ACCOUNT_INTENTS)[number];

const RULES: ReadonlyArray<{ intent: AccountIntent; test: RegExp }> = [
  { intent: "diagnostic", test: /\b(diagnos\w*|health ?check|run a check|check (my|our) (workspace|setup)|what'?s wrong|is (anything|something) (wrong|broken)|not working|broken)\b/i },
  { intent: "access_request", test: /\b(need|want|request|get|give me|grant|upgrade)\b.*\b(access|permission|permissions|role|admin|operator)\b|\bwhy can'?t i\b|\bnot allowed\b|\bpermission denied\b/i },
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

export interface DiagnosticFacts {
  connections: { provider: string; status: string }[];
  keysExpiringSoon: number;
  expiredAgentRequests: number;
  oldPendingProposals: number;
  latestSealAt: Date | null;
  now: Date;
}
export interface DiagnosticFinding { severity: "attention" | "info"; text: string; href: string }

/** Pure: turns bounded read-only facts into a short, ordered list of findings. */
export function diagnose(f: DiagnosticFacts): DiagnosticFinding[] {
  const out: DiagnosticFinding[] = [];
  const broken = f.connections.filter((c) => c.status === "revoked" || c.status === "needs_attention" || c.status === "suspended");
  if (broken.length) out.push({ severity: "attention", text: `Connections need attention: ${broken.map((c) => `${c.provider} (${c.status.replace("_", " ")})`).join(", ")}.`, href: "/control/integrations" });
  if (f.keysExpiringSoon > 0) out.push({ severity: "attention", text: `${f.keysExpiringSoon} API key${f.keysExpiringSoon === 1 ? "" : "s"} expire within 7 days. Agents or CI using them will stop.`, href: "/control/api-keys" });
  if (f.expiredAgentRequests > 0) out.push({ severity: "info", text: `${f.expiredAgentRequests} agent request${f.expiredAgentRequests === 1 ? "" : "s"} expired without a decision in the last 7 days.`, href: "/control/agent-gateway" });
  if (f.oldPendingProposals > 0) out.push({ severity: "info", text: `${f.oldPendingProposals} Agent proposal${f.oldPendingProposals === 1 ? " has" : "s have"} waited more than 24 hours for approval.`, href: "/control/governance" });
  const sealAgeDays = f.latestSealAt ? (f.now.getTime() - f.latestSealAt.getTime()) / 86_400_000 : null;
  if (sealAgeDays === null) out.push({ severity: "info", text: "The audit log has never been sealed.", href: "/control/trust-tools" });
  else if (sealAgeDays > 30) out.push({ severity: "info", text: `The audit log was last sealed ${Math.floor(sealAgeDays)} days ago.`, href: "/control/trust-tools" });
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "attention" ? -1 : 1));
}

export interface AccountFacts {
  pendingAgentRequests?: number;
  pendingProposals?: number;
  pendingCloudItems?: number;
  connections?: { provider: string; status: string }[];
  latestSeal?: { sequence: number; at: string } | null;
  recentEvents?: { summary: string; at: string }[];
  findings?: DiagnosticFinding[];
}

/** Turns bounded facts into a short answer with a link to where the person can act. */
export function composeAccountAnswer(intent: AccountIntent, f: AccountFacts): { answer: string; href: string; title: string } {
  switch (intent) {
    case "diagnostic": {
      const list = f.findings ?? [];
      if (list.length === 0) return { answer: "I checked connections, API keys, agent requests, waiting approvals and the audit seal. Nothing needs attention right now. This is a read-only check of saved state, not a live test of each provider.", href: "/control", title: "Control overview" };
      return { answer: `I checked your workspace (read-only, saved state). ${list.slice(0, 5).map((x) => `${x.severity === "attention" ? "⚠ " : ""}${x.text}`).join(" ")}`, href: list[0].href, title: "Fix the first item" };
    }
    case "access_request":
      return { answer: "I can't change roles, but I can send your request to this workspace's admins. Choose the role you need and say why; an admin decides on the Members page.", href: "/control/members", title: "Members" };
    case "agent_requests": {
      const n = f.pendingAgentRequests ?? 0;
      return { answer: n === 0 ? "No AI agent is waiting for approval in this workspace." : `${n} AI agent request${n === 1 ? " is" : "s are"} waiting for a decision. Approvers must not be the person who created the agent's key.`, href: "/control/agent-gateway", title: "Agent gateway" };
    }
    case "pending_approvals": {
      const total = (f.pendingProposals ?? 0) + (f.pendingCloudItems ?? 0) + (f.pendingAgentRequests ?? 0);
      return { answer: total === 0 ? "Nothing is waiting for approval in this workspace." : `Waiting for a decision: ${f.pendingProposals ?? 0} Agent proposals, ${f.pendingCloudItems ?? 0} cloud actions and ${f.pendingAgentRequests ?? 0} external agent requests.`, href: "/control/governance", title: "Approvals" };
    }
    case "connections": {
      const list = f.connections ?? [];
      if (list.length === 0) return { answer: "This workspace has no saved integration connections yet.", href: "/integrations", title: "Integrations" };
      const active = list.filter((c) => c.status === "active").map((c) => c.provider);
      const other = list.filter((c) => c.status !== "active").map((c) => `${c.provider} (${c.status})`);
      return { answer: `Active: ${active.join(", ") || "none"}.${other.length ? ` Not active: ${other.join(", ")}.` : ""} Active means the saved connection last validated; it does not prove every operation works.`, href: "/control/integrations", title: "Integrations" };
    }
    case "audit_integrity":
      return { answer: f.latestSeal ? `The latest audit seal is #${f.latestSeal.sequence} from ${f.latestSeal.at}. Run Verify on Trust tools to check the whole chain now; a seal is evidence, not prevention.` : "The audit log has not been sealed yet. An owner or admin can seal it on Trust tools.", href: "/control/trust-tools", title: "Trust tools" };
    case "recent_activity": {
      const ev = f.recentEvents ?? [];
      return { answer: ev.length === 0 ? "No recorded activity yet." : `Most recent: ${ev.slice(0, 5).map((e) => `${e.summary} (${e.at})`).join("; ")}.`, href: "/control/audit-security", title: "Audit log" };
    }
  }
}
