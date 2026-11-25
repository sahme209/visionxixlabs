import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveCorrelationId } from "@/lib/api";
import { currentContext } from "@/lib/auth/currentContext";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { readWorkspaceBudgetSettings, saveWorkspaceBudgetSettings } from "@/lib/billing/workspaceAIUsageBudgetSettings";
import { workspaceAIUsageBudgetsEnabled } from "@/lib/billing/workspaceAIUsageBudget";
import { prisma } from "@/lib/db";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

const cents = z.number().int().min(0).max(2_147_483_647);
const updateSchema = z.strictObject({
  organizationId: z.string().min(1),
  expectedRevision: z.string().datetime({ precision: 3 }).nullable(),
  budget: z.strictObject({
    monthlyLimitCents: cents,
    warningThresholdCents: cents.min(1).nullable(),
  }).refine(row => row.warningThresholdCents === null || row.warningThresholdCents <= row.monthlyLimitCents).nullable(),
});

function failure(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export function GET(request: NextRequest) {
  return handle(request, false);
}

export function PUT(request: NextRequest) {
  return handle(request, true);
}

async function handle(request: NextRequest, write: boolean) {
  if (write && !isSameOriginRequest(request)) return failure("invalid_request_origin", 403);
  if (!workspaceAIUsageBudgetsEnabled()) return failure("workspace_ai_budget_unavailable", 503);
  try {
    const context = await currentContext();
    if (!context.isAuthenticated || !context.organizationId || !context.userId) return failure("auth_required", 401);
    const scope = { organizationId: String(context.organizationId), userId: String(context.userId) };
    const parsed = write ? updateSchema.safeParse(await request.json().catch(() => null)) : null;
    if (parsed && !parsed.success) return failure("workspace_budget_invalid", 400);
    if (parsed && parsed.data.organizationId !== scope.organizationId) return failure("workspace_budget_changed", 409);
    const correlationId = resolveCorrelationId(request.headers) as CorrelationId;
    const result = await prisma.$transaction(
      tx => parsed ? saveWorkspaceBudgetSettings(tx, scope, { ...parsed.data, correlationId }) : readWorkspaceBudgetSettings(tx, scope),
      { isolationLevel: "Serializable" },
    );
    if (result.kind === "forbidden") return failure("workspace_billing_manager_required", 403);
    if (result.kind === "conflict") return failure("workspace_budget_changed", 409);
    return NextResponse.json({ ok: true, data: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return failure("workspace_budget_changed", 409);
    }
    return failure("workspace_ai_budget_unavailable", 503);
  }
}
