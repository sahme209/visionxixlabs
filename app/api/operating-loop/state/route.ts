/**
 * GET /api/operating-loop/state
 *
 * Returns the current operating-loop snapshot for one or all providers.
 * Inspect-only: no audit event, no stage advancement, no side-effects.
 *
 * Query params:
 *   ?provider=aws|azure|gcp|github|security_scanner|desktop  (optional — omit for "all")
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildAllOperatingLoops, buildOperatingLoopRun } from "@/lib/operatingLoop/operatingLoopBuilder";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import type { OperatingLoopProvider } from "@/lib/operatingLoop/operatingLoopModel";

export const dynamic = "force-dynamic";

const ALLOWED_PROVIDERS: OperatingLoopProvider[] = ["aws", "azure", "gcp", "github", "security_scanner", "desktop"];

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const providerParam = new URL(request.url).searchParams.get("provider") as OperatingLoopProvider | null;

    if (providerParam) {
      if (!ALLOWED_PROVIDERS.includes(providerParam)) {
        throw AxiomErrors.validation("loop.bad_provider", `provider must be one of ${ALLOWED_PROVIDERS.join(", ")}.`);
      }
      const run = await buildOperatingLoopRun({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        provider: providerParam,
      });
      return NextResponse.json(apiSuccess({ runs: [run] }), { status: 200 });
    }

    const runs = await buildAllOperatingLoops({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return NextResponse.json(apiSuccess({ runs }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> { return GET(request); }
