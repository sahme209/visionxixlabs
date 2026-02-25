import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set. Add PostgreSQL connection string in Vercel Environment Variables." },
      { status: 503 }
    );
  }
  try {
    const { email, password, name } = await req.json();
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }
    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        name: (name || "").trim() || undefined,
      },
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (e) {
    const err = e as Error & { code?: string };
    console.error("[Signup]", err);
    if (err?.code === "P2021" || err?.message?.includes("does not exist")) {
      return NextResponse.json({ error: "Database tables missing. Run: DATABASE_URL=your_url npx prisma migrate deploy" }, { status: 503 });
    }
    if (err?.code === "P1001" || err?.code === "P1002" || err?.message?.includes("Can't reach") || err?.message?.includes("connection")) {
      return NextResponse.json({ error: "Database connection failed. Check DATABASE_URL in Vercel." }, { status: 503 });
    }
    return NextResponse.json({ error: "Sign up failed. Try again later." }, { status: 500 });
  }
}
