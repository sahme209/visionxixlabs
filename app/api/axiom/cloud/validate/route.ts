/**
 * POST /api/axiom/cloud/validate
 *
 * Validates a cloud provider connection and returns account info,
 * accessible regions, and detected permissions.
 *
 * Body: {
 *   provider: "aws" | "azure" | "gcp",
 *   connectedAccountId: string   // credential reference in vault
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { getAdapter, isImplemented } from "@/lib/axiom/provider/registry";

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

  if (!isImplemented(provider, "validateConnection")) {
    return NextResponse.json(
      { error: `${provider} connection validation is not yet available.` },
      { status: 501 },
    );
  }

  try {
    const adapter = getAdapter(provider);
    const result = await adapter.validateConnection(userId, connectedAccountId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === "invalid_credentials" ? 401 : 400 },
      );
    }

    return NextResponse.json({
      provider,
      ...result.data,
    });
  } catch (e) {
    console.error(`[axiom cloud/validate ${provider}]`, e);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
