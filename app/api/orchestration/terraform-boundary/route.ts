/**
 * GET /api/orchestration/terraform-boundary
 *
 * Returns the typed TerraformBoundaryDecision per provider so UI surfaces
 * can suppress "Apply now" buttons when applyAvailable is false.
 */

import { NextResponse } from "next/server";
import { evaluateTerraformBoundary } from "@/lib/execution/terraformBoundary";
import { loadAppEnv } from "@/lib/config/env";
import { serverFeatures } from "@/lib/config/features";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const env = loadAppEnv();
    const features = serverFeatures();

    // Today Axiom does not enable live apply for any provider — boundary
    // honestly reflects that.
    const applyFeatureFlagOn = false; // gated by AXIOM_TF_APPLY_ENABLED (not set)
    const auditSinkReady = features.trustCenter && Boolean(env.auditSigningKeySet);
    const desktopSigningReady = env.desktopDownloadsEnabled;

    const decisions = (["aws", "azure", "gcp", "github", "desktop"] as const).map((p) =>
      evaluateTerraformBoundary({
        provider: p,
        brokerCredentialsPresent: p === "aws" ? env.awsBrokerConfigured : false,
        applyFeatureFlagOn,
        auditSinkReady,
        desktopSigningReady,
      }),
    );

    return NextResponse.json(apiSuccess({ decisions }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET():  Promise<NextResponse> { return handle(); }
export async function POST(): Promise<NextResponse> { return handle(); }
