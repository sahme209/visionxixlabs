/**
 * GET /api/safety/automation-boundaries
 *
 * Returns the canonical Automation Boundary Report — every action
 * class Axiom can perform and its hard-literal classification. This
 * is the spine the platform leans on to refuse unsafe automation.
 *
 * Pure read-only. No tenant scope needed — boundaries are platform-wide.
 */

import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildAutomationBoundaryReport } from "@/lib/safety/automationBoundaryDetector";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildAutomationBoundaryReport();
    return NextResponse.json(apiSuccess(report), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return GET(); }
