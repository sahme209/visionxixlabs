import { NextResponse } from "next/server";
import { getDesktopSession, statusFor } from "@/lib/desktop/desktopSession";
import { mintDesktopToken } from "@/lib/desktop/desktopToken";
import { verifyPairingChallenge } from "@/lib/desktop/pairingChallenge";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { challenge } = await request.json() as { challenge?: string };
    const pending = verifyPairingChallenge(challenge ?? "");
    const session = await getDesktopSession(pending.pairingId);
    if (!session) return NextResponse.json({ status: "pending" }, { status: 202 });
    if (statusFor(session) !== "active") return NextResponse.json({ error: "Pairing session is no longer active." }, { status: 410 });
    return NextResponse.json({
      status: "approved",
      token: mintDesktopToken(session.id),
      session: {
        id: session.id,
        deviceLabel: session.deviceLabel,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check pairing." }, { status: 400 });
  }
}
