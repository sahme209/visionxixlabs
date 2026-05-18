/**
 * POST /api/autonomy/cycle
 *
 * Runs one declared cycle of the closed Autonomy Loop and returns
 * the full per-stage transcript. The loop never executes mutations
 * — it stops at the execute stage and hands off intent to the
 * paired desktop runtime. Hard-literal safety contract enforces
 * this at the type level.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { runAutonomousLoopCycle } from "@/lib/autonomy/autonomousLoopRunner";
import { charterForMode } from "@/lib/autonomy/autonomyCharter";
import { apiOk, apiErr, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";
import type { AutonomyMode } from "@/lib/autonomy/autonomousLoopModel";

export const dynamic = "force-dynamic";

const VALID_MODES: AutonomyMode[] = ["observer", "review", "assisted", "autonomous"];

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    let mode: AutonomyMode | undefined;
    try {
      const body = (await req.json()) as { mode?: string };
      if (body.mode && VALID_MODES.includes(body.mode as AutonomyMode)) {
        mode = body.mode as AutonomyMode;
      }
    } catch {
      // No body / invalid JSON — use default charter.
    }
    const report = await runAutonomousLoopCycle({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
      charter: mode ? charterForMode(mode) : undefined,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "autonomy_gated_no_unsafe_execution",
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "autonomy_gated_no_unsafe_execution" });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
