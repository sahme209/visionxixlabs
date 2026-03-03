/**
 * POST /api/cloud-operator/chat
 * Ask Axiom — chat with AI DevOps assistant.
 * Auth: session OR lead token (same as /api/cloud-operator/status).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { redactSecrets } from "@/lib/security/secretRedaction";
import { createConversation } from "@/lib/axiomChat/storage";
import { runAxiomAssistantAgent } from "@/lib/agents/axiomAssistantAgent";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  let body: { conversationId?: string; message?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 10000) {
    return NextResponse.json(
      { error: "message required, max 10000 chars" },
      { status: 400 }
    );
  }

  const rawMessage = message;
  const sanitizedMessage = redactSecrets(rawMessage);

  let leadId: string;
  let userId: string | null = null;

  const session = await getServerSession(authOptions);
  if (session?.user && (session.user as { id?: string }).id) {
    userId = (session.user as { id: string }).id;
  }

  const token = typeof body.token === "string" ? body.token.trim() : null;
  if (token) {
    const result = verifyStarterToken(token);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error === "expired" ? "Token expired" : "Invalid token" },
        { status: 401 }
      );
    }
    leadId = result.leadId;
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { source: true, userId: true },
    });
    if (!lead || lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (lead.userId && !userId) userId = lead.userId;
  } else if (userId) {
    const lead = await prisma.lead.findFirst({
      where: { userId, source: "cloud-operator" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json(
        { error: "No Cloud Operator session. Use a token or complete the flow first." },
        { status: 404 }
      );
    }
    leadId = lead.id;
  } else {
    return NextResponse.json(
      { error: "Token or session required" },
      { status: 401 }
    );
  }

  const rateLimitKey = `axiom-chat:${leadId || ip}`;
  if (!checkRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  let conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : null;

  if (!conversationId) {
    const conv = await createConversation({
      leadId,
      userId,
      title: null,
    });
    conversationId = conv.id;
  } else {
    const existing = await prisma.axiomConversation.findUnique({
      where: { id: conversationId },
      select: { leadId: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (existing.leadId !== leadId) {
      return NextResponse.json({ error: "Conversation does not belong to this session" }, { status: 403 });
    }
  }

  try {
    const output = await runAxiomAssistantAgent({
      conversationId,
      userId,
      leadId,
      message: sanitizedMessage,
    });

    return NextResponse.json({
      conversationId,
      assistantMessage: output.assistantMessage,
      toolResultsSummary: output.toolResultsSummary,
      actions: output.actions,
      plan: output.plan,
      requiresApproval: output.requiresApproval,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Chat failed";
    return NextResponse.json(
      { error: "Failed to process message. Please try again." },
      { status: 500 }
    );
  }
}
