/**
 * Dead-letter foundation.
 *
 * When a job or event fails in a way the retry engine cannot recover from,
 * the payload moves to a dead-letter record. Dead-lettered items are visible
 * in the reliability center, copilot, and command center — silently failing
 * is the worst possible outcome.
 *
 * The record carries enough context to recover by hand (or by an opt-in
 * automated recovery job) without re-running the original failed step.
 * Payload preview is *redacted* before persistence — dead-letter rows are
 * not a secret-leak vector.
 */

import type { OrganizationId, CorrelationId } from "@/lib/domain/ids";
import type { FailureCategory } from "./failureClassifier";
import { redactDeep } from "@/lib/security/redaction";

export type DeadLetterSource = "job" | "event" | "workflow_step" | "external_call";

export interface DeadLetterRecord {
  id: string;
  organizationId: OrganizationId;
  /** Where the failure originated. */
  source: DeadLetterSource;
  /** Original job/event/run id. */
  originalRef: string;
  /** Stable failure category from the classifier. */
  category: FailureCategory;
  /** Reason summary (≤ 280 chars). */
  reason: string;
  /** Redacted payload preview — never raw. */
  payloadPreview: Record<string, unknown>;
  /** Retry attempts already made. */
  retryHistory: { at: string; reason: string; errorCode?: string }[];
  /** Last-known safe state to roll back to (free-form). */
  lastKnownSafeState?: string;
  /** Suggested recovery action — engine hint, not commitment. */
  suggestedRecovery: string;
  correlationId: CorrelationId;
  createdAt: string;
  /** Set when an operator manually marked the record handled. */
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

export interface DeadLetterStore {
  append(record: DeadLetterRecord): Promise<void>;
  list(input: { organizationId: OrganizationId; limit?: number; sinceIso?: string; unresolvedOnly?: boolean }): Promise<DeadLetterRecord[]>;
  resolve(input: { organizationId: OrganizationId; id: string; resolvedBy: string; resolution: string }): Promise<DeadLetterRecord | null>;
}

class InMemoryDeadLetterStore implements DeadLetterStore {
  private records: DeadLetterRecord[] = [];
  async append(record: DeadLetterRecord): Promise<void> {
    this.records.unshift(record);
    if (this.records.length > 1000) this.records.pop();
  }
  async list(input: { organizationId: OrganizationId; limit?: number; sinceIso?: string; unresolvedOnly?: boolean }): Promise<DeadLetterRecord[]> {
    let out = this.records.filter((r) => r.organizationId === input.organizationId);
    if (input.unresolvedOnly) out = out.filter((r) => !r.resolvedAt);
    if (input.sinceIso) out = out.filter((r) => r.createdAt >= input.sinceIso!);
    return out.slice(0, input.limit ?? 100);
  }
  async resolve(input: { organizationId: OrganizationId; id: string; resolvedBy: string; resolution: string }): Promise<DeadLetterRecord | null> {
    const r = this.records.find((x) => x.organizationId === input.organizationId && x.id === input.id);
    if (!r) return null;
    r.resolvedAt = new Date().toISOString();
    r.resolvedBy = input.resolvedBy;
    r.resolution = input.resolution;
    return r;
  }
}

let _store: DeadLetterStore = new InMemoryDeadLetterStore();
export function configureDeadLetterStore(s: DeadLetterStore): void { _store = s; }
export function deadLetterStore(): DeadLetterStore { return _store; }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _seq = 0;
function newDeadLetterId(): string {
  _seq = (_seq + 1) % 1_000_000;
  return `dlq_${Date.now().toString(36)}_${_seq.toString(36).padStart(4, "0")}`;
}

export interface DeadLetterInput {
  organizationId: OrganizationId;
  source: DeadLetterSource;
  originalRef: string;
  category: FailureCategory;
  reason: string;
  payload: unknown;
  retryHistory?: DeadLetterRecord["retryHistory"];
  lastKnownSafeState?: string;
  suggestedRecovery: string;
  correlationId: CorrelationId;
}

/**
 * Build a dead-letter record from a typed input. Payload is automatically
 * redacted; reason is truncated to 280 characters.
 */
export function buildDeadLetterRecord(input: DeadLetterInput): DeadLetterRecord {
  const payloadPreview = typeof input.payload === "object" && input.payload !== null
    ? (redactDeep(input.payload) as Record<string, unknown>)
    : { value: typeof input.payload === "string" ? "[REDACTED]" : input.payload };
  return {
    id: newDeadLetterId(),
    organizationId: input.organizationId,
    source: input.source,
    originalRef: input.originalRef,
    category: input.category,
    reason: input.reason.slice(0, 280),
    payloadPreview,
    retryHistory: input.retryHistory ?? [],
    lastKnownSafeState: input.lastKnownSafeState,
    suggestedRecovery: input.suggestedRecovery,
    correlationId: input.correlationId,
    createdAt: new Date().toISOString(),
  };
}

/** Append + return — convenience for callers. */
export async function deadLetter(input: DeadLetterInput): Promise<DeadLetterRecord> {
  const record = buildDeadLetterRecord(input);
  await deadLetterStore().append(record);
  return record;
}
