/**
 * POST /api/azure/validate
 *
 * Validates Azure tenant id + subscription id format. Live SP validation
 * is in the expanding tier until the @azure/identity wiring lands.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { validateAzureConnection } from "@/lib/cloud/azure/azureValidator";
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
    const tenantId       = requireString(body.tenantId, "tenantId", { max: 64 });
    const subscriptionId = requireString(body.subscriptionId, "subscriptionId", { max: 64 });
    const clientId       = optionalString(body.clientId, "clientId", { max: 64 });
    const location       = optionalString(body.location, "location", { max: 32 });
    const requestLive    = body.requestLive === undefined ? false : requireBool(body.requestLive, "requestLive");

    const result = await validateAzureConnection({
      input: { tenantId, subscriptionId, clientId, location, clientSecret: typeof body.clientSecret === "string" ? body.clientSecret : undefined },
      requestLive,
    });
    return NextResponse.json(apiSuccess(result), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
