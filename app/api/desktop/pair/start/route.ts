import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { asRecord, optionalString, requireString } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

const PLATFORMS = new Set(["macos-arm", "macos-intel", "windows", "linux", "unknown"]);
const INTENTS = new Set(["sign_in", "sign_up"]);

export async function POST(request: NextRequest) {
  let deviceFingerprint: string;
  let deviceLabel: string;
  let platform: string;
  let desktopVersion: string | undefined;
  let intent: "sign_in" | "sign_up" = "sign_in";
  try {
    const body = asRecord(await request.json().catch(() => ({})));
    deviceFingerprint = requireString(body.deviceFingerprint, "deviceFingerprint", { max: 256 });
    deviceLabel = requireString(body.deviceLabel, "deviceLabel", { max: 80 });
    const requestedPlatform = optionalString(body.platform, "platform") ?? "unknown";
    platform = PLATFORMS.has(requestedPlatform) ? requestedPlatform : "unknown";
    desktopVersion = optionalString(body.desktopVersion, "desktopVersion", { max: 64 });
    const requestedIntent = optionalString(body.intent, "intent", { max: 16 }) ?? "sign_in";
    if (!INTENTS.has(requestedIntent)) throw new Error("intent must be sign_in or sign_up.");
    intent = requestedIntent as "sign_in" | "sign_up";
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The desktop pairing request is invalid." },
      { status: 400 },
    );
  }

  const challenge = `pair_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  try {

    await prisma.desktopPairingChallengeRecord.create({
      data: { id: challenge, deviceFingerprint, deviceLabel, platform, desktopVersion, expiresAt },
    });

    const verificationUrl = new URL("/desktop/connect", request.nextUrl.origin);
    verificationUrl.searchParams.set("challenge", challenge);
    verificationUrl.searchParams.set("intent", intent);
    return NextResponse.json({
      challenge,
      verificationUrl: verificationUrl.toString(),
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: 600,
    }, { status: 201 });
  } catch (error) {
    const correlationId = `desktop_pair_start_${crypto.randomUUID()}`;
    console.error(`[${correlationId}] Desktop pairing start failed`, error);
    return NextResponse.json(
      { error: "The pairing service is temporarily unavailable.", correlationId },
      { status: 503 },
    );
  }
}
