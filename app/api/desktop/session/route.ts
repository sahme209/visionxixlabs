/**
 * Desktop pairing session endpoint.
 *
 *  POST   /api/desktop/session  — Web user mints a new pairing token. The
 *                                 web flow shows the token once for the
 *                                 user to paste into the desktop app.
 *  DELETE /api/desktop/session?id=… — Revoke a pairing.
 *  GET    /api/desktop/session  — List the caller's active pairings (for UI).
 *
 * Authenticated routes — the web user must be signed in via NextAuth. The
 * desktop client never hits these directly; pairing is operator-driven
 * from the web app.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { evaluatePairingPolicy } from "@/lib/desktop/desktopAuthPolicy";
import {
  createDesktopSession,
  listActiveSessions,
  revokeDesktopSession,
  statusFor,
  type DesktopSession,
} from "@/lib/desktop/desktopSession";
import { mintDesktopToken } from "@/lib/desktop/desktopToken";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, requireString, optionalString } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

function presentSession(s: DesktopSession) {
  return {
    id: s.id,
    deviceLabel: s.deviceLabel,
    platform: s.platform,
    desktopVersion: s.desktopVersion,
    issuedAt: s.issuedAt,
    expiresAt: s.expiresAt,
    lastSeenAt: s.lastSeenAt,
    status: statusFor(s),
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    const body = asRecord(await request.json().catch(() => ({})));
    const deviceFingerprint = requireString(body.deviceFingerprint, "deviceFingerprint", { max: 256 });
    const deviceLabel       = requireString(body.deviceLabel,       "deviceLabel",       { max: 80 });
    const platformRaw       = optionalString(body.platform,         "platform");
    const desktopVersion    = optionalString(body.desktopVersion,   "desktopVersion", { max: 64 });
    const platform = (["macos-arm", "macos-intel", "windows", "linux"] as const).find((p) => p === platformRaw) ?? "unknown";

    const decision = await evaluatePairingPolicy(ctx, { deviceFingerprint, deviceLabel, platform, desktopVersion });
    if (!decision.allowed) {
      throw AxiomErrors.policy(decision.code, decision.reason);
    }

    const session = await createDesktopSession({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      deviceFingerprint,
      deviceLabel,
      platform,
      desktopVersion,
    });

    const token = mintDesktopToken(session.id);

    return NextResponse.json(
      apiSuccess({
        token,
        session: presentSession(session),
      }),
      { status: 201 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const sessions = (await listActiveSessions(ctx.userId))
      .filter((session) => session.organizationId === ctx.organizationId);
    return NextResponse.json(apiSuccess({ sessions: sessions.map(presentSession) }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const sessionId = new URL(request.url).searchParams.get("id");
    if (!sessionId) {
      throw AxiomErrors.validation("desktop.session.missing_id", "Session id is required.");
    }
    // Make sure the caller owns the session before revoking.
    const mine = await listActiveSessions(ctx.userId);
    if (!mine.some((s) => s.id === sessionId && s.organizationId === ctx.organizationId)) {
      throw AxiomErrors.validation("desktop.session.not_found", "Session not found or not owned by caller.");
    }
    await revokeDesktopSession(sessionId, "Revoked from web UI by owner.");
    return NextResponse.json(apiSuccess({ revoked: sessionId }), { status: 200 });
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}
