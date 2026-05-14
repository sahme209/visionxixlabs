/**
 * POST /api/copilot
 *
 * Pure-typed Copilot endpoint. Composes a CopilotResponse from typed platform
 * state — no external LLM call. The web UI POSTs a query + intent and the
 * route returns a structured response with evidence, recommended actions,
 * safety annotations, and doc links.
 *
 * Safety: every response runs through checkResponseSafety() before being
 * returned. Secrets are stripped at the redactForExternalLlm boundary if
 * the response is later forwarded to any external service.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { composeCopilotResponse, type CopilotContext, type CopilotQuery } from "@/lib/agent/operationsCopilot";
import { checkResponseSafety } from "@/lib/agent/copilotSafety";

interface CopilotApiRequest {
  intent?: string;
  question?: string;
  entityId?: string;
  /** Optional client-side context — server still derives state from session. */
  errorContext?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 401 });
  }

  let body: CopilotApiRequest;
  try {
    body = (await req.json()) as CopilotApiRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const intent = validateIntent(body.intent);
  if (!intent) {
    return NextResponse.json(
      { error: "Invalid intent", validIntents: ["next_best_action", "explain_state", "diagnose_error", "explain_plan", "explain_release", "explain_policy", "explain_desktop", "general_help"] },
      { status: 400 }
    );
  }

  // Build context — for now, state is approximated. Real persistence wiring
  // would replace these zeros with Prisma counts.
  const ctx: CopilotContext = {
    organizationId: (session.user as { organizationId?: string }).organizationId ?? userId,
    userId,
    state: {
      connectedClouds: 0,
      pendingApprovals: 0,
      openTasks: 0,
      failedScans24h: 0,
      rollbacksPending: 0,
      releasesBlocked: 0,
      desktopAvailable: false,
      auditExportsLast7d: 0,
    },
    errorContext: body.errorContext,
  };

  const query: CopilotQuery = {
    intent,
    question: body.question ?? "",
    entityId: body.entityId,
  };

  const response = composeCopilotResponse(query, ctx);

  // Safety pass — sanitize and annotate the summary
  const safety = checkResponseSafety(response.summary, {});
  const finalResponse = {
    ...response,
    summary: safety.sanitizedText,
    safetyFlags: safety.flags,
    safetyNotes: safety.notes,
  };

  return NextResponse.json(finalResponse);
}

function validateIntent(intent: string | undefined): CopilotQuery["intent"] | null {
  const valid = ["next_best_action", "explain_state", "diagnose_error", "explain_plan", "explain_release", "explain_policy", "explain_desktop", "general_help"] as const;
  if (!intent) return null;
  return (valid as readonly string[]).includes(intent) ? (intent as CopilotQuery["intent"]) : null;
}
