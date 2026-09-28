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
import { readDesktopRuntimeReadiness } from "@/lib/desktop/desktopRuntimeReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(): Promise<NextResponse> {
  try {
    const [manifest, runtime] = await Promise.all([
      getDesktopReleaseManifest(),
      readDesktopRuntimeReadiness(),
    ]);
    return NextResponse.json(apiSuccess({
      ...manifest,
      runtimeReady: runtime.ready,
      runtimeMessage: runtime.message,
    }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
