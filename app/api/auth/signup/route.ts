import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
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
    console.error("[Signup]", e);
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}
