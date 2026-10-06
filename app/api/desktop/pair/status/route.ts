import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getDesktopSession, statusFor } from "@/lib/desktop/desktopSession";
import { mintDesktopToken } from "@/lib/desktop/desktopToken";
import { asRecord, requireString } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

function presentSession(session: NonNullable<Awaited<ReturnType<typeof getDesktopSession>>>) {
  return {
    id: session.id,
    deviceLabel: session.deviceLabel,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    status: statusFor(session),
  };
}

export async function POST(request: NextRequest) {
  let challenge: string;
  let deviceFingerprint: string;
  try {
    const body = asRecord(await request.json().catch(() => ({})));
    challenge = requireString(body.challenge, "challenge", { max: 96 });
    try {
      deviceFingerprint = requireString(body.deviceFingerprint, "deviceFingerprint", { max: 256 });
    } catch {
      // Earlier signed desktop builds created a pairing challenge correctly but
      // omitted the device binding when polling its status. Do not fall back to
      // challenge-only completion: anyone who obtains a browser URL could then
      // claim the approved session. Tell the user to upgrade instead.
      return NextResponse.json(
        {
          code: "desktop_update_required",
          error: "This Axiom Agent version needs a security update. Download the latest signed installer, then start sign-in again.",
        },
        { status: 426 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The pairing request is invalid." },
      { status: 400 },
    );
  }

  try {
    const record = await prisma.desktopPairingChallengeRecord.findUnique({ where: { id: challenge } });
    if (!record) return NextResponse.json({ error: "Pairing request not found." }, { status: 404 });
    if (record.deviceFingerprint !== deviceFingerprint) {
      return NextResponse.json({ error: "This pairing request belongs to another device." }, { status: 403 });
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Pairing request expired. Start again from the desktop app." }, { status: 410 });
    }
    if (record.consumedAt) {
      return NextResponse.json({ error: "Pairing request was already used. Start a new sign-in." }, { status: 409 });
    }
    if (!record.sessionId || record.status !== "approved") {
      return NextResponse.json({ status: "pending" }, { status: 202 });
    }

    const session = await getDesktopSession(record.sessionId);
    if (!session || statusFor(session) !== "active") {
      return NextResponse.json({ error: "The approved desktop session is no longer active." }, { status: 410 });
    }
    const claimed = await prisma.desktopPairingChallengeRecord.updateMany({
      where: { id: challenge, consumedAt: null },
      data: { consumedAt: new Date(), status: "consumed" },
    });
    if (claimed.count !== 1) {
      return NextResponse.json({ error: "Pairing request was already used. Start a new sign-in." }, { status: 409 });
    }
    return NextResponse.json({
      status: "approved",
      token: mintDesktopToken(session.id),
      session: presentSession(session),
    });
  } catch (error) {
    const correlationId = `desktop_pair_status_${crypto.randomUUID()}`;
    console.error(`[${correlationId}] Desktop pairing status failed`, error);
    return NextResponse.json(
      { error: "Desktop sign-in status could not be checked.", correlationId },
      { status: 503 },
    );
  }
}
