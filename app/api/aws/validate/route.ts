/**
 * POST /api/aws/validate
 *
 * Validates an AWS role ARN + External ID + region. Runs the live STS
 * round-trip when:
 *   - tenant policy / env says live mode is allowed,
 *   - broker credentials are present,
 *   - the caller explicitly requested live (`requestLive: true`).
 *
 * Otherwise returns a typed "format validated, preview mode" outcome.
 * Auth required.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { validateAwsConnection } from "@/lib/cloud/aws/awsValidator";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, requireString, requireBool } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    const body = asRecord(await request.json().catch(() => ({})));
    const roleArn    = requireString(body.roleArn, "roleArn", { max: 2048 });
    const externalId = requireString(body.externalId, "externalId", { max: 1224 });
    const region     = requireString(body.region, "region", { max: 32 });
    const requestLive = body.requestLive === undefined ? true : requireBool(body.requestLive, "requestLive");

    const result = await validateAwsConnection({
      input: { roleArn, externalId, region, label: typeof body.label === "string" ? body.label : undefined },
      requestLive,
    });

    return NextResponse.json(
      apiSuccess({
        ok: result.ok,
        outcome: result.outcome,
        status: result.status,
        mode: result.mode,
        message: result.message,
        accountId: result.accountId,
        validatedArn: result.validatedArn,
        errorCode: result.errorCode,
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
