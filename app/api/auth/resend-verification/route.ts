import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { issueEmailVerificationToken, sendEmailVerification } from "@/lib/auth/emailVerification";

/**
 * Deliberately returns the same response for unknown, verified, OAuth-only,
 * and pending accounts so this public recovery endpoint cannot enumerate
 * users. The limiter bounds delivery attempts per mailbox and source IP.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const sourceIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  if (!email || email.length > 254 || !checkRateLimit(`email-verification:${sourceIp}:${email}`)) {
    return NextResponse.json({ ok: true });
  }
  if (!process.env.RESEND_API_KEY?.startsWith("re_")) return NextResponse.json({ ok: false, error: "verification_delivery_unavailable" }, { status: 503 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || user.emailVerifiedAt) return NextResponse.json({ ok: true });
  const verification = issueEmailVerificationToken();
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: verification.tokenHash, expiresAt: verification.expiresAt } }),
  ]);
  const delivered = await sendEmailVerification({ to: user.email, token: verification.token });
  return delivered
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: "verification_delivery_unavailable" }, { status: 503 });
}
