/**
 * Non-destructive pause/resume for a Slack/Teams TenantIntegrationConnection.
 *
 * Unlike ../disconnect (which erases the encrypted credential), this only
 * flips `status` between "active"/"needs_attention" and "suspended" — the
 * credential and scopes are kept so resuming does not require the admin to
 * re-consent through the provider's OAuth flow. A resumed connection goes
 * back through "needs_attention" (lastValidatedAt cleared) rather than
 * straight to "active", since a paused connection's last server-side
 * validation is stale by definition.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROVIDERS = new Set(["slack", "teams"]);
type PauseAction = "suspend" | "resume";

interface ConnectionRepo {
  tenantIntegrationConnection: {
    updateMany(args: {
      where: { organizationId: string; provider: string; status: { in: string[] } };
      data: { status: string; lastValidatedAt: null };
    }): Promise<{ count: number }>;
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  }
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }
  const { provider } = await params;
  if (!PROVIDERS.has(provider)) return NextResponse.json({ ok: false, error: "unsupported_provider" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== "suspend" && action !== "resume") {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const typedAction = action as PauseAction;
  const fromStatuses = typedAction === "suspend" ? ["active", "needs_attention"] : ["suspended"];
  const nextStatus = typedAction === "suspend" ? "suspended" : "needs_attention";

  try {
    const result = await (prisma as unknown as ConnectionRepo).tenantIntegrationConnection.updateMany({
      where: { organizationId: context.organizationId, provider, status: { in: fromStatuses } },
      data: { status: nextStatus, lastValidatedAt: null },
    });
    if (result.count === 0) return NextResponse.json({ ok: false, error: "connection_not_eligible" }, { status: 409 });

    try {
      await recordAudit({
        organizationId: idFactory.organization(context.organizationId),
        actorUserId: idFactory.user(context.userId),
        actorKind: "user",
        action: typedAction === "suspend" ? "connector.pause" : "connector.resume",
        outcome: "success",
        entityRef: `connector:${provider}`,
        correlationId: idFactory.correlation(`connector_${typedAction}_${Date.now().toString(36)}`),
        source: "live",
        detail: { provider },
      });
    } catch {
      // best-effort
    }

    return NextResponse.json({ ok: true, data: { provider, status: nextStatus } });
  } catch {
    return NextResponse.json({ ok: false, error: "pause_unavailable" }, { status: 503 });
  }
}
