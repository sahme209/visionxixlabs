/**
 * GET /api/connectors/gcp/health — parity stub.
 *
 * Honest 'not implemented' for now. Symmetric with /api/connectors/
 * azure/health so the dashboard's ConnectionHealth component can
 * render uniformly across providers.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await requireContext();
  return NextResponse.json({
    ok: true,
    healthy: false,
    reason: "not_implemented",
    hint: "GCP live scanning is on the roadmap. Connector + posture today only.",
  });
}
