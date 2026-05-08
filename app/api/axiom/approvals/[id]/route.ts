/**
 * GET /api/axiom/approvals/[id]         — get item history by planItemId
 * PUT /api/axiom/approvals/[id]         — approve, reject, or snooze a single item
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { decideItem, getItemHistory } from "@/lib/axiom/approvalCenter";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const history = await getItemHistory(id);
    return NextResponse.json({ planItemId: id, history });
  } catch (e) {
    console.error("[axiom approval history]", e);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, note, snoozeDays } = body;

  if (!action || !["approve", "reject", "snooze"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve', 'reject', or 'snooze'" },
      { status: 400 },
    );
  }

  if (action === "snooze" && snoozeDays !== undefined) {
    if (typeof snoozeDays !== "number" || snoozeDays < 1 || snoozeDays > 90) {
      return NextResponse.json(
        { error: "snoozeDays must be between 1 and 90" },
        { status: 400 },
      );
    }
  }

  try {
    const result = await decideItem({
      itemId: id,
      userId,
      action,
      note: note ?? undefined,
      snoozeDays: snoozeDays ?? undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, item: result.item },
        { status: 409 },
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[axiom approval decide]", e);
    return NextResponse.json({ error: "Decision failed" }, { status: 500 });
  }
}
