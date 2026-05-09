import { prisma } from "@/lib/db";
import { classifyIntent } from "./intents";
import { HANDLERS } from "./handlers";
import type { ChatContext, ChatResponse } from "./types";
import {
  extractEntities,
  resolveContext,
  advanceState,
  emptyConversationState,
  type ConversationState,
} from "./conversationContext";

// ---------------------------------------------------------------------------
// In-memory conversation state cache (per conversationId)
// ---------------------------------------------------------------------------

const stateCache = new Map<string, ConversationState>();

function getState(conversationId: string): ConversationState {
  return stateCache.get(conversationId) ?? emptyConversationState();
}

function setState(conversationId: string, state: ConversationState): void {
  stateCache.set(conversationId, state);
  if (stateCache.size > 1000) {
    const oldest = stateCache.keys().next().value;
    if (oldest) stateCache.delete(oldest);
  }
}

// ---------------------------------------------------------------------------
// Router — classifies user message and dispatches to the right handler
//
// Multi-turn context resolution:
//   1. Extract entities from the current message (provider, time, refs)
//   2. Merge with prior conversation state (inherit provider if not specified)
//   3. Pass resolved params to handler
//   4. Advance state for next turn
// ---------------------------------------------------------------------------

export async function routeMessage(
  ctx: ChatContext,
  userMessage: string,
): Promise<ChatResponse> {
  const { intent, params } = classifyIntent(userMessage);

  // Multi-turn context: merge extracted entities with prior state
  const state = getState(ctx.conversationId);
  const entities = extractEntities(userMessage);
  const resolved = resolveContext(entities, state);

  // Enrich params with resolved context (explicit params win over resolved)
  if (!params.provider && resolved.provider) params.provider = resolved.provider;
  if (!params.itemRef && resolved.itemRef) params.itemRef = resolved.itemRef;

  const handler = HANDLERS[intent] ?? HANDLERS.unknown;
  const response = await handler(ctx, params);

  // Advance conversation state
  const nextState = advanceState(state, intent, entities);
  setState(ctx.conversationId, nextState);

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
