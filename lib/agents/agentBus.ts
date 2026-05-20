/**
 * Agent message bus.
 *
 * Two-layer: in-memory pub/sub for low-latency intra-cycle fan-out
 * (think microseconds) + best-effort Prisma audit for durable
 * "who told what to whom" weeks later.
 *
 * Hard rules:
 *   - publishMessage NEVER throws on persistence failure — the loop
 *     stays alive even when Postgres is unreachable.
 *   - Subscribers run sequentially in publish order; one slow
 *     subscriber doesn't deadlock the next.
 *   - Subscriber errors are swallowed (logged via reason field on
 *     the AgentMessage payload when relevant) — agents shouldn't
 *     poison each other.
 *   - Per-cycle bounded buffer (cap 500) prevents a runaway agent
 *     from blowing memory.
 *
 * The bus is intentionally untyped at the payload boundary —
 * callers pass kind + payload, listeners narrow by kind. This is
 * the same trade Redis pub/sub makes.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  isAgentMessageKind,
  isAgentRole,
  type AgentMessage,
  type AgentMessageKind,
  type AgentRole,
} from "./agentBusModel";

const MAX_IN_MEMORY = 500;
const IN_MEMORY: AgentMessage[] = [];
type Subscriber = (msg: AgentMessage) => void | Promise<void>;
const SUBSCRIBERS = new Set<Subscriber>();

export interface PublishInput<P> {
  tenantId: string;
  sender: AgentRole;
  recipient?: AgentRole | null;
  kind: AgentMessageKind;
  summary: string;
  payload: P;
  threadId?: string;
}

export async function publishAgentMessage<P>(input: PublishInput<P>): Promise<AgentMessage<P>> {
  if (!isAgentRole(input.sender)) {
    throw new Error(`publishAgentMessage: invalid sender '${input.sender}'`);
  }
  if (input.recipient && !isAgentRole(input.recipient)) {
    throw new Error(`publishAgentMessage: invalid recipient '${input.recipient}'`);
  }
  if (!isAgentMessageKind(input.kind)) {
    throw new Error(`publishAgentMessage: invalid kind '${input.kind}'`);
  }

  const msg: AgentMessage<P> = {
    id: randomUUID(),
    tenantId: input.tenantId,
    sender: input.sender,
    recipient: input.recipient ?? null,
    kind: input.kind,
    summary: input.summary.slice(0, 500),
    payload: input.payload,
    threadId: input.threadId,
    publishedAt: new Date().toISOString(),
  };

  // 1. In-memory ring buffer (synchronous; loop sees the message immediately).
  IN_MEMORY.push(msg as AgentMessage);
  if (IN_MEMORY.length > MAX_IN_MEMORY) IN_MEMORY.shift();

  // 2. Fan out to subscribers — never let one bad subscriber poison the rest.
  for (const sub of SUBSCRIBERS) {
    try {
      await sub(msg as AgentMessage);
    } catch {
      // Best-effort delivery.
    }
  }

  // 3. Persist — fire-and-forget. Loop must not block on DB.
  void persistMessage(msg as AgentMessage);

  return msg;
}

async function persistMessage(msg: AgentMessage): Promise<void> {
  try {
    await prisma.agentBusMessage.create({
      data: {
        id: msg.id,
        organizationId: msg.tenantId,
        sender: msg.sender,
        recipient: msg.recipient,
        kind: msg.kind,
        summary: msg.summary,
        payload: msg.payload as unknown as object,
        threadId: msg.threadId ?? null,
      },
    });
  } catch {
    // Best-effort.
  }
}

/** Register a subscriber. Returns the unsubscribe handle. */
export function subscribeToAgentBus(sub: Subscriber): () => void {
  SUBSCRIBERS.add(sub);
  return () => SUBSCRIBERS.delete(sub);
}

/** In-memory tail — last N messages (newest first). */
export function readAgentBusTail(opts?: {
  tenantId?: string;
  limit?: number;
  threadId?: string;
}): AgentMessage[] {
  const limit = Math.max(1, Math.min(opts?.limit ?? 100, MAX_IN_MEMORY));
  const filtered = IN_MEMORY.filter((m) => {
    if (opts?.tenantId && m.tenantId !== opts.tenantId) return false;
    if (opts?.threadId && m.threadId !== opts.threadId) return false;
    return true;
  });
  return filtered.slice(-limit).reverse();
}

/** Wipe the in-memory buffer. Tests + admins only. */
export function clearAgentBus(): number {
  const n = IN_MEMORY.length;
  IN_MEMORY.length = 0;
  return n;
}

/** Read the durable bus history from Prisma (for the dashboard). */
export async function readDurableAgentBus(opts: {
  organizationId: string;
  limit?: number;
  threadId?: string;
}): Promise<Array<Pick<AgentMessage, "id" | "sender" | "recipient" | "kind" | "summary" | "threadId" | "publishedAt">>> {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  try {
    const rows = await prisma.agentBusMessage.findMany({
      where: {
        organizationId: opts.organizationId,
        ...(opts.threadId ? { threadId: opts.threadId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        sender: true,
        recipient: true,
        kind: true,
        summary: true,
        threadId: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      sender: r.sender as AgentRole,
      recipient: (r.recipient ?? null) as AgentRole | null,
      kind: r.kind as AgentMessageKind,
      summary: r.summary,
      threadId: r.threadId ?? undefined,
      publishedAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
