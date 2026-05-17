/**
 * GET /api/strategy/snapshot
 *
 * Strategic product summary — value metrics, executive summary,
 * defensibility signals, enterprise readiness v2, security review packet,
 * onboarding checklist, product risk register, customer-facing
 * limitations — composed from existing canonical builders.
 *
 * Inspect-only. Tenant-scoped. Honest sourceMode + limitations.
 *
 * Optional query: ?audience=executive|engineer|security|internal
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildStrategicSummary } from "@/lib/strategy/strategicSummary";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const AUDIENCES = ["executive", "engineer", "security", "internal"] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const audienceParam = new URL(request.url).searchParams.get("audience");
    const audience = AUDIENCES.includes(audienceParam as (typeof AUDIENCES)[number])
      ? (audienceParam as (typeof AUDIENCES)[number])
      : "executive";

    const summary = await buildStrategicSummary({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
      audience,
    });
    return NextResponse.json(apiSuccess(summary), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> { return GET(request); }
