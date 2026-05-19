/**
 * /api/autonomy/charter
 *
 * GET — returns the per-tenant TenantCharterRecord (or null when no
 * override is set — in which case the global observer default is in
 * force).
 *
 * POST — upserts an override. Body shape:
 *   {
 *     mode: "observer" | "review" | "assisted" | "autonomous",
 *     perCycleActionLimit?: number,   // clamped to [1, 50]
 *     rationale?: string,
 *     slackWebhookOverride?: string
 *   }
 *
 * DELETE — clears the override (falls back to observer default).
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import {
  deleteTenantCharter,
  readTenantCharter,
  upsertTenantCharter,
} from "@/lib/autonomy/tenantCharterStore";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";
import type { AutonomyMode } from "@/lib/autonomy/autonomousLoopModel";

export const dynamic = "force-dynamic";

const ALLOWED: AutonomyMode[] = ["observer", "review", "assisted", "autonomous"];

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const record = await readTenantCharter(String(ctx.organizationId));
    return apiOk({ record, hasOverride: record !== null }, {
      correlationId,
      safetyContract: "policy_governance_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "policy_governance_read_only" });
  }
}

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = (await req.json()) as {
      mode?: string;
      perCycleActionLimit?: number;
      rationale?: string;
      slackWebhookOverride?: string;
    } | null;
    if (!body?.mode || !(ALLOWED as string[]).includes(body.mode)) {
      throw AxiomErrors.validation(
        "charter.mode.invalid",
        `Mode must be one of ${ALLOWED.join(" | ")}.`,
      );
    }
    const record = await upsertTenantCharter({
      organizationId: String(ctx.organizationId),
      mode: body.mode as AutonomyMode,
      perCycleActionLimit: body.perCycleActionLimit,
      rationale: body.rationale,
      slackWebhookOverride: body.slackWebhookOverride,
      updatedBy: ctx.userId ? String(ctx.userId) : undefined,
    });
    return apiOk({ record }, {
      correlationId,
      safetyContract: "policy_governance_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "policy_governance_read_only" });
  }
}

export async function DELETE(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const deleted = await deleteTenantCharter(String(ctx.organizationId));
    return apiOk({ deleted }, {
      correlationId,
      safetyContract: "policy_governance_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "policy_governance_read_only" });
  }
}
