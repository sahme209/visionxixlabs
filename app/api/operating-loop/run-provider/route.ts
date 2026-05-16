/**
 * POST /api/operating-loop/run-provider
 *
 * Runs the operating loop for a single provider. Walks safe stages only;
 * refuses destructive paths and halts at approval / desktop review.
 * Audited.
 *
 * Body: { provider: "aws" | "azure" | "gcp" | "github" | "security_scanner" | "desktop", maxStages?: number }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { runOperatingLoop } from "@/lib/operatingLoop/operatingLoopRunner";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, requireEnum, requireInt } from "@/lib/security/validation";
import type { OperatingLoopProvider } from "@/lib/operatingLoop/operatingLoopModel";

export const dynamic = "force-dynamic";

const ALLOWED_PROVIDERS = ["aws", "azure", "gcp", "github", "security_scanner", "desktop"] as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = asRecord(await request.json().catch(() => ({})));
    const provider = requireEnum(body.provider, "provider", ALLOWED_PROVIDERS) as OperatingLoopProvider;
    const maxStages = body.maxStages === undefined ? undefined : requireInt(body.maxStages, "maxStages", { min: 1, max: 16 });

    const report = await runOperatingLoop({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      provider,
      maxStages,
    });

    return NextResponse.json(apiSuccess(report), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
