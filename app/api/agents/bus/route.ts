/**
 * GET /api/agents/bus
 *
 * Returns the last N agent messages for the caller's tenant.
 * Read-only.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readDurableAgentBus } from "@/lib/agents/agentBus";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const limit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10);
    const threadId = req.nextUrl.searchParams.get("threadId") ?? undefined;
    const messages = await readDurableAgentBus({
      organizationId: String(ctx.organizationId),
      limit: Number.isFinite(limit) ? limit : undefined,
      threadId,
    });
    return apiOk({ messages, total: messages.length }, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
