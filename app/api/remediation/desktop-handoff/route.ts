/**
 * POST /api/remediation/desktop-handoff
 *
 * Returns a *preview* of the desktop handoff Axiom would sign for a given
 * remediation candidate. Never signs or transmits a real handoff — the
 * real signing path is `/api/desktop/handoff` and requires a typed
 * approval id + policy decision id from the approvals + governance
 * surfaces.
 *
 * Body: { candidateId: string }
 */

import { NextResponse } from "next/server";
import { runRemediationPipeline } from "@/lib/remediation/remediationPipeline";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

function isValidBody(value: unknown): value is { candidateId: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.candidateId === "string" && v.candidateId.length > 0;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");

    const body = await req.json().catch(() => null);
    if (!isValidBody(body)) throw AxiomErrors.validation("handoff.bad_input", "Missing 'candidateId'.");

    const outcome = await runRemediationPipeline();
    const bundle = outcome.bundles.find((b) => b.candidate.id === body.candidateId);
    if (!bundle) throw AxiomErrors.notFound("handoff.candidate_missing", "Remediation candidate not found in current pipeline run.");

    // Honest preview — never signs.
    const eligibility = bundle.candidate.desktopReviewEligibility;
    const eligible = eligibility === "eligible";

    return NextResponse.json(apiSuccess({
      candidateId: bundle.candidate.id,
      title: bundle.candidate.title,
      eligibility,
      eligible,
      reasonIfNotEligible: !eligible ? `Eligibility: ${eligibility}.` : undefined,
      preview: {
        allowedOperation: eligible ? "review_only" : "verify_only",
        requiredCapabilities: ["review", "verify"] as const,
        artifacts: [
          { kind: "terraform",    fileName: bundle.terraform.fileName,    bytes: bundle.terraform.hcl.length,    sha256: "preview" },
          { kind: "cli",          fileName: `cli_${bundle.candidate.id}.txt`, bytes: bundle.cli.command.length,    sha256: "preview" },
          { kind: "rollback",     fileName: `rollback_${bundle.candidate.id}.md`, bytes: 0, sha256: "preview" },
          { kind: "verification", fileName: `verification_${bundle.candidate.id}.md`, bytes: 0, sha256: "preview" },
        ],
        resourceSummary: {
          total: bundle.candidate.resourceIds.length,
          byProvider: { [bundle.candidate.provider]: bundle.candidate.resourceIds.length },
          blastRadius: bundle.candidate.riskLevel === "critical" ? "broad" : bundle.candidate.riskLevel === "high" ? "moderate" : "contained",
        },
        notes: [
          "Preview only — Axiom does not sign or transmit this handoff from this endpoint.",
          "Real signing requires a typed approval id and policy decision id.",
          "Local apply remains blocked until governance + signed binaries land.",
        ],
      },
    }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    apiFailure(AxiomErrors.validation("method.not_allowed", "Use POST.")),
    { status: 405 },
  );
}
