/**
 * GET /api/trust/evidence
 *
 * Tenant-scoped evidence pull. Lists evidence records the platform has
 * collected from audit + traces + security scans + remediation +
 * approval + desktop handoffs.
 *
 * Optional filters: ?control=<id>&kind=<bundle-kind>
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import {
  collectForControl,
  collectForSecurityReview,
  collectForTenant,
  summarizeEvidence,
} from "@/lib/compliance/evidenceCollector";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const url = new URL(request.url);
    const control = url.searchParams.get("control");
    const kind = url.searchParams.get("kind");

    let records;
    if (control) {
      records = await collectForControl(control, { organizationId: ctx.organizationId });
    } else if (kind === "security") {
      records = await collectForSecurityReview({ organizationId: ctx.organizationId });
    } else {
      records = await collectForTenant(ctx.organizationId);
    }

    return NextResponse.json(
      apiSuccess({
        generatedAt: new Date().toISOString(),
        summary: summarizeEvidence(records),
        records,
        limitations: records.length === 0
          ? ["No evidence collected yet — run a platform scan or operating-loop pass."]
          : [],
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> { return GET(request); }
