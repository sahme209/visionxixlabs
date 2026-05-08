/**
 * GET /api/axiom/diff?previousRunId=...&currentRunId=...
 *
 * Returns a structured diff between two agent runs — resources, findings,
 * savings, risk changes, and a human-readable summary.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { compareAgentRuns } from "@/lib/axiom/diffEngine";

export async function GET(req: NextRequest) {
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
    return NextResponse.json({
      error: "Scan comparison requires a Scale plan. Compare any two agent scans to see what changed — new resources, resolved findings, cost drift, and risk trends. See /pricing?ref=axiom-diff",
    }, { status: 403 });
  }

  const previousRunId = req.nextUrl.searchParams.get("previousRunId");
  const currentRunId = req.nextUrl.searchParams.get("currentRunId");

  if (!previousRunId || !currentRunId) {
    return NextResponse.json(
      { error: "Both previousRunId and currentRunId are required" },
      { status: 400 },
    );
  }

  try {
    const diff = await compareAgentRuns(previousRunId, currentRunId);
    return NextResponse.json(diff);
  } catch (e) {
    console.error("[axiom diff]", e);
    return NextResponse.json({ error: "Diff failed" }, { status: 500 });
  }
}
