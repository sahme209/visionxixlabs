/**
 * POST /api/dashboard/connector-setup-event — Phase 424.
 *
 * The dashboard CTAs (Connect / Re-validate / Disconnect / Reconnect /
 * Open provider console / Return from provider) post here. The route
 * validates input, resolves the org via NextAuth, and hands off to the
 * Phase 424 best-effort recorder. The recorder enforces the closed
 * union of operator-allowed event kinds — server-side kinds (e.g.
 * validation_succeeded) cannot be forged from a UI click.
 *
 * Body:  { provider: "aws" | "azure" | "gcp", eventKind: OperatorAllowedEventKind }
 * Reply: { ok: true, status, transitionId } on legal apply
 *      | { ok: true, status, illegal: true } on kernel-rejected event (audit row still written)
 *      | { ok: false, error: "auth_required" | "invalid_payload" | "validation_failed", ... }
 *      | { ok: false, error: "migration_pending" } when schema hasn't been applied
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { recordConnectorSetupEvent } from "@/lib/connectors/connectorSetupEventEmit";
import type { ConnectorSetupRepo } from "@/lib/connectors/connectorSetupRepo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { provider?: unknown; eventKind?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const provider = typeof body.provider === "string" ? body.provider : "";
  const eventKind = typeof body.eventKind === "string" ? body.eventKind : "";
  if (!provider || !eventKind) {
    return NextResponse.json({ ok: false, error: "invalid_payload", hint: "provider and eventKind are required strings." }, { status: 400 });
  }

  const outcome = await recordConnectorSetupEvent(
    prisma as unknown as ConnectorSetupRepo,
    {
      organizationId: ctx.organizationId,
      provider,
      eventKind,
      actorUserId: ctx.userId,
    },
  );

  switch (outcome.kind) {
    case "applied": {
      if (outcome.result.ok) {
        return NextResponse.json({
          ok: true,
          status: outcome.result.nextStatus,
          previousStatus: outcome.result.previousStatus,
          transitionId: outcome.result.transition.id,
        });
      }
      // Kernel rejected the transition (e.g. operator_disconnected from
      // not_connected). Audit row was still written; surface as 409.
      return NextResponse.json({
        ok: true,
        illegal: true,
        status: outcome.result.from,
        transitionId: outcome.result.transition.id,
        hint: `Cannot ${outcome.result.eventKind} from ${outcome.result.from}.`,
      }, { status: 409 });
    }
    case "migration_pending":
      return NextResponse.json({
        ok: false,
        error: "migration_pending",
        hint: "ConnectorSetupSession + Transition tables aren't migrated. Run prisma migrate.",
      }, { status: 503 });
    case "validation_failed":
      return NextResponse.json({
        ok: false,
        error: "validation_failed",
        reason: outcome.reason,
      }, { status: 400 });
  }
}
