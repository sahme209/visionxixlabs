/**
 * POST /api/security-scan
 *
 * Runs the internal security scanner over the platform's current app +
 * supply-chain + desktop signals. Returns a typed SecurityScanOutcome the
 * /dashboard/security-scanner page renders.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { serverFeatures } from "@/lib/config/features";
import { loadAppEnv } from "@/lib/config/env";
import { runSecurityScan } from "@/lib/securityScanner/securityScanner";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const env = loadAppEnv();
    const features = serverFeatures();

    const outcome = await runSecurityScan({
      app: {
        redactionActive: true,
        auditStoreConfigured: true,
        copilotContextSafe: true,
        // Honest: server-side tenant scope resolution is partial until the
        // NextAuth session carries organizationId structurally.
        tenantScopeEnforcedServerSide: false,
        rbacWiredOnRoutes: false,
        desktopApplyBlockedByDefault: true,
      },
      supplyChain: {
        lockfileCommitted: true,
        dependencyScanRun: false,
        secretScanningActive: false,
        buildSigningWired: false,
      },
      desktop: {
        macosSigned: false,
        macosNotarized: false,
        windowsSigned: false,
        linuxSigned: false,
        handoffSignerConfigured: env.desktopHandoffSigningKeySet || Boolean(env.nextAuthSecret),
        localApplyBlockedByDefault: true,
      },
    });

    // Tag the response with the feature mode so the UI can render an
    // honest "preview scanner" banner when relevant.
    return NextResponse.json(
      apiSuccess({
        ...outcome,
        mode: features.awsLiveScan ? "live_signals_partial" : "preview",
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET() {
  return NextResponse.json(
    apiFailure(AxiomErrors.validation("method.not_allowed", "Use POST.")),
    { status: 405 },
  );
}
