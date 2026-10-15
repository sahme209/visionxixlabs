import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashEmailVerificationToken } from "@/lib/auth/emailVerification";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length > 512) return new NextResponse("Invalid verification link.", { status: 400 });
  const now = new Date();
  const tokenHash = hashEmailVerificationToken(token);
  try {
    const verified = await prisma.$transaction(async (tx) => {
      // The conditional claim serializes competing uses of this one proof.
      // Keep it in the same commit as the identity update: a transient failure
      // must not consume the link without verifying its owner.
      const result = await tx.emailVerificationToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (result.count !== 1) return false;
      const record = await tx.emailVerificationToken.findUnique({ where: { tokenHash } });
      if (!record) throw new Error("Claimed email proof unavailable");
      await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
      return true;
    });
    if (!verified) return new NextResponse("This verification link is invalid, expired, or has already been used.", { status: 400 });
    return NextResponse.redirect(new URL("/auth/signin?verified=1", request.url));
  } catch {
    // No token, email, account details, or database diagnostics in this response.
    return new NextResponse("Email verification is temporarily unavailable. Try this link again.", { status: 503 });
  }
}
