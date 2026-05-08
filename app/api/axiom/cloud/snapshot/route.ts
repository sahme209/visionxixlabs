/**
 * POST /api/axiom/cloud/snapshot
 *
 * Collect a cloud snapshot from a connected account.
 * Returns normalized CloudSnapshot with resources, cost estimates,
 * and provider-specific metadata.
 *
 * Body: {
 *   provider: "aws" | "azure" | "gcp",
 *   connectedAccountId: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { getAdapter } from "@/lib/axiom/provider/registry";
import { normalizeSnapshot } from "@/lib/axiom/normalizer";

const VALID_PROVIDERS = new Set(["aws", "azure", "gcp"]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
  if (!entitlements.axiomScan) {
    return NextResponse.json({ error: "Cloud scanning requires a paid plan." }, { status: 403 });
  }

  const body = await req.json();
  const { provider, connectedAccountId } = body;

  if (!provider || !VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "provider must be 'aws', 'azure', or 'gcp'" }, { status: 400 });
  }

  if (!connectedAccountId || typeof connectedAccountId !== "string") {
    return NextResponse.json({ error: "connectedAccountId is required" }, { status: 400 });
  }

  try {
    const adapter = getAdapter(provider);
    const result = await adapter.collectSnapshot(userId, connectedAccountId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === "invalid_credentials" ? 401 : 500 },
      );
    }

    const rawSnapshot = result.data;
    const normalized = normalizeSnapshot(rawSnapshot);
    const costResult = adapter.estimateCosts(rawSnapshot);

    return NextResponse.json({
      snapshot: normalized,
      costSignals: costResult.ok ? costResult.data : null,
      dataQuality: normalized.dataQuality,
      providerEvidence: normalized.providerEvidence,
      computeCount: normalized.resources.filter((r) => r.resourceType === "compute").length,
      storageCount: normalized.resources.filter((r) => r.resourceType === "storage").length,
      regionCount: normalized.regions.length,
      estimatedMonthlySpend: normalized.monthlySpend,
    });
  } catch (e) {
    console.error(`[axiom cloud/snapshot ${provider}]`, e);
    return NextResponse.json({ error: "Snapshot collection failed" }, { status: 500 });
  }
}
