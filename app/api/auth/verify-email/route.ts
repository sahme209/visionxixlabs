import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashEmailVerificationToken } from "@/lib/auth/emailVerification";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length > 512) return new NextResponse("Invalid verification link.", { status: 400 });
  const now = new Date();
  const result = await prisma.emailVerificationToken.updateMany({
    where: { tokenHash: hashEmailVerificationToken(token), usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (result.count !== 1) return new NextResponse("This verification link is invalid, expired, or has already been used.", { status: 400 });
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashEmailVerificationToken(token) } });
  if (!record) return new NextResponse("Invalid verification link.", { status: 400 });
  await prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
  return NextResponse.redirect(new URL("/auth/signin?verified=1", request.url));
}
