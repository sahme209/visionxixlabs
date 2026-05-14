/**
 * POST /api/gcp/validate
 *
 * Validates GCP project id format + (optionally) the service account JSON
 * shape. Live SA validation is in the expanding tier until google-auth
 * wiring lands.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { validateGcpConnection } from "@/lib/cloud/gcp/gcpValidator";
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
    const projectId            = requireString(body.projectId, "projectId", { max: 64 });
    const serviceAccountEmail  = optionalString(body.serviceAccountEmail, "serviceAccountEmail", { max: 320 });
    const region               = optionalString(body.region, "region", { max: 32 });
    const requestLive          = body.requestLive === undefined ? false : requireBool(body.requestLive, "requestLive");
    const serviceAccountKeyJson = typeof body.serviceAccountKeyJson === "string" ? body.serviceAccountKeyJson : undefined;

    const result = await validateGcpConnection({
      input: { projectId, serviceAccountEmail, region, serviceAccountKeyJson },
      requestLive,
    });
    return NextResponse.json(apiSuccess(result), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
