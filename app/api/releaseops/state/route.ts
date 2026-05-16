/**
 * GET /api/releaseops/state
 *
 * Canonical ReleaseOps state — honest live / partial / preview / disabled
 * source labeling. Used by the ReleaseOps page + Command Center.
 *
 * Auth required. No mutations.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { getReleaseOpsState } from "@/lib/releaseops/getReleaseOpsState";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { loadAppEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const env = loadAppEnv();
    const state = await getReleaseOpsState({ organization: env.githubDefaultOrg });
    return NextResponse.json(apiSuccess(state), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }
