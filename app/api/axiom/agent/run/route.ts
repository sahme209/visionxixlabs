/**
 * POST /api/axiom/agent/run
 *
 * Start an Axiom Agent run. The agent scans the cloud account, analyzes
 * findings, builds an action plan, and returns results with approval items.
 *
 * Body: {
 *   provider: "aws" | "azure" | "gcp",
 *   connectedAccountId: string,
 *   organizationId: string,
 *   trigger?: "manual" | "scheduled" | "drift" | "onboarding" | "webhook"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { runAgent } from "@/lib/axiom/agent/runAgent";
import type { AgentTrigger } from "@/lib/axiom/agent/types";

const VALID_PROVIDERS = new Set(["aws", "azure", "gcp"]);
const VALID_TRIGGERS: Set<string> = new Set(["manual", "scheduled", "drift", "onboarding", "webhook"]);

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
    const { provider, connectedAccountId, organizationId, trigger } = body;

    if (!provider || !VALID_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: "provider must be 'aws', 'azure', or 'gcp'" }, { status: 400 });
    }

    if (!connectedAccountId || typeof connectedAccountId !== "string") {
      return NextResponse.json({ error: "connectedAccountId is required" }, { status: 400 });
    }

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const agentTrigger: AgentTrigger = VALID_TRIGGERS.has(trigger) ? trigger : "manual";

    const result = await runAgent({
      organizationId,
      userId,
      connectedAccountId,
      provider: provider as "aws" | "azure" | "gcp",
      trigger: agentTrigger,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[axiom agent/run]", e);
    return NextResponse.json({ error: "Agent run failed" }, { status: 500 });
  }
}
