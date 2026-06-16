/** POST /api/agents/mint-token — Phase 642. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { createAgentToken } from "@/lib/workforce/domains/agentTokens";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const connectorSlug = s(f.get("connectorSlug")).trim();
  const agentLabel = s(f.get("agentLabel")).trim();
  const correlationId = `agent_token_mint_${Date.now().toString(36)}` as CorrelationId;

  if (!connectorSlug || !agentLabel) {
    return NextResponse.redirect(
      new URL(`/dashboard/workforce/on-prem-connectors/${encodeURIComponent(connectorSlug)}?error=missing_fields`, req.url),
      303,
    );
  }

  // Permission + ownership check: the connector must exist in this
  // workspace before we mint a token bound to it.
  const exists = await prisma.aiRationaleEnrichment.findUnique({
    where: {
      organizationId_targetKind_targetId: {
        organizationId: org,
        targetKind: "workforce_onprem_connector",
        targetId: connectorSlug,
      },
    },
    select: { id: true },
  }).catch(() => null);

  if (!exists) {
    return NextResponse.redirect(
      new URL(`/dashboard/workforce/on-prem-connectors?error=connector_not_found`, req.url),
      303,
    );
  }

  let token: string;
  try {
    token = createAgentToken(org, connectorSlug, agentLabel);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg === "agent_token_secret_missing_or_too_short") {
      return NextResponse.redirect(
        new URL(`/dashboard/workforce/on-prem-connectors/${encodeURIComponent(connectorSlug)}?error=secret_misconfigured`, req.url),
        303,
      );
    }
    throw err;
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "connector.connect",
    outcome: "success",
    entityRef: `on-prem-connector:${connectorSlug}`,
    correlationId,
    detail: { action: "agent_token_minted", agentLabel, connectorSlug },
  });

  return NextResponse.redirect(
    new URL(
      `/dashboard/workforce/on-prem-connectors/${encodeURIComponent(connectorSlug)}?token=${encodeURIComponent(token)}`,
      req.url,
    ),
    303,
  );
}
