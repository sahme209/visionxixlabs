import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { createDesktopSession, getDesktopSession, statusFor } from "@/lib/desktop/desktopSession";
import { verifyPairingChallenge } from "@/lib/desktop/pairingChallenge";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.userId || !ctx.organizationId) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const { challenge } = await request.json() as { challenge?: string };
    const pending = verifyPairingChallenge(challenge ?? "");
    const existing = await getDesktopSession(pending.pairingId);
    const session = existing && statusFor(existing) === "active" ? existing : await createDesktopSession({
      id: pending.pairingId,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      deviceFingerprint: pending.deviceFingerprint,
      deviceLabel: pending.deviceLabel,
      platform: pending.platform,
      desktopVersion: pending.desktopVersion,
    });
    return NextResponse.json({ ok: true, deviceLabel: session.deviceLabel, expiresAt: session.expiresAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve pairing." }, { status: 400 });
  }
}
