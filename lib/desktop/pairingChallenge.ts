import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 10 * 60 * 1000;

export interface PairingChallenge {
  pairingId: string;
  deviceFingerprint: string;
  deviceLabel: string;
  platform: "macos-arm" | "macos-intel" | "windows" | "linux" | "unknown";
  desktopVersion?: string;
  expiresAt: string;
}

function signingKey(): Buffer {
  const value = process.env.DESKTOP_SESSION_SIGNING_KEY?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("Desktop pairing signing key is not configured.");
  return Buffer.from(value, "utf8");
}

function signature(payload: string): Buffer {
  return createHmac("sha256", signingKey()).update(payload).digest();
}

export function createPairingChallenge(input: Omit<PairingChallenge, "pairingId" | "expiresAt">): string {
  const value: PairingChallenge = {
    ...input,
    pairingId: `dsk_${randomBytes(16).toString("hex")}`,
    expiresAt: new Date(Date.now() + MAX_AGE_MS).toISOString(),
  };
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function verifyPairingChallenge(token: string): PairingChallenge {
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) throw new Error("Pairing request is malformed.");
  const expected = signature(payload);
  const actual = Buffer.from(supplied, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Pairing request signature is invalid.");
  }
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PairingChallenge;
  if (!parsed.pairingId || !parsed.deviceFingerprint || !parsed.deviceLabel || Date.parse(parsed.expiresAt) <= Date.now()) {
    throw new Error("Pairing request has expired or is invalid.");
  }
  return parsed;
}
