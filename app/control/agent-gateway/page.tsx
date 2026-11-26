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
import { prisma } from "@/lib/db";
import { ALWAYS_ENFORCED, firewallPosture, type FirewallFinding } from "@/lib/agentGateway/agentFirewallPosture";
import { passportLine } from "@/lib/agentGateway/changePassport";
import { LANE_LABEL } from "@/lib/agentGateway/reviewTriage";

/** Firewall findings from workspace configuration; null when it cannot be read (nothing is guessed). */
async function readFirewallFindings(organizationId: string): Promise<FirewallFinding[] | null> {
  try {
    const [apiKeys, environments] = await Promise.all([
      prisma.apiKey.findMany({ where: { organizationId, revokedAt: null }, take: 500, select: { name: true, scopes: true, expiresAt: true, revokedAt: true } }),
      prisma.environment.findMany({ where: { organizationId }, take: 500, select: { name: true, tier: true, changeWindowRuleJson: true, approvalPolicyId: true } }),
    ]);
    return firewallPosture({ now: new Date(), apiKeys, environments });
  } catch {
    return null;
  }
}

export const metadata: Metadata = { title: "Agent gateway · V19" };
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
  const [requests0, scorecards, firewall] = await Promise.all([listGatewayRequests(organizationId).catch(() => null), listAgentScorecards(organizationId).catch(() => []), readFirewallFindings(organizationId)]);
  const requests = requests0;
  // Names for passport owners and approvers; a lookup failure only shows a generic label.
  const userIds = [...new Set((requests ?? []).flatMap((r) => [r.passport?.ownerUserId, r.decidedByUserId]).filter((v): v is string => typeof v === "string"))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }).catch(() => []) : [];
  const nameOf = (id: string) => { const u = users.find((x) => x.id === id); return u ? u.name || u.email || null : null; };
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <ModuleIntro
        title="Agent gateway"
        explanation="AI agents such as Cursor, Claude Code or your own ask V19 before consequential actions. Review and decide them here."
        helpsYouDo={["See every action an agent asked to take", "Approve or reject consequential actions", "Check reported outcomes against approvals"]}
        connectFirst={["An API key with governance:read and governance:request scopes", "The V19 MCP server (/api/v1/mcp) added to your agent"]}
        aiEngineers={[]}
        approval={{ severity: "human_required", note: "Deploys, merges, infrastructure, data migrations, secrets and deletes need an owner or admin who did not mint the agent's key. Production secret reads and deletes are always refused. Agents self-report actions; this is a cooperative control point, not a sandbox." }}
        storageKey="agent-gateway"
        lastReviewed="2026-11-26"
      />
      <section aria-labelledby="agent-firewall-heading" className="mt-6 rounded-xl border border-white/8 bg-white/2 p-4">
        <h2 id="agent-firewall-heading" className="text-base font-medium text-zinc-100">Agent firewall</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">{ALWAYS_ENFORCED.map((r) => <li key={r.id} className="flex gap-2"><span aria-hidden="true" className="text-emerald-300">✓</span><span>{r.rule}</span></li>)}</ul>
        {firewall === null ? <p role="status" className="mt-3 text-sm text-zinc-400">Workspace keys and environments could not be read, so no findings are shown.</p>
          : firewall.length === 0 ? <p className="mt-3 text-sm text-zinc-400">Nothing in this workspace&apos;s keys or production environments weakens these rules.</p>
          : <ul aria-label="Firewall findings" className="mt-3 space-y-2 text-sm">{firewall.map((f) => (
            <li key={f.id} className={`rounded-lg border p-3 ${f.severity === "warning" ? "border-amber-400/30 bg-amber-400/5" : "border-white/10"}`}>
              <p className={f.severity === "warning" ? "text-amber-200" : "text-zinc-200"}>{f.title}: <span className="font-mono text-xs">{f.subjects.join(", ")}</span></p>
              <p className="mt-1 text-xs text-zinc-400">{f.fix}</p>
            </li>))}</ul>}
      </section>
      {scorecards.length > 0 && <section aria-label="Agent scorecards" className="mt-6">
        <h2 className="text-base font-medium text-zinc-100">Agents</h2>
        <p className="mt-1 text-sm text-zinc-400">Last 90 days. Trust is a summary of evidence and never changes what policy allows.</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{scorecards.map((c) => (
          <li key={c.apiKeyId} className="rounded-xl border border-white/8 bg-white/2 p-4">
            <div className="flex items-baseline justify-between gap-2"><p className="font-mono text-sm text-zinc-200">{c.agentNames.join(", ")}</p><span className={`text-xs ${c.trust === "reliable" ? "text-emerald-300" : c.trust === "needs_review" ? "text-rose-300" : "text-zinc-400"}`}>{TRUST_LABEL[c.trust]}</span></div>
            <p className="mt-2 text-xs leading-5 text-zinc-400">{c.requests} requests · {c.approved} approved · {c.rejected} rejected · {c.denied} denied{c.successRate !== null ? ` · ${Math.round(c.successRate * 100)}% reported success` : ""}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{c.trustReasons[0]}</p>
          </li>))}</ul>
      </section>}
      {requests === null ? <p className="mt-6 text-sm text-zinc-400">Agent requests are unavailable right now.</p>
        : requests.length === 0 ? <p className="mt-6 text-sm text-zinc-400">No agent has asked for anything yet. Add the V19 MCP server to an agent to begin.</p>
        : <ul aria-label="Agent requests" className="mt-6 space-y-3">{requests.map((r) => (
          <li key={r.id} className="rounded-xl border border-white/8 bg-white/2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-zinc-100"><span className="font-mono text-zinc-400">{r.agentName}</span> · {r.actionKind} · {r.environment} · <span className="text-zinc-300">{r.target}</span></p>
              <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[r.status] ?? "text-zinc-400 border-white/10"}`}>{r.status} · {r.riskLevel} risk</span>
            </div>
            {r.triage && <p className="mt-2 text-xs"><span className={`rounded-full border px-2 py-0.5 ${r.triage.lane === "two_person" ? "border-amber-300/40 text-amber-200" : r.triage.lane === "careful" ? "border-white/20 text-zinc-200" : "border-white/10 text-zinc-400"}`}>{LANE_LABEL[r.triage.lane]}</span> <span className="text-zinc-400">{r.triage.reason}</span>{r.awaitingSecondApprover && <span className="text-amber-200"> One admin has approved; a different admin must approve too.</span>}</p>}
            <p className="mt-2 text-sm leading-6 text-zinc-400">{r.summary}</p>
            <p className="mt-1 text-xs text-zinc-500">{r.passport ? <>Passport: {passportLine(r.passport, nameOf)}{r.decidedByUserId ? ` · decided by ${nameOf(r.decidedByUserId) ?? "a workspace admin"}` : ""}</> : "No change passport recorded (requested before passports)."}</p>
            {r.status === "pending" && r.policyDecision === "require_approval" && <AgentGatewayDecision organizationId={organizationId} requestId={r.id} />}
            {r.outcome && <p className="mt-2 text-xs text-zinc-500">Reported outcome: {r.outcome}</p>}
          </li>))}</ul>}
    </div>
  );
}
