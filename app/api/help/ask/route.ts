/**
 * GET/POST /api/help/ask
 *
 * Returns the HelpAnswer for a natural-language query. Pure local
 * keyword scorer — no LLM call, no network. Answers always come
 * from the typed HELP_ENTRIES table. When nothing scores above the
 * floor, the response honestly says "no_match".
 *
 * Query params or body:
 *   - q (string, required)
 *   - limit (optional, 1..20)
 */

import type { NextRequest } from "next/server";
import { searchHelp } from "@/lib/help/helpSearchEngine";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    let q = req.nextUrl.searchParams.get("q") ?? "";
    const limitRaw = req.nextUrl.searchParams.get("limit");
    let limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

    if (req.method === "POST") {
      try {
        const body = (await req.json()) as { q?: string; limit?: number } | null;
        if (body?.q) q = body.q;
        if (typeof body?.limit === "number") limit = body.limit;
      } catch {
        // Empty body — fall back to query params.
      }
    }

    if (!q || q.trim().length === 0) {
      throw AxiomErrors.validation("help.q.required", "Query param 'q' is required.");
    }

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(20, limit as number)) : 5;
    const answer = searchHelp(q.slice(0, 500), safeLimit);
    return apiOk(answer, {
      correlationId,
      safetyContract: "trust_center_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "trust_center_read_only" });
  }
}
