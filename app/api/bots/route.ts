import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlanLimits } from "@/lib/planLimits";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    const limits = getPlanLimits(user?.plan ?? null);
    const bots = await prisma.bot.findMany({
      where: { userId: session.user.id },
      include: { sources: true },
    });
    const totalMessages = bots.reduce((s, b) => s + b.messageCount, 0);
    const totalPages = bots.reduce((s, b) => s + b.pageCount, 0);
    return NextResponse.json({
      bots,
      plan: user?.plan ?? "starter",
      usage: { messages: totalMessages, pages: totalPages, bots: bots.length },
      limits: { messages: limits.messages, pages: limits.pages, bots: limits.bots },
    });
  } catch (e) {
    console.error("[Bots API]", e);
    return NextResponse.json({ error: "Failed to load bots" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { name?: string };
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const name = (body.name || "My Chatbot").slice(0, 100);

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    const limits = getPlanLimits(user?.plan ?? null);
    const count = await prisma.bot.count({ where: { userId: session.user.id } });
    if (count >= limits.bots) {
      return NextResponse.json(
        { error: `Plan limit: max ${limits.bots} chatbot${limits.bots === 1 ? "" : "s"}. Upgrade your plan for more.` },
        { status: 403 }
      );
    }

    const bot = await prisma.bot.create({
      data: { name, userId: session.user.id },
      include: { sources: true },
    });
    return NextResponse.json({ bot });
  } catch (e) {
    console.error("[Bots API]", e);
    return NextResponse.json({ error: "Failed to create bot" }, { status: 500 });
  }
}
