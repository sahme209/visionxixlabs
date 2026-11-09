/**
 * /control/agent-gateway — Agent governance gateway (A10).
 * Workspace members see what AI agents asked to do; owners and admins
 * approve or reject pending requests. Agents use /api/v1/mcp or the
 * /api/v1/governance REST endpoints with a governance-scoped API key.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { listAgentScorecards, listGatewayRequests } from "@/lib/agentGateway/gatewayService";
import { ModuleIntro } from "@/components/portal/ModuleIntro";
import { AgentGatewayDecision } from "@/components/agentGateway/AgentGatewayDecision";

export const metadata: Metadata = { title: "Agent gateway · Axiom" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  pending: "text-amber-200 border-amber-300/30", approved: "text-emerald-300 border-emerald-400/30", rejected: "text-rose-300 border-rose-400/30",
  completed: "text-zinc-300 border-white/15", failed: "text-rose-300 border-rose-400/30", expired: "text-zinc-500 border-white/10",
};

const TRUST_LABEL: Record<string, string> = { new: "New", building: "Building a record", reliable: "Reliable", needs_review: "Needs review" };

export default async function AgentGatewayPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) redirect("/auth/signin?callbackUrl=%2Fcontrol%2Fagent-gateway");
  const organizationId = String(ctx.organizationId);
  const [requests, scorecards] = await Promise.all([listGatewayRequests(organizationId).catch(() => null), listAgentScorecards(organizationId).catch(() => [])]);
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <ModuleIntro
        title="Agent gateway"
        explanation="AI agents such as Cursor, Claude Code or your own ask Axiom before consequential actions. Review and decide them here."
        helpsYouDo={["See every action an agent asked to take", "Approve or reject consequential actions", "Check reported outcomes against approvals"]}
        connectFirst={["An API key with governance:read and governance:request scopes", "The Axiom MCP server (/api/v1/mcp) added to your agent"]}
        aiEngineers={[]}
        approval={{ severity: "human_required", note: "Deploys, merges, infrastructure, data migrations, secrets and deletes need an owner or admin who did not mint the agent's key. Production secret reads and deletes are always refused. Agents self-report actions; this is a cooperative control point, not a sandbox." }}
        storageKey="agent-gateway"
        lastReviewed="2026-11-09"
      />
      {scorecards.length > 0 && <section aria-label="Agent scorecards" className="mt-6">
        <h2 className="text-base font-medium text-zinc-100">Agents</h2>
        <p className="mt-1 text-sm text-zinc-400">Last 90 days. Trust is a summary of evidence and never changes what policy allows.</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{scorecards.map((c) => (
          <li key={c.apiKeyId} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-baseline justify-between gap-2"><p className="font-mono text-sm text-zinc-200">{c.agentNames.join(", ")}</p><span className={`text-xs ${c.trust === "reliable" ? "text-emerald-300" : c.trust === "needs_review" ? "text-rose-300" : "text-zinc-400"}`}>{TRUST_LABEL[c.trust]}</span></div>
            <p className="mt-2 text-xs leading-5 text-zinc-400">{c.requests} requests · {c.approved} approved · {c.rejected} rejected · {c.denied} denied{c.successRate !== null ? ` · ${Math.round(c.successRate * 100)}% reported success` : ""}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{c.trustReasons[0]}</p>
          </li>))}</ul>
      </section>}
      {requests === null ? <p className="mt-6 text-sm text-zinc-400">Agent requests are unavailable right now.</p>
        : requests.length === 0 ? <p className="mt-6 text-sm text-zinc-400">No agent has asked for anything yet. Add the Axiom MCP server to an agent to begin.</p>
        : <ul aria-label="Agent requests" className="mt-6 space-y-3">{requests.map((r) => (
          <li key={r.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-zinc-100"><span className="font-mono text-zinc-400">{r.agentName}</span> · {r.actionKind} · {r.environment} · <span className="text-zinc-300">{r.target}</span></p>
              <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[r.status] ?? "text-zinc-400 border-white/10"}`}>{r.status} · {r.riskLevel} risk</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{r.summary}</p>
            {r.status === "pending" && r.policyDecision === "require_approval" && <AgentGatewayDecision organizationId={organizationId} requestId={r.id} />}
            {r.outcome && <p className="mt-2 text-xs text-zinc-500">Reported outcome: {r.outcome}</p>}
          </li>))}</ul>}
    </div>
  );
}
