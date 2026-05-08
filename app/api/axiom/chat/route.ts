/**
 * POST /api/axiom/chat
 *
 * Agent chat endpoint. Accepts a user message, classifies intent,
 * queries stored run/finding/recommendation data, and returns a
 * structured response with optional action buttons.
 *
 * Body: {
 *   message: string,
 *   conversationId?: string,
 *   organizationId: string,
 *   provider?: "aws" | "azure" | "gcp",
 *   activeRunId?: string,
 *   activeAccountId?: string,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import {
  routeMessage,
  createConversation,
  type ChatContext,
} from "@/lib/axiom/chat";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as { id?: string }).id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
    if (!entitlements.axiomExecution) {
      return NextResponse.json(
        { error: "Scale or Enterprise plan required." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { message, conversationId, organizationId, provider, activeRunId, activeAccountId } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const convoId = conversationId ?? await createConversation(userId, message.slice(0, 80));

    const ctx: ChatContext = {
      organizationId,
      userId,
      conversationId: convoId,
      provider: provider ?? undefined,
      activeRunId: activeRunId ?? undefined,
      activeAccountId: activeAccountId ?? undefined,
    };

    const response = await routeMessage(ctx, message.trim());

    return NextResponse.json({
      conversationId: convoId,
      ...response,
    });
  } catch (e) {
    console.error("[axiom chat]", e);
    return NextResponse.json({ error: "Chat request failed" }, { status: 500 });
  }
}
