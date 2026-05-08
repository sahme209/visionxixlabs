/**
 * GET /api/axiom/explain?findingId=...&question=...
 *
 * Returns a grounded explanation for a finding, recommendation, or action.
 * Questions: why_recommended, what_evidence, what_if_ignored,
 *            what_could_go_wrong, how_to_rollback, is_this_safe
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import {
  explainFinding,
  getAvailableQuestions,
  type ExplainQuestion,
} from "@/lib/axiom/explainEngine";

const VALID_QUESTIONS = new Set<string>([
  "why_recommended",
  "what_evidence",
  "what_if_ignored",
  "what_could_go_wrong",
  "how_to_rollback",
  "is_this_safe",
]);

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

export async function GET(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const findingId = req.nextUrl.searchParams.get("findingId");
  const question = req.nextUrl.searchParams.get("question");

  if (!findingId) {
    return NextResponse.json(
      { error: "findingId is required", availableQuestions: getAvailableQuestions() },
      { status: 400 },
    );
  }

  if (!question || !VALID_QUESTIONS.has(question)) {
    return NextResponse.json(
      {
        error: `question must be one of: ${[...VALID_QUESTIONS].join(", ")}`,
        availableQuestions: getAvailableQuestions(),
      },
      { status: 400 },
    );
  }

  try {
    const explanation = await explainFinding(findingId, question as ExplainQuestion);
    return NextResponse.json(explanation);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("No AxiomFinding found")) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }
    console.error("[axiom explain]", e);
    return NextResponse.json({ error: "Explanation failed" }, { status: 500 });
  }
}
