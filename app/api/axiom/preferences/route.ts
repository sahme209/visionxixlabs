/**
 * GET  /api/axiom/preferences?organizationId=...  — load preferences
 * PUT  /api/axiom/preferences                     — update preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import { loadPreferences, savePreferences } from "@/lib/axiom/agent/preferences";
import type { PreferenceUpdates } from "@/lib/axiom/agent/preferences";

const VALID_RISK_TOLERANCE = new Set(["conservative", "moderate", "aggressive"]);
const VALID_APPROVAL_POLICY = new Set(["require_all", "auto_low_risk", "auto_safe"]);
const VALID_OUTPUT_FORMAT = new Set(["terraform", "cli", "json"]);
const VALID_BUSINESS_CONTEXT = new Set([
  "startup", "agency", "enterprise", "ecommerce",
  "healthcare", "fintech", "saas", "other",
]);
const VALID_CATEGORIES = new Set(["cost", "resilience", "security", "performance", "compliance"]);

async function authenticate() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) return null;

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const entitlements = getEntitlementsFromPlan(user?.plan ?? null);
  if (!entitlements.axiomExecution) return null;

  return userId;
}

export async function GET(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  const prefs = await loadPreferences(organizationId);

  return NextResponse.json({
    ...prefs,
    ignoredFindingTitles: Array.from(prefs.ignoredFindingTitles),
  });
}

export async function PUT(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { organizationId, ...rawUpdates } = body;

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  const errors: string[] = [];
  const updates: PreferenceUpdates = {};

  if (rawUpdates.riskTolerance !== undefined) {
    if (!VALID_RISK_TOLERANCE.has(rawUpdates.riskTolerance)) {
      errors.push("riskTolerance must be conservative, moderate, or aggressive");
    } else {
      updates.riskTolerance = rawUpdates.riskTolerance;
    }
  }

  if (rawUpdates.approvalPolicy !== undefined) {
    if (!VALID_APPROVAL_POLICY.has(rawUpdates.approvalPolicy)) {
      errors.push("approvalPolicy must be require_all, auto_low_risk, or auto_safe");
    } else {
      updates.approvalPolicy = rawUpdates.approvalPolicy;
    }
  }

  if (rawUpdates.outputFormat !== undefined) {
    if (!VALID_OUTPUT_FORMAT.has(rawUpdates.outputFormat)) {
      errors.push("outputFormat must be terraform, cli, or json");
    } else {
      updates.outputFormat = rawUpdates.outputFormat;
    }
  }

  if (rawUpdates.businessContext !== undefined) {
    if (!VALID_BUSINESS_CONTEXT.has(rawUpdates.businessContext)) {
      errors.push("Invalid businessContext");
    } else {
      updates.businessContext = rawUpdates.businessContext;
    }
  }

  if (rawUpdates.autoApplyEnabled !== undefined) {
    updates.autoApplyEnabled = Boolean(rawUpdates.autoApplyEnabled);
  }

  if (rawUpdates.preferredProviders !== undefined) {
    updates.preferredProviders = rawUpdates.preferredProviders;
  }

  if (rawUpdates.ignoredFindingTitles !== undefined) {
    updates.ignoredFindingTitles = rawUpdates.ignoredFindingTitles;
  }

  if (rawUpdates.priorityCategories !== undefined) {
    const cats = rawUpdates.priorityCategories as string[];
    if (cats.every((c: string) => VALID_CATEGORIES.has(c))) {
      updates.priorityCategories = cats;
    } else {
      errors.push("Invalid category in priorityCategories");
    }
  }

  if (rawUpdates.notes !== undefined) {
    updates.notes = rawUpdates.notes;
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const prefs = await savePreferences(organizationId, updates);

  return NextResponse.json({
    ...prefs,
    ignoredFindingTitles: Array.from(prefs.ignoredFindingTitles),
  });
}
