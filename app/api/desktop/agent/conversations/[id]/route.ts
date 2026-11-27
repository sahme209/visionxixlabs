/**
 * GET /api/desktop/agent/conversations/[id]
 *
 * Reopens a conversation: all turns plus every action proposal ever
 * raised in it (with current status), scoped to the caller's org.
 */

import { readChangePassport } from "@/lib/agentGateway/changePassport";
import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { redactSensitiveRepositoryEvidence } from "@/lib/axiom/agentRuntime/repositoryEvidenceRedaction";
import { deploymentWindowNow } from "@/lib/releaseops/deploymentWindowNow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/agent/conversations/[id]",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await prisma.agentConversation.findFirst({
    where: {
      id,
      organizationId: String(session.organizationId),
      userId: String(session.userId),
    },
  });
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const [turns, actions] = await Promise.all([
    prisma.agentConversationTurn.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } }),
    prisma.agentActionProposal.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  // For proposals still awaiting a decision that name an environment, show whether its change window
  // would allow the deployment right now. Advisory only: the gate is evaluated again at dispatch.
  const pendingEnvIds = [...new Set(actions.filter((a) => a.status === "proposed").map((a) => environmentIdOf(a.argsJson)).filter((v): v is string => v !== null))];
  const windows = new Map<string, Record<string, unknown>>();
  if (pendingEnvIds.length) {
    const now = new Date();
    const envs = await prisma.environment.findMany({ where: { id: { in: pendingEnvIds.slice(0, 50) }, organizationId: String(session.organizationId) }, select: { id: true, name: true, changeWindowRuleJson: true } }).catch(() => []);
    for (const e of envs) windows.set(e.id, { environment: e.name, ...deploymentWindowNow(e.changeWindowRuleJson, now) });
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: conversation.id,
      title: conversation.title,
      turns: turns.map((t) => ({ id: t.id, role: t.role, content: t.content, actionProposalId: t.actionProposalId, createdAt: t.createdAt.toISOString() })),
      actions: actions.map((a) => ({
        id: a.id, requiresIndependentReviewer: a.proposedByUserId === String(session.userId), toolName: a.toolName, argsJson: redactSensitiveRepositoryEvidence(a.argsJson), riskLevel: a.riskLevel, status: a.status,
        resultJson: redactSensitiveRepositoryEvidence(a.resultJson), errorMessage: a.errorMessage, createdAt: a.createdAt.toISOString(),
        deploymentWindow: a.status === "proposed" ? windows.get(environmentIdOf(a.argsJson) ?? "") ?? null : null,
        passport: (() => { const p = readChangePassport(a.passport); return p ? { agent: p.agent, model: p.model, tools: p.tools, digest: p.digest } : null; })(),
      })),
    },
  });
}

function environmentIdOf(args: unknown): string | null {
  const v = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>).environmentId : null;
  return typeof v === "string" && v.length > 0 && v.length <= 64 ? v : null;
}
