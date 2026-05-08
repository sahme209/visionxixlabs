/**
 * POST /api/axiom/agent/onboard
 *
 * First-run onboarding experience. Validates the cloud connection, runs the
 * agent scan, and returns a rich summary with next-step actions.
 *
 * Body: {
 *   provider: "aws" | "azure" | "gcp",
 *   connectedAccountId: string,
 *   organizationId: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { runFirstExperience } from "@/lib/axiom/agent/onboarding";

const VALID_PROVIDERS = new Set(["aws", "azure", "gcp"]);

export async function POST(req: NextRequest) {
  try {
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
    if (!entitlements.axiomExecution) {
      return NextResponse.json(
        { error: "Scale or Enterprise plan required. Upgrade at /visionxix-ai/pricing" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { provider, connectedAccountId, organizationId } = body;

    if (!provider || !VALID_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: "provider must be 'aws', 'azure', or 'gcp'" }, { status: 400 });
    }

    if (!connectedAccountId || typeof connectedAccountId !== "string") {
      return NextResponse.json({ error: "connectedAccountId is required" }, { status: 400 });
    }

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const summary = await runFirstExperience({
      organizationId,
      userId,
      connectedAccountId,
      provider: provider as "aws" | "azure" | "gcp",
    });

    return NextResponse.json(summary);
  } catch (e) {
    console.error("[axiom agent/onboard]", e);
    return NextResponse.json({ error: "Onboarding failed" }, { status: 500 });
  }
}
