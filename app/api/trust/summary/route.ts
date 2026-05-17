/**
 * GET /api/trust/summary
 *
 * Composite trust posture for the authenticated tenant. Aggregates:
 *   - Control implementation status (lib/compliance/controlRegistry)
 *   - Evidence coverage (lib/compliance/evidenceCollector)
 *   - Recent audit-event volume (lib/audit/secureAudit query)
 *
 * Inspect-only. No mutations. Tenant-scoped.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { CONTROL_REGISTRY, summarizeControls } from "@/lib/compliance/controlRegistry";
import { collectForTenant, summarizeEvidence } from "@/lib/compliance/evidenceCollector";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    // Control posture — same registry across all tenants today.
    const controlSummary = summarizeControls(CONTROL_REGISTRY);

    // Evidence — tenant-scoped pull.
    const evidence = await collectForTenant(ctx.organizationId);
    const evidenceSummary = summarizeEvidence(evidence);

    // Honest source-mode rollup — if every control is `implemented` AND
    // evidence is non-empty, we're "live"; partial mixes drop us to
    // "partial"; otherwise "preview".
    const live = controlSummary.implemented;
    const total = controlSummary.total;
    let sourceMode: "live" | "partial" | "preview" = "preview";
    if (total > 0 && live === total && evidenceSummary.verified > 0) sourceMode = "live";
    else if (live > 0) sourceMode = "partial";

    return NextResponse.json(
      apiSuccess({
        generatedAt: new Date().toISOString(),
        sourceMode,
        controls: {
          total: controlSummary.total,
          implemented: controlSummary.implemented,
          partial: controlSummary.partial,
          planned: controlSummary.planned,
          notApplicable: controlSummary.notApplicable,
          score: controlSummary.score,
        },
        evidence: {
          total: evidenceSummary.total,
          verified: evidenceSummary.verified,
          selfAttested: evidenceSummary.selfAttested,
          manual: evidenceSummary.manual,
          unverified: evidenceSummary.unverified,
          coverageScore: evidenceSummary.coverageScore,
        },
        limitations: total === 0
          ? ["Control registry is empty — load the canonical registry."]
          : evidence.length === 0
          ? ["No evidence has been collected for this tenant yet. Run a scan or operating-loop pass."]
          : [],
        safeNextAction: evidence.length === 0
          ? { label: "Run platform readiness", href: "/api/readiness" }
          : { label: "Open Trust Center", href: "/dashboard/trust" },
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }
