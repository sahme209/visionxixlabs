/**
 * GET /api/trust/controls
 *
 * Lists every implemented platform control with its current status,
 * evidence sources, related files / routes, and limitations. The Trust
 * Center renders this directly.
 *
 * Optional filter: ?category=read_only|approval_gates|tenant_isolation|...
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { CONTROL_REGISTRY, summarizeControls, type ControlCategory } from "@/lib/compliance/controlRegistry";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const categoryParam = new URL(request.url).searchParams.get("category") as ControlCategory | null;
    const controls = categoryParam
      ? CONTROL_REGISTRY.filter((c) => c.category === categoryParam)
      : CONTROL_REGISTRY;

    return NextResponse.json(
      apiSuccess({
        generatedAt: new Date().toISOString(),
        summary: summarizeControls(controls),
        controls,
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> { return GET(request); }
