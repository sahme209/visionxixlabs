/**
 * POST /api/github/validate
 *
 * Validates GitHub owner/repo input format. When live mode + token are
 * supplied, makes a single authenticated /user call to confirm the token.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { validateGithubConnection } from "@/lib/connectors/github/githubValidator";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, requireString, requireBool, optionalString } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = asRecord(await request.json().catch(() => ({})));
    const owner       = requireString(body.owner, "owner", { max: 64 });
    const repo        = optionalString(body.repo, "repo", { max: 128 });
    const token       = typeof body.token === "string" ? body.token : undefined;
    const requestLive = body.requestLive === undefined ? Boolean(token) : requireBool(body.requestLive, "requestLive");

    const result = await validateGithubConnection({ owner, repo, token, requestLive });
    // Never echo back the rate-limit reset epoch if the token was rejected.
    return NextResponse.json(
      apiSuccess({
        ok: result.ok,
        outcome: result.outcome,
        message: result.message,
        mode: result.mode,
        validatedLogin: result.validatedLogin,
        errorCode: result.errorCode,
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
