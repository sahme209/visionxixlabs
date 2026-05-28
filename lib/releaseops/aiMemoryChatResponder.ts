/**
 * Phase 529 — Persisted AGI chat-turn responder.
 *
 * Three surfaces:
 *   • persistChatTurn — best-effort write, returns null on failure so
 *     the chat response is never blocked by persistence problems.
 *   • buildChatHistoryResponse — paginated list of recent turns.
 *   • buildChatTurnDeleteResponse — operator clears a turn from the
 *     archive (e.g. accidentally typed PII into the question).
 *
 * Closed-union state: each turn is immutable after write — the only
 * mutation is delete.
 */

import { isMissingTable } from "./releaseListResponder";
import type { ChatAnswer } from "./aiMemoryChatEngine";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ChatTurnRow {
  id: string;
  organizationId: string;
  userId: string | null;
  question: string;
  answer: string;
  citationsJson: unknown;
  /** Phase 530 — rich CitationDetail array. Nullable for rows persisted
   *  before the 20260528180000 migration. */
  citationDetailsJson?: unknown;
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  contextEntriesCount: number;
  contextSummariesCount: number;
  engineVersion: string;
  generatedAt: Date;
}

export interface ChatTurnRepo {
  aiMemoryChatTurn: {
    create(args: {
      data: {
        organizationId: string;
        userId: string | null;
        question: string;
        answer: string;
        citationsJson: unknown;
        /** Phase 530 — optional so callers from before this migration
         *  still type-check; the Prisma client tolerates undefined. */
        citationDetailsJson?: unknown;
        outcome: string;
        errorMessage: string | null;
        modelHint: string | null;
        contextEntriesCount: number;
        contextSummariesCount: number;
        engineVersion: string;
      };
    }): Promise<ChatTurnRow>;
    findMany(args: {
      where: { organizationId: string; userId?: string | null };
      orderBy: { generatedAt: "desc" };
      take?: number;
    }): Promise<ChatTurnRow[]>;
    findUnique(args: { where: { id: string } }): Promise<ChatTurnRow | null>;
    delete(args: { where: { id: string } }): Promise<ChatTurnRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Views.
   ────────────────────────────────────────────────────────────── */

/** Phase 530 — rehydrated citation context the dashboard renders
 *  alongside the answer. Mirrors the shape the /agi-memory-ask
 *  ephemeral response returns. */
export interface ChatCitationDetailView {
  citationId: string;
  kind: "entry" | "summary";
  targetKind: string | null;
  targetId: string | null;
  narrative: string;
  generatedAtIso: string;
}

export interface ChatTurnView {
  id: string;
  userId: string | null;
  question: string;
  answer: string;
  citations: string[];
  /** Phase 530 — empty array when the row predates the migration
   *  OR the persist path stored an empty citation list. */
  citationDetails: ChatCitationDetailView[];
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  contextEntriesCount: number;
  contextSummariesCount: number;
  engineVersion: string;
  generatedAtIso: string;
}

export interface HistoryData {
  generatedAt: string;
  turns: ChatTurnView[];
  summary: {
    total: number;
    aiGenerated: number;
    fallbackRules: number;
    errored: number;
  };
}

export type ApiResponse<T> =
  | { status: number; body: { ok: true; data: T } }
  | { status: number; body: { ok: false; error: string; hint?: string } };

/* ──────────────────────────────────────────────────────────────────
   Helpers.
   ────────────────────────────────────────────────────────────── */

function toStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    const out: string[] = [];
    for (const item of input) if (typeof item === "string") out.push(item);
    return out;
  }
  return [];
}

function toCitationDetails(input: unknown): ChatCitationDetailView[] {
  if (!Array.isArray(input)) return [];
  const out: ChatCitationDetailView[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.citationId !== "string") continue;
    const kind = obj.kind === "summary" ? "summary" : "entry";
    out.push({
      citationId: obj.citationId,
      kind,
      targetKind: typeof obj.targetKind === "string" ? obj.targetKind : null,
      targetId: typeof obj.targetId === "string" ? obj.targetId : null,
      narrative: typeof obj.narrative === "string" ? obj.narrative : "",
      generatedAtIso: typeof obj.generatedAtIso === "string" ? obj.generatedAtIso : "",
    });
  }
  return out;
}

function rowToView(row: ChatTurnRow): ChatTurnView {
  return {
    id: row.id,
    userId: row.userId,
    question: row.question,
    answer: row.answer,
    citations: toStringArray(row.citationsJson),
    citationDetails: toCitationDetails(row.citationDetailsJson ?? null),
    outcome: row.outcome,
    errorMessage: row.errorMessage,
    modelHint: row.modelHint,
    contextEntriesCount: row.contextEntriesCount,
    contextSummariesCount: row.contextSummariesCount,
    engineVersion: row.engineVersion,
    generatedAtIso: row.generatedAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Persist.
   ────────────────────────────────────────────────────────────── */

export interface PersistInput {
  organizationId: string;
  userId: string | null;
  question: string;
  answer: ChatAnswer;
  contextEntriesCount: number;
  contextSummariesCount: number;
  /** Phase 530 — optional rich citation details captured at the time
   *  the route resolved citationIds to (targetKind, targetId) pairs. */
  citationDetails?: ChatCitationDetailView[];
}

/**
 * Best-effort persist — returns null on any failure (including
 * migration_pending). Caller awaits but does not block on it.
 */
export async function persistChatTurn(
  repo: ChatTurnRepo,
  input: PersistInput,
): Promise<ChatTurnView | null> {
  try {
    const row = await repo.aiMemoryChatTurn.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        question: input.question,
        answer: input.answer.answer,
        citationsJson: input.answer.citations,
        ...(input.citationDetails ? { citationDetailsJson: input.citationDetails } : {}),
        outcome: input.answer.outcome,
        errorMessage: input.answer.errorMessage,
        modelHint: input.answer.modelHint,
        contextEntriesCount: input.contextEntriesCount,
        contextSummariesCount: input.contextSummariesCount,
        engineVersion: input.answer.engineVersion,
      },
    });
    return rowToView(row);
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────
   History list.
   ────────────────────────────────────────────────────────────── */

export interface HistoryInput {
  organizationId: string;
  /** When provided, scope to the user's own history. When null, all
   *  turns across the org. When undefined, all turns. */
  userId?: string | null;
  take?: number;
}

export async function buildChatHistoryResponse(
  repo: ChatTurnRepo,
  input: HistoryInput,
): Promise<ApiResponse<HistoryData>> {
  const take = Math.max(1, Math.min(200, input.take ?? 50));
  try {
    const rows = await repo.aiMemoryChatTurn.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
      },
      orderBy: { generatedAt: "desc" },
      take,
    });
    let aiGenerated = 0, fallbackRules = 0, errored = 0;
    for (const r of rows) {
      if (r.outcome === "ai_generated") aiGenerated++;
      else if (r.outcome === "fallback_rules") fallbackRules++;
      else if (r.outcome === "error") errored++;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: new Date().toISOString(),
          turns: rows.map(rowToView),
          summary: { total: rows.length, aiGenerated, fallbackRules, errored },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528170000_add_ai_memory_chat_turn." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "read_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Delete.
   ────────────────────────────────────────────────────────────── */

export interface DeleteInput {
  organizationId: string;
  turnId: string;
}

export async function buildChatTurnDeleteResponse(
  repo: ChatTurnRepo,
  input: DeleteInput,
): Promise<ApiResponse<{ deletedId: string }>> {
  let row: ChatTurnRow | null;
  try {
    row = await repo.aiMemoryChatTurn.findUnique({ where: { id: input.turnId } });
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528170000_add_ai_memory_chat_turn." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "read_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }

  if (!row || row.organizationId !== input.organizationId) {
    return { status: 404, body: { ok: false, error: "turn_not_found" } };
  }

  try {
    await repo.aiMemoryChatTurn.delete({ where: { id: input.turnId } });
    return { status: 200, body: { ok: true, data: { deletedId: input.turnId } } };
  } catch (err) {
    return {
      status: 500,
      body: { ok: false, error: "delete_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}
