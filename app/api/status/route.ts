/**
 * GET /api/status
 *
 * Public, unauthenticated. Returns the typed PublicStatusReport so
 * external uptime probes can hit a single JSON endpoint.
 */

import type { NextRequest } from "next/server";
import { buildPublicStatus } from "@/lib/status/publicStatusBuilder";
import { resolveCorrelationId } from "@/lib/api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  const report = await buildPublicStatus();
  // Public endpoint: return raw report (no apiOk envelope) so probes
  // can parse it without our internal wrapper.
  return NextResponse.json(report, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "x-correlation-id": correlationId,
      "x-axiom-safety-contract": "trust_center_read_only",
    },
  });
}
