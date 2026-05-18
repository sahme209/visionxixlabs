/**
 * GET /api/intelligence/next-actions
 *
 * Returns the canonical Next-Best-Action Report via the canonical
 * API envelope. Every action is mapped to a literal safetyLevel;
 * mutation actions are never produced. Tenant-scoped.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildNextActions } from "@/lib/intelligence/nextActionEngine";
import { apiOk, apiErr, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildNextActions({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "next_action_read_only",
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "next_action_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
