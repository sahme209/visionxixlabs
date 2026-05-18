/**
 * GET /api/workspace/state
 *
 * Returns the canonical WorkspaceState via the canonical API envelope.
 * Pure read-only.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildWorkspaceState } from "@/lib/org/workspaceState";
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
    const state = buildWorkspaceState({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(state, {
      correlationId,
      safetyContract: "rbac_never_enables_mutation",
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "rbac_never_enables_mutation" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
