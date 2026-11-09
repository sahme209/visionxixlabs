/**
 * POST /api/support/account-answer — Ask Axiom account-aware help.
 * Body: { question }
 *
 * Signed-in only. The workspace comes from the session (never the request),
 * and accepted membership is re-checked. Each intent is a fixed, bounded,
 * read-only lookup scoped to that workspace. Returns { answered: false } when
 * the question is not an account question, so the widget keeps the docs answer.
 */
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { checkRateLimit } from "@/lib/rateLimit";
import { classifyAccountIntent, composeAccountAnswer, type AccountFacts, type AccountIntent } from "@/lib/support/accountIntents";

export const dynamic = "force-dynamic";
const iso = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

async function facts(intent: AccountIntent, organizationId: string): Promise<AccountFacts> {
  switch (intent) {
    case "access_request":
      return {};
    case "agent_requests":
      return { pendingAgentRequests: await prisma.agentGatewayRequest.count({ where: { organizationId, status: "pending", expiresAt: { gt: new Date() } } }) };
    case "pending_approvals": {
      const [pendingProposals, pendingCloudItems, pendingAgentRequests] = await Promise.all([
        prisma.agentActionProposal.count({ where: { organizationId, status: "proposed" } }),
        prisma.axiomApprovalItem.count({ where: { organizationId, status: "pending" } }),
        prisma.agentGatewayRequest.count({ where: { organizationId, status: "pending", expiresAt: { gt: new Date() } } }).catch(() => 0),
      ]);
      return { pendingProposals, pendingCloudItems, pendingAgentRequests };
    }
    case "connections": {
      const rows = await prisma.tenantIntegrationConnection.findMany({ where: { organizationId }, select: { provider: true, status: true, revokedAt: true }, take: 50 });
      return { connections: rows.map((r) => ({ provider: r.provider, status: r.revokedAt ? "revoked" : r.status })) };
    }
    case "audit_integrity": {
      const seal = await prisma.auditSeal.findFirst({ where: { organizationId }, orderBy: { sequence: "desc" }, select: { sequence: true, createdAt: true } });
      return { latestSeal: seal ? { sequence: seal.sequence, at: iso(seal.createdAt) } : null };
    }
    case "recent_activity": {
      const rows = await prisma.auditEvent.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 5, select: { summary: true, createdAt: true } });
      return { recentEvents: rows.map((r) => ({ summary: r.summary.slice(0, 120), at: iso(r.createdAt) })) };
    }
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.sessionUserId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  if (!checkRateLimit(`support-account:${ctx.sessionUserId}`)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const organizationId = String(ctx.organizationId);
  if (!await authorizedForOrganization(String(ctx.sessionUserId), organizationId)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 1000) return NextResponse.json({ ok: false, error: "question_required" }, { status: 400 });
  const intent = classifyAccountIntent(question);
  if (!intent) return NextResponse.json({ ok: true, answered: false });
  try {
    const answer = composeAccountAnswer(intent, await facts(intent, organizationId));
    return NextResponse.json({ ok: true, answered: true, intent, answer: answer.answer, sources: [{ title: answer.title, href: answer.href }], scope: "your_workspace_read_only" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "account_data_unavailable" }, { status: 503 });
  }
}
