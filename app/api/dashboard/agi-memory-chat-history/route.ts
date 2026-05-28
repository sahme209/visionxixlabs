/**
 * GET /api/dashboard/agi-memory-chat-history — Phase 529.
 * Query: ?scope=user|org&take=50
 *
 * Returns the operator's persisted chat-turn archive. scope=user
 * defaults to the current user's history; scope=org returns the
 * entire org's archive (cross-operator visibility).
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildChatHistoryResponse,
  type ChatTurnRepo,
} from "@/lib/releaseops/aiMemoryChatResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get("scope") ?? "user";
  const takeRaw = req.nextUrl.searchParams.get("take");
  const take = takeRaw ? Number.parseInt(takeRaw, 10) : undefined;

  const r = await buildChatHistoryResponse(
    prisma as unknown as ChatTurnRepo,
    {
      organizationId: ctx.organizationId,
      // scope=user → restrict to my turns (null when no auth user)
      // scope=org  → don't filter
      ...(scope === "user" ? { userId: ctx.userId ?? null } : {}),
      ...(typeof take === "number" && Number.isFinite(take) ? { take } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
