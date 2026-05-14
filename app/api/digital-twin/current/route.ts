/**
 * GET /api/digital-twin/current
 *
 * Same as /api/digital-twin/build today. The naming reserves space for a
 * cached / latest-twin endpoint once the twin is persisted in Prisma.
 */

import { NextResponse } from "next/server";
import { buildDigitalTwin } from "@/lib/digitalTwin/digitalTwinBuilder";
import { currentContext } from "@/lib/auth/currentContext";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

async function handle(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const twin = await buildDigitalTwin();
    return NextResponse.json(apiSuccess({ twin, persisted: false, note: "Twins are not yet persisted; this returns a freshly built twin." }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function POST(): Promise<NextResponse> { return handle(); }
export async function GET():  Promise<NextResponse> { return handle(); }
