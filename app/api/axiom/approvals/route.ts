/**
 * GET  /api/axiom/approvals?organizationId=...&status=...&provider=...&riskLevel=...
 * POST /api/axiom/approvals  — batch approve or reject multiple items
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import {
  listPendingApprovals,
  batchDecide,
  createApprovalItems,
  expireStaleItems,
  type ApprovalItemStatus,
} from "@/lib/axiom/approvalCenter";

async function authenticate() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) return null;

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
  if (!entitlements.axiomExecution) return null;

  return userId;
}

const VALID_STATUSES = new Set([
  "pending", "approved", "rejected", "snoozed", "applied", "failed", "expired",
]);

const VALID_PROVIDERS = new Set(["aws", "azure", "gcp"]);
const VALID_RISK_LEVELS = new Set(["low", "medium", "high"]);

export async function GET(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const provider = req.nextUrl.searchParams.get("provider");
  const riskLevel = req.nextUrl.searchParams.get("riskLevel");

  if (status && !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }
  if (provider && !VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 });
  }
  if (riskLevel && !VALID_RISK_LEVELS.has(riskLevel)) {
    return NextResponse.json({ error: `Invalid riskLevel: ${riskLevel}` }, { status: 400 });
  }

  try {
    const result = await listPendingApprovals(organizationId, {
      status: status as ApprovalItemStatus | undefined,
      provider: provider ?? undefined,
      riskLevel: riskLevel ?? undefined,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[axiom approvals]", e);
    return NextResponse.json({ error: "Failed to load approvals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, itemIds, note } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 },
    );
  }

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json(
      { error: "itemIds must be a non-empty array" },
      { status: 400 },
    );
  }

  if (itemIds.length > 100) {
    return NextResponse.json(
      { error: "Maximum 100 items per batch" },
      { status: 400 },
    );
  }

  try {
    const result = await batchDecide({
      itemIds,
      userId,
      action,
      note: note ?? undefined,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[axiom approvals batch]", e);
    return NextResponse.json({ error: "Batch decision failed" }, { status: 500 });
  }
}
