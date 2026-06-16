/**
 * POST /api/agents/inbound — Phase 642 · on-prem agent scan ingress.
 *
 * Authenticated via X-Agent-Token header. Token is HMAC-signed and
 * carries (organizationId, connectorSlug). Body is a JSON payload
 * conforming to InboundScanPayload.
 *
 * No NextAuth session required — agents are unattended workloads
 * inside the customer's network.
 *
 * Rate limited indirectly via items-per-batch cap (500) and via the
 * existing Vercel-level invocation budget. A future Phase 645 wires
 * per-token sliding-window rate limits.
 *
 * Returns:
 *   200 → { ok: true, slug, itemsPersisted }
 *   401 → { error: <reason> } for token failures
 *   400 → { error: <reason> } for payload failures
 *   500 → { error: "persist_failed" } for DB issues
 */

import { NextResponse } from "next/server";
import { validateAgentToken } from "@/lib/workforce/domains/agentTokens";
import {
  acceptInboundScanPayload,
  type InboundScanPayload,
} from "@/lib/workforce/domains/agentInbound";
import { prisma } from "@/lib/db";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const token = req.headers.get("x-agent-token") ?? "";
  const correlationId = `agent_inbound_${Date.now().toString(36)}` as CorrelationId;

  const v = validateAgentToken(token);
  if (!v.ok || !v.payload) {
    return NextResponse.json(
      { error: `token_${v.error ?? "invalid"}` },
      { status: 401 },
    );
  }

  // Confirm the connector still exists in this workspace. If the
  // operator deleted the connector after minting the token, the
  // token must stop working immediately.
  const connectorExists = await prisma.aiRationaleEnrichment.findUnique({
    where: {
      organizationId_targetKind_targetId: {
        organizationId: v.payload.organizationId,
        targetKind: "workforce_onprem_connector",
        targetId: v.payload.connectorSlug,
      },
    },
    select: { id: true },
  }).catch(() => null);

  if (!connectorExists) {
    void auditRecord({
      organizationId: ids.organization(v.payload.organizationId),
      action: "connector.validate.failure",
      outcome: "blocked",
      entityRef: `on-prem-connector:${v.payload.connectorSlug}`,
      correlationId,
      detail: { action: "agent_inbound_rejected", reason: "connector_removed", token_label: v.payload.agentLabel },
    });
    return NextResponse.json({ error: "connector_no_longer_exists" }, { status: 401 });
  }

  let body: InboundScanPayload;
  try {
    body = await req.json() as InboundScanPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await acceptInboundScanPayload(
    v.payload.organizationId,
    v.payload.connectorSlug,
    body,
  );

  void auditRecord({
    organizationId: ids.organization(v.payload.organizationId),
    action: result.ok ? "scan.success" : "scan.failure",
    outcome: result.ok ? "success" : "failure",
    entityRef: `on-prem-connector:${v.payload.connectorSlug}`,
    correlationId,
    detail: {
      action: "agent_inbound",
      scanType: body?.scanType,
      itemsPersisted: result.itemsPersisted,
      error: result.error,
      agentLabel: v.payload.agentLabel,
    },
  });

  if (!result.ok) {
    const status = result.error === "persist_failed" ? 500 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, slug: result.slug, itemsPersisted: result.itemsPersisted });
}
