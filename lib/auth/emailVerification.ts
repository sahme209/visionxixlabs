import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { verificationDesktopCallback } from "./verificationCallback";

const TTL_MS = 24 * 60 * 60 * 1000;

export function issueEmailVerificationToken(now = new Date()): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashEmailVerificationToken(token), expiresAt: new Date(now.getTime() + TTL_MS) };
}

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function emailVerificationUrl(token: string, callbackUrl?: string | null): string {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://visionxixlabs.com").replace(/\/$/, "");
  const url = new URL(`${baseUrl}/api/auth/verify-email`);
  url.searchParams.set("token", token);
  const callback = verificationDesktopCallback(callbackUrl);
  if (callback) url.searchParams.set("callbackUrl", callback);
  return url.toString();
}

/** Returns false rather than claiming delivery when outbound mail is absent. */
export async function sendEmailVerification(input: { to: string; token: string; callbackUrl?: string | null }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key?.startsWith("re_")) return false;
  const url = emailVerificationUrl(input.token, input.callbackUrl);
  const result = await new Resend(key).emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Axiom <onboarding@resend.dev>",
    to: input.to,
    subject: "Verify your Axiom Agent email address",
    html: `<p>Verify your email address to finish setting up Axiom Agent.</p><p><a href="${url}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
  });
  return !result.error;
}
