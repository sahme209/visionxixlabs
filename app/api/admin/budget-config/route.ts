/**
 * /api/admin/budget-config — Phase 401.
 *
 * Per-organization budget config CRUD:
 *
 *   GET    ?organizationId=X   — read current config (or null if unset)
 *   PUT                        — upsert config
 *   DELETE ?organizationId=X   — revert to platform default
 *
 * All gated by ADMIN_EMAILS. Pure validation lives in the kernel
 * (resolveRunBudgetCap / budgetConfigStore normalizers); this route is
 * a 30-line glue layer that respects the admin gate, parses inputs,
 * and emits audit rows.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import {
  loadBudgetConfig,
  upsertBudgetConfig,
  deleteBudgetConfig,
} from "@/lib/workforce/pipelines/budgetConfigStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ ok: false, reason: "organizationId_required" }, { status: 400 });
  }

  const config = await loadBudgetConfig(organizationId);
  return NextResponse.json({ ok: true, organizationId, config });
}

interface PutBody {
  organizationId?: unknown;
  defaultMaxCostCents?: unknown;
  pipelineOverrides?: unknown;
  rationale?: unknown;
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  let body: PutBody = {};
  try { body = (await req.json()) as PutBody; } catch { /* empty */ }

  if (typeof body.organizationId !== "string" || body.organizationId.length === 0) {
    return NextResponse.json({ ok: false, reason: "organizationId_required" }, { status: 400 });
  }

  // defaultMaxCostCents:
  //   - number > 0 → set that cap
  //   - null       → unlimited at the workspace level
  //   - anything else → reject (including 0 / negative)
  let defaultMaxCostCents: number | null;
  if (body.defaultMaxCostCents === null) {
    defaultMaxCostCents = null;
  } else if (
    typeof body.defaultMaxCostCents === "number" &&
    Number.isFinite(body.defaultMaxCostCents) &&
    body.defaultMaxCostCents > 0
  ) {
    defaultMaxCostCents = Math.floor(body.defaultMaxCostCents);
  } else {
    return NextResponse.json(
      { ok: false, reason: "defaultMaxCostCents_invalid" },
      { status: 400 },
    );
  }

  const pipelineOverrides = Array.isArray(body.pipelineOverrides)
    ? body.pipelineOverrides as Array<{ pipelineId: string; maxCostCents: number | null }>
    : [];

  const rationale = typeof body.rationale === "string" && body.rationale.length > 0
    ? body.rationale
    : null;

  const correlationId = `budget_cfg_upsert_${Date.now().toString(36)}`;
  const result = await upsertBudgetConfig({
    organizationId: body.organizationId,
    defaultMaxCostCents,
    pipelineOverrides,
    rationale,
    updatedBy: session.user.email,
    correlationId,
  });

  return NextResponse.json({
    ok: true,
    created: result.created,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ ok: false, reason: "organizationId_required" }, { status: 400 });
  }

  const correlationId = `budget_cfg_delete_${Date.now().toString(36)}`;
  const result = await deleteBudgetConfig({
    organizationId,
    deletedBy: session.user.email,
    correlationId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
