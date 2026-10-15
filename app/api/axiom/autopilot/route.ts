/**
 * GET  /api/axiom/autopilot?cloudAccountId=...  — get current mode + UX copy
 * PUT  /api/axiom/autopilot                     — change mode for a cloud account
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import {
  resolvePolicy,
  changeAutopilotMode,
  loadAutopilotMode,
  getModeConfirmationCopy,
  MODE_COPY,
  MODE_ORDER,
  isEscalation,
} from "@/lib/axiom/agent/autopilot";
import type { AutopilotMode } from "@/lib/axiom/agent/autopilot";

const VALID_MODES = new Set<string>(["observe_only", "recommend", "assisted_apply", "full_guarded"]);

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

// The selected account owns the tenant boundary. Request-body organization IDs
// cannot establish membership or administrative authority.
async function acceptedMembership(userId: string, organizationId: string, manage = false): Promise<boolean> {
  try {
    const membership = await prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { acceptedAt: true, role: true },
    });
    if (!membership?.acceptedAt) return false;
    return manage
      ? membership.role === "owner" || membership.role === "admin"
      : ["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"].includes(membership.role);
  } catch { return false; }
}
const unavailableAccount = () => NextResponse.json({ error: "Cloud account not found" }, { status: 404 });

export async function GET(req: NextRequest) {
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cloudAccountId = req.nextUrl.searchParams.get("cloudAccountId");
  if (!cloudAccountId) {
    return NextResponse.json({ error: "cloudAccountId is required" }, { status: 400 });
  }

  const account = await prisma.cloudAccount.findUnique({ where: { id: cloudAccountId } });
  if (!account || !await acceptedMembership(userId, account.organizationId)) return unavailableAccount();

  const currentMode = await loadAutopilotMode(cloudAccountId);
  const policy = resolvePolicy(currentMode);
  const copy = MODE_COPY[currentMode];

  const recentEvents = await prisma.axiomAutopilotEvent.findMany({
    where: { cloudAccountId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      eventType: true,
      previousMode: true,
      newMode: true,
      reason: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    currentMode,
    policy,
    copy,
    allModes: MODE_ORDER.map((m) => ({
      mode: m,
      ...MODE_COPY[m],
      isCurrent: m === currentMode,
      isEscalation: isEscalation(currentMode, m),
    })),
    recentEvents,
  });
}

export async function PUT(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "invalid_request_origin" }, { status: 403 });
  }
  const userId = await authenticate();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const { cloudAccountId, mode, organizationId } = body as Record<string, unknown>;

  if (!cloudAccountId || typeof cloudAccountId !== "string") {
    return NextResponse.json({ error: "cloudAccountId is required" }, { status: 400 });
  }

  if (!organizationId || typeof organizationId !== "string") {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  if (typeof mode !== "string" || !VALID_MODES.has(mode)) {
    return NextResponse.json(
      { error: "mode must be observe_only, recommend, assisted_apply, or full_guarded" },
      { status: 400 },
    );
  }

  const account = await prisma.cloudAccount.findUnique({
    where: { id: cloudAccountId },
  });

  if (!account || account.organizationId !== organizationId || !await acceptedMembership(userId, account.organizationId, true)) {
    return unavailableAccount();
  }

  if (account.credentialRef?.startsWith("cloud-v2:") && mode !== "observe_only") {
    return NextResponse.json({ error: "scoped_enrollment_agent_unavailable" }, { status: 409 });
  }

  const previousMode = account.autopilotMode as AutopilotMode;
  const result = await changeAutopilotMode(cloudAccountId, account.organizationId, userId, mode as AutopilotMode);
  const newPolicy = resolvePolicy(result.newMode);
  const newCopy = MODE_COPY[result.newMode];

  return NextResponse.json({
    previousMode: result.previousMode,
    newMode: result.newMode,
    policy: newPolicy,
    copy: newCopy,
    confirmationMessage: getModeConfirmationCopy(previousMode, mode as AutopilotMode),
  });
}
