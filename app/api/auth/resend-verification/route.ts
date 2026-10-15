import { verificationDesktopCallback } from "@/lib/auth/verificationCallback";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { issueEmailVerificationToken, sendEmailVerification } from "@/lib/auth/emailVerification";

/**
 * Deliberately returns the same response for unknown, verified, OAuth-only,
 * and pending accounts, including user-specific delivery failures. This is
 * response-level neutrality, not a constant-time lookup guarantee. The existing
 * in-memory limiter keys delivery attempts by mailbox and source IP.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: unknown; callbackUrl?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const sourceIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  if (!email || email.length > 254 || !checkRateLimit(`email-verification:${sourceIp}:${email}`)) {
    return NextResponse.json({ ok: true });
  }
  if (!process.env.RESEND_API_KEY?.startsWith("re_")) return NextResponse.json({ ok: false, error: "verification_delivery_unavailable" }, { status: 503 });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || user.emailVerifiedAt) return NextResponse.json({ ok: true });
    const verification = issueEmailVerificationToken();
    await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: verification.tokenHash, expiresAt: verification.expiresAt } }),
    ]);
    const callback = verificationDesktopCallback(body?.callbackUrl);
    const delivered = await sendEmailVerification({ to: user.email, token: verification.token, ...(callback ? { callbackUrl: callback } : {}) });
    if (!delivered) console.error("[Email verification recovery] delivery_unavailable");
  } catch {
    // Do not log provider errors, tokens, mailbox or account details. Both a
    // delivery rejection and a transient account-store failure stay neutral.
    console.error("[Email verification recovery] request_unavailable");
  }
  return NextResponse.json({ ok: true });
}
