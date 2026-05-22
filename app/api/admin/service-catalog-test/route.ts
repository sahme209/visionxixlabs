/**
 * GET /api/admin/service-catalog-test — admin only.
 *
 * Runs the live serviceCatalogExtractor against the configured
 * connectors and returns the discovered services. Used to verify the
 * extractor in production against the tenant's real AWS / GCP / GitHub.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { currentContext } from "@/lib/auth/currentContext";
import { extractServiceCatalog } from "@/lib/platform/native/serviceCatalogExtractor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, reason: "Not signed in." }, { status: 401 });
  }

  const result = await extractServiceCatalog({ organizationId: ctx.organizationId });

  return NextResponse.json({
    ok: true,
    organizationId: ctx.organizationId,
    durationMs: result.durationMs,
    perConnector: result.perConnector,
    catalogSummary: {
      totalServices: result.catalog.services.length,
      totalEnvironments: result.catalog.environments.length,
      byKind: result.catalog.services.reduce<Record<string, number>>((acc, s) => {
        acc[s.kind] = (acc[s.kind] ?? 0) + 1;
        return acc;
      }, {}),
      byConnector: result.catalog.services.reduce<Record<string, number>>((acc, s) => {
        for (const src of s.discoveredFrom) acc[src] = (acc[src] ?? 0) + 1;
        return acc;
      }, {}),
    },
    sample: result.catalog.services.slice(0, 10).map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      tier: s.tier,
      discoveredFrom: s.discoveredFrom,
    })),
  });
}
