/**
 * POST /api/workforce/run-agi-all — Phase 559.
 *
 * Sweeps every client engineer in the canonical workforce registry
 * and runs the Phase 557 engineer-AGI flow for each. Sequential by
 * design — the AI call already costs tokens per invocation, and a
 * parallel fan-out would saturate the rate limit without giving
 * operators any value (they're going to read the rationales in order
 * anyway). The instrumented fetcher's circuit breaker absorbs
 * provider hiccups gracefully so a flaky engine doesn't take down
 * the whole sweep.
 *
 * Bounded to maxDuration so a single tenant can't lock the worker
 * pool. Engineers that don't complete in window get skipped this
 * round — the operator can re-run, or hit individual engineers via
 * /api/workforce/[id]/run-agi.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
import { runEngineerAgi, persistEngineerAgiResult } from "@/lib/workforce/engineerAgi";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes — bounded sweep budget.

const HARD_DEADLINE_MS = 270_000; // leave headroom inside maxDuration

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const startedAt = Date.now();
  const engineers = AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client");

  const correlationId = `engineer_agi_all_${Date.now().toString(36)}` as CorrelationId;
  const counts = { ai_generated: 0, fallback_rules: 0, error: 0, skipped_deadline: 0 };

  for (const engineer of engineers) {
    // Bail before the function ages out — leave the rest for a
    // follow-up sweep instead of getting killed mid-write.
    if (Date.now() - startedAt > HARD_DEADLINE_MS) {
      counts.skipped_deadline = engineers.length - (counts.ai_generated + counts.fallback_rules + counts.error);
      break;
    }
    try {
      const result = await runEngineerAgi(engineer, org);
      await persistEngineerAgiResult(engineer, org, result);
      counts[result.outcome] += 1;
    } catch (err) {
      console.warn("[run-agi-all] engineer", engineer.id, "failed:", err instanceof Error ? err.message : err);
      counts.error += 1;
    }
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: counts.error > 0 ? "failure" : "success",
    entityRef: "workforce:all",
    correlationId,
    detail: {
      action: "engineer.run_agi_all",
      engineerCount: engineers.length,
      durationMs: Date.now() - startedAt,
      result: counts,
    },
  });

  return NextResponse.redirect(new URL(`/dashboard/workforce`, req.url), 303);
}
