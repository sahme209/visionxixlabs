/**
 * GET /api/desktop/release-manifest
 *
 * Returns the live per-platform desktop download manifest from GitHub
 * Releases. Public — no auth required so the marketing /download page
 * can render it for first-time visitors.
 */

import { NextResponse } from "next/server";
import { getDesktopReleaseManifest } from "@/lib/desktop/releaseManifest";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(): Promise<NextResponse> {
  try {
    const manifest = await getDesktopReleaseManifest();
    return NextResponse.json(apiSuccess(manifest), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
