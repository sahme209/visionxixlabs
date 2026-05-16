/**
 * POST /api/releaseops/scan
 *
 * On-demand ReleaseOps scan. Same data shape as
 * `/api/releaseops/state`, but always re-runs the underlying sync. Audited.
 *
 * Read-only; never mutates GitHub.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { getReleaseOpsState } from "@/lib/releaseops/getReleaseOpsState";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, optionalString } from "@/lib/security/validation";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { loadAppEnv } from "@/lib/config/env";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = `relops_scan_${Date.now().toString(36)}` as CorrelationId;
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = asRecord(await request.json().catch(() => ({})));
    const env = loadAppEnv();
    const organization = optionalString(body.organization, "organization", { max: 80 }) ?? env.githubDefaultOrg;

    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "scan.start",
      outcome: "success",
      entityRef: `releaseops:${organization ?? "default"}`,
      correlationId,
      detail: { organization: organization ?? "unspecified" },
    });

    const state = await getReleaseOpsState({ organization });

    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: state.source === "disabled" ? "scan.failure" : "scan.success",
      outcome: state.source === "disabled" ? "blocked" : "success",
      entityRef: `releaseops:${organization ?? "default"}`,
      correlationId,
      detail: {
        source: state.source,
        readinessScore: state.readiness.score,
        readinessGrade: state.readiness.grade,
        blockerCount: state.readiness.blockers.length,
        repoCount: state.inventory.repos.length,
        workflowCount: state.inventory.workflows.length,
        limitationCount: state.limitations.length,
      },
      errorCode: state.source === "disabled" ? "releaseops.disabled" : undefined,
    });

    return NextResponse.json(apiSuccess(state), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
