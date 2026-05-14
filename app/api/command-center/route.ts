/**
 * GET /api/command-center
 *
 * Returns the canonical CommandCenterState for the authenticated user.
 * The Command Center + dashboard pages call this rather than building
 * isolated mock state per page.
 */

import { NextResponse } from "next/server";
import { getCommandCenterState } from "@/lib/platform/getCommandCenterState";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const state = await getCommandCenterState();
    return NextResponse.json(apiSuccess(state), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
