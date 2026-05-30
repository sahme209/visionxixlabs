/**
 * GET /api/connectors/azure/health — parity stub.
 *
 * Honest 'not implemented' for now. The full broker validation
 * + per-tenant decryption parity will land alongside the Azure
 * scanner pipeline. Until then this endpoint exists so the
 * dashboard's ConnectionHealth component can render uniformly
 * across providers.
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
    hint: "Azure live scanning is on the roadmap. Connector + posture today only.",
  });
}
