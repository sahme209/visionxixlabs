import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { statusFor, type DesktopSession } from "@/lib/desktop/privateDesktopSession";
import { createPrivatePrismaDesktopSessionStore } from "@/lib/desktop/privateDesktopSessionStore.prisma";
import { mintDesktopToken } from "@/lib/desktop/desktopToken";
import { asRecord, requireString } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

class PairingExpiredDuringConsumption extends Error {}

function presentSession(session: DesktopSession) {
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
          error: "This V19 version needs a security update. Download the latest signed installer, then start sign-in again.",
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

    const { sessionId, approvedByUserId, approvedOrganizationId } = record;
    const result = await prisma.$transaction(async tx => {
      // Keep the approved session stable through consumption, including against
      // concurrent revocation. Lock before reading its current binding and TTL.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "DesktopSessionRecord" WHERE id = ${sessionId} FOR SHARE
      `;
      if (locked.length !== 1) return { state: "unavailable" } as const;
      const session = await createPrivatePrismaDesktopSessionStore(tx).getById(sessionId);
      const claimedAt = new Date(Date.now());
      if (record.expiresAt <= claimedAt) throw new PairingExpiredDuringConsumption();
      if (!session || !Number.isFinite(Date.parse(session.expiresAt)) || statusFor(session, claimedAt) !== "active" ||
          !approvedByUserId || !approvedOrganizationId || session.id !== sessionId ||
          session.userId !== approvedByUserId || session.organizationId !== approvedOrganizationId ||
          session.deviceFingerprint !== deviceFingerprint) {
        return { state: "unavailable" } as const;
      }

      // Confirm signing readiness before changing the one-use record.
      const token = mintDesktopToken(session.id);
      const claimed = await tx.desktopPairingChallengeRecord.updateMany({
        where: {
          id: challenge,
          deviceFingerprint,
          status: "approved",
          sessionId,
          approvedByUserId,
          approvedOrganizationId,
          consumedAt: null,
          expiresAt: { gt: claimedAt },
        },
        data: { consumedAt: claimedAt, status: "consumed" },
      });
      if (claimed.count !== 1) return { state: "used" } as const;
      const now = new Date(Date.now());
      if (record.expiresAt <= now || statusFor(session, now) !== "active") {
        throw new PairingExpiredDuringConsumption();
      }
      return { state: "approved", token, session: presentSession(session) } as const;
    });

    if (result.state === "unavailable") {
      return NextResponse.json({ error: "The approved desktop session is no longer available for this request." }, { status: 410 });
    }
    if (result.state === "used") {
      return NextResponse.json({ error: "Pairing request was already used. Start a new sign-in." }, { status: 409 });
    }
    return NextResponse.json(
      { status: "approved", token: result.token, session: result.session },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PairingExpiredDuringConsumption) {
      return NextResponse.json({ error: "Pairing request expired. Start again from the desktop app." }, { status: 410 });
    }
    const correlationId = `desktop_pair_status_${crypto.randomUUID()}`;
    console.error(`[${correlationId}] Desktop pairing status failed`, error);
    return NextResponse.json(
      { error: "Desktop sign-in status could not be checked.", correlationId },
      { status: 503 },
    );
  }
}
