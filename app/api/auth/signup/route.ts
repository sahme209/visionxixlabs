import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { ensurePersonalWorkspaceMembership } from "@/lib/auth/ensurePersonalWorkspaceMembership";

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set. Add PostgreSQL connection string in Vercel Environment Variables." },
      { status: 503 }
    );
  }
  try {
    const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    if (!checkRateLimit(`desktop-signup:${sourceIp}`)) {
      return NextResponse.json({ error: "Too many account-creation attempts. Wait a minute and try again." }, { status: 429 });
    }

    const { email, password, name, desktopChallenge, acceptedTerms } = await req.json();
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (typeof desktopChallenge !== "string" || !desktopChallenge.trim()) {
      return NextResponse.json({ error: "Start account creation from the installed Axiom Agent application." }, { status: 400 });
    }
    if (acceptedTerms !== true) {
      return NextResponse.json({ error: "Accept the Terms and Privacy Policy to create an account." }, { status: 400 });
    }
    if (password.length < 12 || password.length > 128) {
      return NextResponse.json({ error: "Use a password between 12 and 128 characters." }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = typeof name === "string" ? name.trim() : "";
    if (normalizedEmail.length > 254 || normalizedName.length > 100) {
      return NextResponse.json({ error: "The email or name is too long." }, { status: 400 });
    }
    const pairing = await prisma.desktopPairingChallengeRecord.findUnique({ where: { id: desktopChallenge.trim() } });
    if (!pairing || pairing.status !== "pending" || pairing.consumedAt || pairing.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "This desktop sign-up request expired. Return to Axiom Agent and start again." }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "An account already exists for this email. Sign in instead." }, { status: 409 });
    }
    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: normalizedName || undefined,
      },
    });
    await ensurePersonalWorkspaceMembership({ userId: user.id, email: user.email });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (e) {
    const err = e as Error & { code?: string };
    console.error("[Signup]", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "An account already exists for this email. Sign in instead." }, { status: 409 });
    }
    if (err?.code === "P2021" || err?.message?.includes("does not exist")) {
      return NextResponse.json({ error: "Database tables missing. Run: DATABASE_URL=your_url npx prisma migrate deploy" }, { status: 503 });
    }
    if (err?.code === "P1001" || err?.code === "P1002" || err?.message?.includes("Can't reach") || err?.message?.includes("connection")) {
      return NextResponse.json({ error: "Database connection failed. Check DATABASE_URL in Vercel." }, { status: 503 });
    }
    return NextResponse.json({ error: "Sign up failed. Try again later." }, { status: 500 });
  }
}
