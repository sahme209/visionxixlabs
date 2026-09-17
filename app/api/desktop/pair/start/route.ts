import { NextResponse } from "next/server";
import { createPairingChallenge } from "@/lib/desktop/pairingChallenge";
import { asRecord, optionalString, requireString } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());
    const platformRaw = optionalString(body.platform, "platform");
    const platform = (["macos-arm", "macos-intel", "windows", "linux"] as const).find((value) => value === platformRaw) ?? "unknown";
    const challenge = createPairingChallenge({
      deviceFingerprint: requireString(body.deviceFingerprint, "deviceFingerprint", { max: 256 }),
      deviceLabel: requireString(body.deviceLabel, "deviceLabel", { max: 80 }),
      platform,
      desktopVersion: optionalString(body.desktopVersion, "desktopVersion", { max: 64 }),
    });
    const origin = new URL(request.url).origin;
    return NextResponse.json({
      challenge,
      verificationUrl: `${origin}/desktop/connect?challenge=${encodeURIComponent(challenge)}`,
      expiresInSeconds: 600,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start pairing." }, { status: 400 });
  }
}
