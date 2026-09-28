import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { createDesktopSession } from "@/lib/desktop/desktopSession";
import { evaluatePairingPolicy } from "@/lib/desktop/desktopAuthPolicy";

export const dynamic = "force-dynamic";

async function authorizedRequest(request: NextRequest, challengeInput?: string) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId) {
    return { response: NextResponse.json({ error: "auth_required" }, { status: 401 }) } as const;
  }
  const userId = ctx.userId;
  const organizationId = ctx.organizationId;
  const challenge = (challengeInput ?? request.nextUrl.searchParams.get("challenge"))?.trim();
  if (!challenge) return { response: NextResponse.json({ error: "challenge_required" }, { status: 400 }) } as const;
  const record = await prisma.desktopPairingChallengeRecord.findUnique({ where: { id: challenge } });
  if (!record) return { response: NextResponse.json({ error: "pairing_not_found" }, { status: 404 }) } as const;
  if (record.expiresAt.getTime() <= Date.now()) {
    return { response: NextResponse.json({ error: "pairing_expired" }, { status: 410 }) } as const;
  }
  return { ctx, userId, organizationId, challenge, record } as const;
}

export async function GET(request: NextRequest) {
  const auth = await authorizedRequest(request);
  if ("response" in auth) return auth.response;
  return NextResponse.json({
    ok: true,
    request: {
      deviceLabel: auth.record.deviceLabel,
      platform: auth.record.platform,
      desktopVersion: auth.record.desktopVersion,
      expiresAt: auth.record.expiresAt.toISOString(),
      status: auth.record.status,
    },
    workspace: { label: auth.ctx.workspaceLabel, email: auth.ctx.email },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { challenge?: unknown };
  const challenge = typeof body.challenge === "string" ? body.challenge : undefined;
  const auth = await authorizedRequest(request, challenge);
  if ("response" in auth) return auth.response;
  if (auth.record.sessionId || auth.record.status === "approved" || auth.record.status === "consumed") {
    return NextResponse.json({ ok: true, status: auth.record.status });
  }

  const decision = await evaluatePairingPolicy(auth.ctx, {
    deviceFingerprint: auth.record.deviceFingerprint,
    deviceLabel: auth.record.deviceLabel,
    platform: auth.record.platform as "macos-arm" | "macos-intel" | "windows" | "linux" | "unknown",
    desktopVersion: auth.record.desktopVersion ?? undefined,
  });
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.code, message: decision.reason }, { status: 403 });
  }

  const claimed = await prisma.desktopPairingChallengeRecord.updateMany({
    where: { id: auth.challenge, status: "pending", sessionId: null, consumedAt: null },
    data: {
      status: "approving",
      approvedByUserId: auth.userId,
      approvedOrganizationId: auth.organizationId,
    },
  });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: "pairing_already_in_progress" }, { status: 409 });
  }

  try {
    const session = await createDesktopSession({
      userId: auth.userId,
      organizationId: auth.organizationId,
      deviceFingerprint: auth.record.deviceFingerprint,
      deviceLabel: auth.record.deviceLabel,
      platform: auth.record.platform as "macos-arm" | "macos-intel" | "windows" | "linux" | "unknown",
      desktopVersion: auth.record.desktopVersion ?? undefined,
    });
    await prisma.desktopPairingChallengeRecord.update({
      where: { id: auth.challenge },
      data: { status: "approved", sessionId: session.id, approvedAt: new Date() },
    });
    return NextResponse.json({ ok: true, status: "approved" });
  } catch (error) {
    await prisma.desktopPairingChallengeRecord.updateMany({
      where: { id: auth.challenge, status: "approving", sessionId: null },
      data: { status: "pending", approvedByUserId: null, approvedOrganizationId: null },
    });
    const correlationId = `desktop_pair_approve_${crypto.randomUUID()}`;
    console.error(`[${correlationId}] Desktop pairing approval failed`, error);
    return NextResponse.json({
      error: "pairing_approval_failed",
      message: "The desktop could not be approved. Try again or contact your administrator with the reference below.",
      correlationId,
    }, { status: 500 });
  }
}
