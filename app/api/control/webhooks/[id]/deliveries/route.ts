import { NextResponse } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
const LIMIT = 25;

/**
 * Recent delivery attempts for one webhook in the caller's workspace: event, attempt, status and the
 * receiver's HTTP status. Payloads, request headers and response bodies are never returned here.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.roles.length) return fail("workspace_membership_required", 403);
  const { id } = await params;
  if (!id || id.length > 64) return fail("webhook_not_found", 404);
  const organizationId = String(c.organizationId);
  try {
    const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!endpoint) return fail("webhook_not_found", 404);
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: id, organizationId },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, eventId: true, eventKind: true, attemptNumber: true, status: true, outcomeKind: true, httpStatus: true, attemptedAt: true, nextAttemptAt: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, data: { deliveries } }, { headers: noStore });
  } catch {
    return fail("deliveries_unavailable", 503);
  }
}
