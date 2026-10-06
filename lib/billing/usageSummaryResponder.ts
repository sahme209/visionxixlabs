/**
 * Live month-to-date AI usage summary for the desktop Plan & Usage
 * section. Sums UsageEvent directly (same approach as
 * checkWorkspaceAICredits.ts) rather than WorkspaceUsageSummary, which
 * is only rebuilt nightly and can be stale by up to 24h — a usage
 * screen a person is actually looking at should show current numbers.
 */

import { isMissingTable } from "@/lib/releaseops/releaseListResponder";

export interface UsageAggregateRow {
  _sum: { inputTokens: number | null; outputTokens: number | null; costCents: number | null };
  _count: { _all: number };
}

export interface UsageSummaryRepo {
  usageEvent: {
    aggregate(args: {
      where: { organizationId: string; eventKind: "ai_invocation"; createdAt: { gte: Date } };
      _sum: { inputTokens: true; outputTokens: true; costCents: true };
      _count: { _all: true };
    }): Promise<UsageAggregateRow>;
  };
}

export type UsageSummaryBody =
  | { ok: true; data: { periodMonth: string; aiInvocationCount: number; aiInputTokens: number; aiOutputTokens: number; aiCostCents: number } }
  | { ok: false; error: string };

export interface ResponderResult { status: number; body: UsageSummaryBody }

export async function buildUsageSummaryResponse(
  repo: UsageSummaryRepo,
  organizationId: string,
  opts: { now?: Date } = {},
): Promise<ResponderResult> {
  const now = opts.now ?? new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  try {
    const result = await repo.usageEvent.aggregate({
      where: { organizationId, eventKind: "ai_invocation", createdAt: { gte: periodStart } },
      _sum: { inputTokens: true, outputTokens: true, costCents: true },
      _count: { _all: true },
    });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          periodMonth,
          aiInvocationCount: result._count._all,
          aiInputTokens: result._sum.inputTokens ?? 0,
          aiOutputTokens: result._sum.outputTokens ?? 0,
          aiCostCents: result._sum.costCents ?? 0,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) return { status: 503, body: { ok: false, error: "migration_pending" } };
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}
