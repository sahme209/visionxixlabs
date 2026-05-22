/**
 * POST /api/admin/eval-runs/start — Phase 389.
 *
 * Admin-triggered manual eval run. Gated by ADMIN_EMAILS. Optionally
 * accepts { taskKeys?: string[], dryRun?: boolean } to run a subset
 * or sanity-check without burning tokens.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { runEvalSuite } from "@/lib/workforce/eval/runEvalSuite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  let body: { taskKeys?: unknown; dryRun?: unknown } = {};
  try { body = await req.json() as typeof body; } catch { /* empty */ }

  const taskKeys = Array.isArray(body.taskKeys)
    ? body.taskKeys.filter((k): k is string => typeof k === "string")
    : undefined;
  const dryRun = body.dryRun === true;

  const result = await runEvalSuite({
    runKind: "manual",
    triggeredBy: session.user.email,
    taskKeys: taskKeys && taskKeys.length > 0 ? taskKeys : undefined,
    dryRun,
  });

  return NextResponse.json({ ok: true, ...result });
}
