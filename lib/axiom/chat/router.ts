import { prisma } from "@/lib/db";
import { classifyIntent } from "./intents";
import { HANDLERS } from "./handlers";
import type { ChatContext, ChatResponse } from "./types";

// ---------------------------------------------------------------------------
// Router — classifies user message and dispatches to the right handler
// ---------------------------------------------------------------------------

export async function routeMessage(
  ctx: ChatContext,
  userMessage: string,
): Promise<ChatResponse> {
  const { intent, params } = classifyIntent(userMessage);

  const handler = HANDLERS[intent] ?? HANDLERS.unknown;
  const response = await handler(ctx, params);

  await persistTurn(ctx, userMessage, response, intent);

  return response;
}

// ---------------------------------------------------------------------------
// Persistence — saves both user and assistant messages
// ---------------------------------------------------------------------------

async function persistTurn(
  ctx: ChatContext,
  userMessage: string,
  response: ChatResponse,
  intent: string,
): Promise<void> {
  try {
    await prisma.axiomMessage.createMany({
      data: [
        {
          conversationId: ctx.conversationId,
          role: "user",
          content: userMessage,
          toolCalls: null,
          toolResults: null,
        },
        {
          conversationId: ctx.conversationId,
          role: "assistant",
          content: response.message,
          toolCalls: response.actions ? JSON.parse(JSON.stringify(response.actions)) : null,
          toolResults: response.data ? JSON.parse(JSON.stringify(response.data)) : null,
        },
      ],
    });
  } catch {
    // Chat persistence failure should never block the response
  }
}

// ---------------------------------------------------------------------------
// Conversation lifecycle
// ---------------------------------------------------------------------------

export async function createConversation(
  userId: string,
  title?: string,
): Promise<string> {
  const convo = await prisma.axiomConversation.create({
    data: { userId, title: title ?? "New conversation" },
  });
  return convo.id;
}

export async function loadConversationHistory(
  conversationId: string,
  limit = 50,
): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
  return prisma.axiomMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { role: true, content: true, createdAt: true },
  });
}
