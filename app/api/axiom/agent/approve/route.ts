/**
 * POST /api/axiom/agent/approve
 *
 * Submit an approval decision for a pending Axiom Agent run.
 * The agent will apply approved actions and return results.
 *
 * Body: {
 *   runId: string,
 *   decision: "approve_all" | "approve_partial" | "reject_all",
 *   approvedItemIds: string[],
 *   rejectedItemIds?: string[],
 *   note?: string,
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { handleApproval } from "@/lib/axiom/agent/runAgent";

const VALID_DECISIONS = new Set(["approve_all", "approve_partial", "reject_all"]);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as { id?: string }).id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
    if (!entitlements.axiomExecution) {
      return NextResponse.json(
        { error: "Scale or Enterprise plan required" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { runId, decision, approvedItemIds, rejectedItemIds, note } = body;

    if (!runId || typeof runId !== "string") {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    if (!decision || !VALID_DECISIONS.has(decision)) {
      return NextResponse.json(
        { error: "decision must be 'approve_all', 'approve_partial', or 'reject_all'" },
        { status: 400 },
      );
    }

    // Verify the run exists and belongs to this user
    const run = await prisma.axiomAgentRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: "Agent run not found" }, { status: 404 });
    }
    if (run.userId !== userId) {
      return NextResponse.json({ error: "Not authorized to approve this run" }, { status: 403 });
    }
    if (run.status !== "completed") {
      return NextResponse.json(
        { error: `Run is not ready for approval (current status: ${run.status})` },
        { status: 409 },
      );
    }

    const result = await handleApproval({
      runId,
      userId,
      decision,
      approvedItemIds: approvedItemIds ?? [],
      rejectedItemIds: rejectedItemIds ?? [],
      note,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[axiom agent/approve]", e);
    return NextResponse.json({ error: "Approval processing failed" }, { status: 500 });
  }
}
