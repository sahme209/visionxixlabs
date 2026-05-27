/**
 * GET /api/dashboard/webhook-delivery-list — Phase 497.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildWebhookDeliveryListResponse,
  type DeliveryListRepo,
} from "@/lib/releaseops/githubWebhookResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildWebhookDeliveryListResponse(
    prisma as unknown as DeliveryListRepo,
    ctx.organizationId,
  );
  return NextResponse.json(r.body, { status: r.status });
}
