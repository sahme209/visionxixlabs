/**
 * Axiom chat persistence — conversation and message storage for "Ask Axiom".
 */

import { prisma } from "@/lib/db";

export type CreateConversationInput = {
  userId?: string | null;
  leadId?: string | null;
  title?: string | null;
};

export type AppendMessageInput = {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: unknown;
  toolResults?: unknown;
};

const DEFAULT_MESSAGE_LIMIT = 50;

/**
 * Create a new Axiom conversation.
 */
export async function createConversation(input: CreateConversationInput) {
  return prisma.axiomConversation.create({
    data: {
      userId: input.userId ?? undefined,
      leadId: input.leadId ?? undefined,
      title: input.title ?? undefined,
    },
  });
}

/**
 * Append a message to an existing conversation.
 */
export async function appendMessage(
  conversationId: string,
  input: AppendMessageInput
) {
  return prisma.axiomMessage.create({
    data: {
      conversationId,
      role: input.role,
      content: input.content,
      toolCalls: input.toolCalls ? (input.toolCalls as object) : undefined,
      toolResults: input.toolResults ? (input.toolResults as object) : undefined,
    },
  });
}

/**
 * Get a conversation with its last N messages (oldest first within the window).
 */
export async function getConversation(
  conversationId: string,
  messageLimit: number = DEFAULT_MESSAGE_LIMIT
) {
  const conversation = await prisma.axiomConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) return null;

  const total = await prisma.axiomMessage.count({
    where: { conversationId },
  });
  const skip = Math.max(0, total - messageLimit);

  const messages = await prisma.axiomMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    skip,
    take: messageLimit,
  });

  return { ...conversation, messages };
}
