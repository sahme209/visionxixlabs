/**
 * POST /api/desktop/agent/conversations/[id]/messages
 *
 * The core of the agent runtime: persists the user's message, runs the
 * decision loop (lib/axiom/agentRuntime/decisionLoop.ts), and persists
 * whatever comes back — a final reply, or a proposal a human must
 * approve before anything in GitHub or AWS actually changes. Every
 * low-risk tool call the loop made along the way is already reflected
 * in a real AgentActionProposal row (status "executed") by the time
 * this returns, for a complete audit trail even for read-only actions.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { runDecisionLoop, type ConversationTurnInput } from "@/lib/axiom/agentRuntime/decisionLoop";
import { executeReadOnlyTool, isProdEnvironmentTarget, type ToolExecutionRepo, type ProdEnvironmentCheckRepo } from "@/lib/axiom/agentRuntime/toolExecution";
import { id as idFactory } from "@/lib/domain/ids";
import { loadWorkspaceMemory, rememberToolContext, workspaceMemoryPrompt, type WorkspaceMemoryRepo } from "@/lib/axiom/agentRuntime/workspaceMemory";
import { prepareProposalArgsForReview } from "@/lib/axiom/agentRuntime/proposalReview";
import { parseSkillInvocation, resolveInstalledSkillContext, type AgentSkillRepo } from "@/lib/axiom/agentRuntime/skillCatalog";
import { parseRepositoryFullName } from "@/lib/connectors/github/resolveTenantScopedToken";
import { isSafeRepositoryPath } from "@/lib/connectors/github/githubWriteClient";
import type { InitialReadOnlyToolCall } from "@/lib/axiom/agentRuntime/decisionLoop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AI_ERROR_MESSAGES: Record<string, string> = {
  workspace_ai_disabled: "AI isn't enabled for this workspace yet. A workspace admin can turn it on under AI provider settings.",
  workspace_ai_provider_unavailable: "No AI provider is approved for this workspace. A workspace admin needs to approve one first.",
  workspace_ai_model_not_allowed: "That model is not enabled for this workspace. Choose an enabled model or ask a workspace admin to update Models.",
  workspace_ai_policy_unavailable: "Couldn't load this workspace's AI provider policy right now. Try again shortly.",
  workspace_ai_credit_meter_unavailable: "Couldn't verify remaining AI usage for this workspace right now. Try again shortly.",
  workspace_ai_credit_pool_exhausted: "This workspace has used its available AI credits for this period.",
  decision_malformed: "I couldn't form a safe action from the model response after retrying. No change was made. Try once more or choose a different enabled model.",
  max_iterations_exceeded: "This request needed too many steps to resolve — try breaking it into a smaller request.",
};

function initialRepositoryGrounding(input: {
  message: string;
  mode: "chat" | "code";
  repositoryFullName: string;
  branch: string;
  filePath: string;
}): InitialReadOnlyToolCall | undefined {
  if (!input.repositoryFullName || !input.branch) return undefined;
  if (input.mode === "code" && input.filePath) {
    return {
      toolName: "read_github_file",
      args: { repositoryFullName: input.repositoryFullName, branch: input.branch, path: input.filePath },
      message: `Inspecting ${input.filePath} on ${input.repositoryFullName}@${input.branch} before answering.`,
    };
  }

  const broadRepositoryIntent = /\b(review|analy[sz]e|audit|inspect|improve|issues?|problems?|changes?|help)\b|what should i|what can i/i.test(input.message);
  if (!broadRepositoryIntent) return undefined;
  return {
    toolName: "inspect_github_repository",
    args: { repositoryFullName: input.repositoryFullName, branch: input.branch },
    message: `Reading high-signal files from ${input.repositoryFullName}@${input.branch} before answering.`,
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/agent/conversations/[id]/messages",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const organizationId = String(session.organizationId);
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, organizationId, userId: String(session.userId) },
  });
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
    preferredProvider?: unknown;
    workspaceContext?: {
      repositoryFullName?: unknown;
      branch?: unknown;
      environmentId?: unknown;
      filePath?: unknown;
      mode?: unknown;
      operationMode?: unknown;
    };
  } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const preferredProvider = typeof body?.preferredProvider === "string" ? body.preferredProvider : undefined;
  if (!message) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const rawContext = body?.workspaceContext;
  const repositoryFullName = typeof rawContext?.repositoryFullName === "string" ? rawContext.repositoryFullName.trim() : "";
  const branch = typeof rawContext?.branch === "string" ? rawContext.branch.trim() : "";
  const environmentId = typeof rawContext?.environmentId === "string" ? rawContext.environmentId.trim() : "";
  const filePath = typeof rawContext?.filePath === "string" ? rawContext.filePath.trim() : "";
  const mode = rawContext?.mode === "code" ? "code" : "chat";
  const operationMode = rawContext?.operationMode === "ask" || rawContext?.operationMode === "plan"
    ? rawContext.operationMode
    : "agent";
  if ((repositoryFullName && !parseRepositoryFullName(repositoryFullName)) || branch.length > 240 || /[\0\r\n]/.test(branch)) {
    return NextResponse.json({ ok: false, error: "invalid_workspace_context" }, { status: 400 });
  }
  if (filePath && (!isSafeRepositoryPath(filePath) || /[\r\n]/.test(filePath))) {
    return NextResponse.json({ ok: false, error: "invalid_workspace_context" }, { status: 400 });
  }
  const selectedEnvironment = environmentId
    ? await prisma.environment.findFirst({ where: { id: environmentId, organizationId }, select: { id: true, name: true, tier: true } })
    : null;
  if (environmentId && !selectedEnvironment) {
    return NextResponse.json({ ok: false, error: "invalid_workspace_context" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.agentConversationTurn.create({ data: { conversationId, role: "user", content: message } }),
    prisma.agentConversation.update({
      where: { id: conversationId },
      data: {
        title: conversation.title ?? message.replace(/\s+/g, " ").slice(0, 80),
        updatedAt: new Date(),
      },
    }),
  ]);

  const invokedSkillId = parseSkillInvocation(message);
  let skillContext: string;
  try {
    const resolvedSkills = await resolveInstalledSkillContext(prisma as unknown as AgentSkillRepo, organizationId, invokedSkillId);
    if (!resolvedSkills.ok) {
      const reply = resolvedSkills.error === "unknown_skill"
        ? `/${resolvedSkills.skillId} is not a reviewed Axiom skill.`
        : `/${resolvedSkills.skillId} is not enabled for this workspace. Add or enable it under Plugins & Skills first.`;
      await prisma.agentConversationTurn.create({ data: { conversationId, role: "assistant", content: reply } });
      return NextResponse.json({ ok: true, data: { reply, proposal: null } });
    }
    skillContext = resolvedSkills.prompt;
  } catch {
    if (invokedSkillId) {
      const reply = "I couldn't verify that skill's workspace installation, so I did not send this request to an AI provider. Try again shortly.";
      await prisma.agentConversationTurn.create({ data: { conversationId, role: "assistant", content: reply } });
      return NextResponse.json({ ok: true, data: { reply, proposal: null } });
    }
    skillContext = "Skills are temporarily unavailable; continue using the fixed governed tool registry only.";
  }

  const priorTurns = await prisma.agentConversationTurn.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  const transcript: ConversationTurnInput[] = priorTurns.map((t) => ({ role: t.role as ConversationTurnInput["role"], content: t.content }));
  const selectedContext = [
    repositoryFullName ? `Repository: ${repositoryFullName}` : null,
    branch ? `Branch: ${branch}` : null,
    selectedEnvironment ? `Environment: ${selectedEnvironment.name} (${selectedEnvironment.tier}, ID ${selectedEnvironment.id})` : null,
    filePath ? `File: ${filePath}` : null,
    `Operation mode: ${operationMode}`,
  ].filter((value): value is string => Boolean(value));
  let currentRequestContext: string | undefined;
  if (selectedContext.length > 0 && transcript.length > 0) {
    const instruction = mode === "code"
      ? "The user selected Edit repository file mode. Read the selected file first. If a change is needed, propose commit_github_file with the complete updated content and a clear commit message. Never claim the write completed before approval."
      : "Use these selections for this request. Do not ask the user to repeat identifiers already selected.";
    currentRequestContext = `${selectedContext.join("\n")}\n${instruction}`;
  }

  const correlationId = idFactory.correlation(`agent_msg_${Date.now().toString(36)}`);
  const memoryRepo = prisma as unknown as WorkspaceMemoryRepo;
  const workspaceContext = workspaceMemoryPrompt(await loadWorkspaceMemory(memoryRepo, organizationId));
  const outcome = await runDecisionLoop({
    organizationId,
    correlationId: String(correlationId),
    transcript,
    workspaceContext,
    currentRequestContext,
    skillContext,
    preferredProvider,
    operationMode,
    initialToolCall: initialRepositoryGrounding({ message, mode, repositoryFullName, branch, filePath }),
    executeReadOnlyTool: async (toolName, args) => {
      const result = await executeReadOnlyTool(prisma as unknown as ToolExecutionRepo, organizationId, toolName, args);
      if (result.ok) await rememberToolContext(memoryRepo, organizationId, args).catch(() => undefined);
      // Every tool call — including read-only ones — gets its own audit
      // row, immediately marked executed, so "what did the agent look
      // at" is as visible in the trail as "what did it change."
      await prisma.agentActionProposal.create({
        data: {
          organizationId, conversationId, proposedByUserId: String(session.userId),
          toolName, argsJson: args as Prisma.InputJsonValue, riskLevel: "low",
          status: result.ok ? "executed" : "failed",
          resultJson: result.ok ? (result.result as Prisma.InputJsonValue) : undefined,
          errorMessage: result.ok ? null : result.error,
          executedAt: new Date(),
        },
      });
      return result;
    },
    isProdEnvironmentTarget: (toolName, args) => isProdEnvironmentTarget(prisma as unknown as ProdEnvironmentCheckRepo, organizationId, args),
  });

  if (outcome.kind === "final") {
    await prisma.agentConversationTurn.create({ data: { conversationId, role: "assistant", content: outcome.message } });
    return NextResponse.json({ ok: true, data: { reply: outcome.message, proposal: null } });
  }

  if (outcome.kind === "proposal") {
    const reviewed = await prepareProposalArgsForReview(organizationId, outcome.toolName, outcome.args);
    if (!reviewed.ok) {
      const reply = `I couldn't prepare a trustworthy approval preview, so no action was proposed. ${reviewed.error}`;
      await prisma.agentConversationTurn.create({ data: { conversationId, role: "assistant", content: reply } });
      return NextResponse.json({ ok: true, data: { reply, proposal: null } });
    }
    await rememberToolContext(memoryRepo, organizationId, reviewed.args).catch(() => undefined);
    await prisma.agentConversationTurn.create({ data: { conversationId, role: "assistant", content: outcome.message } });
    const proposal = await prisma.agentActionProposal.create({
      data: {
        organizationId, conversationId, proposedByUserId: String(session.userId),
        toolName: outcome.toolName, argsJson: reviewed.args as Prisma.InputJsonValue, riskLevel: outcome.riskLevel, status: "proposed",
      },
    });
    return NextResponse.json({
      ok: true,
      data: {
        reply: outcome.message,
        proposal: { id: proposal.id, toolName: proposal.toolName, argsJson: proposal.argsJson, riskLevel: proposal.riskLevel, status: proposal.status },
      },
    });
  }

  const reply = AI_ERROR_MESSAGES[outcome.error] ?? "Something went wrong processing that request.";
  await prisma.agentConversationTurn.create({ data: { conversationId, role: "assistant", content: reply } });
  return NextResponse.json({ ok: true, data: { reply, proposal: null } });
}
