import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const bots = await prisma.bot.findMany({
      where: { userId: session.user.id },
      include: { sources: true },
    });
    return NextResponse.json({ bots });
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

    const count = await prisma.bot.count({ where: { userId: session.user.id } });
    if (count >= 3) {
      return NextResponse.json({ error: "Plan limit: max 3 chatbots. Upgrade for more." }, { status: 403 });
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
