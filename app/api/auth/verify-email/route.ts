import { verificationDesktopCallback } from "@/lib/auth/verificationCallback";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashEmailVerificationToken } from "@/lib/auth/emailVerification";

function invalidVerification(request: NextRequest, message: string) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", Vary: "Accept" };
  const acceptsHtml = request.headers.get("accept")?.split(",").some(
    (entry) => entry.split(";", 1)[0].trim() === "text/html",
  );
  if (!acceptsHtml) return new NextResponse(message, { status: 400, headers });

  const destination = new URL("/auth/signin?error=VerificationLinkInvalid", request.url);
  const callback = verificationDesktopCallback(request.nextUrl.searchParams.get("callbackUrl"));
  if (callback) destination.searchParams.set("callbackUrl", callback);
  return NextResponse.redirect(destination, { status: 303, headers });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length > 512) return invalidVerification(request, "Invalid verification link.");
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
    if (!verified) return invalidVerification(request, "This verification link is invalid, expired, or has already been used.");
    const destination = new URL("/auth/signin?verified=1", request.url);
    const callback = verificationDesktopCallback(request.nextUrl.searchParams.get("callbackUrl"));
    if (callback) destination.searchParams.set("callbackUrl", callback);
    return NextResponse.redirect(destination);
  } catch {
    // No token, email, account details, or database diagnostics in this response.
    return new NextResponse("Email verification is temporarily unavailable. Try this link again.", { status: 503 });
  }
}
