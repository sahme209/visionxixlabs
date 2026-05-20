/**
 * GET /api/compliance/evidence-packet
 *
 * Produces a deterministic, hash-stamped evidence packet of the tenant's
 * recent bus messages, proposals, and platform status — for SOC2-style
 * audits. Returns application/json suitable for direct download.
 *
 * Window: last `windowHours` (default 168 = 7 days, capped at 720 = 30
 * days). Read-only.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildEvidencePacket, type EvidenceInputBusMessage, type EvidenceInputProposal, type EvidenceInputStatusComponent } from "@/lib/compliance/evidencePacketBuilder";
import { buildPublicStatus } from "@/lib/status/publicStatusBuilder";
import { apiErr, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const HOURS_MIN = 1;
const HOURS_MAX = 720;

const STATUS_TO_PACKET: Record<string, EvidenceInputStatusComponent["state"]> = {
  operational: "ok",
  degraded: "degraded",
  down: "down",
  unknown: "unknown",
};

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    const raw = Number.parseInt(req.nextUrl.searchParams.get("windowHours") ?? "168", 10);
    const windowHours = Number.isFinite(raw) ? Math.max(HOURS_MIN, Math.min(raw, HOURS_MAX)) : 168;
    const now = new Date();
    const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const note = req.nextUrl.searchParams.get("note")?.slice(0, 500) ?? undefined;

    let busMessages: EvidenceInputBusMessage[] = [];
    try {
      const rows = await prisma.agentBusMessage.findMany({
        where: { organizationId: String(ctx.organizationId), createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: { id: true, sender: true, kind: true, summary: true, createdAt: true },
        take: 5000,
      });
      busMessages = rows.map((r) => ({
        id: r.id,
        sender: r.sender,
        kind: r.kind,
        summary: r.summary,
        publishedAt: r.createdAt.toISOString(),
      }));
    } catch {
      busMessages = [];
    }

    let proposals: EvidenceInputProposal[] = [];
    try {
      const rows = await prisma.methodProposal.findMany({
        where: { organizationId: String(ctx.organizationId), createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, authorAgent: true, target: true, status: true, label: true,
          decidedBy: true, decidedAt: true, decisionReason: true, createdAt: true,
        },
        take: 5000,
      });
      proposals = rows.map((r) => ({
        id: r.id,
        authorAgent: r.authorAgent,
        target: r.target,
        status: r.status,
        label: r.label,
        decidedBy: r.decidedBy ?? null,
        decidedAt: r.decidedAt?.toISOString() ?? null,
        decisionReason: r.decisionReason ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      proposals = [];
    }

    let statusComponents: EvidenceInputStatusComponent[] = [];
    try {
      const s = await buildPublicStatus();
      statusComponents = s.components.map((c) => ({
        name: c.id,
        state: STATUS_TO_PACKET[c.verdict] ?? "unknown",
      }));
    } catch {
      statusComponents = [];
    }

    const packet = buildEvidencePacket({
      organizationId: String(ctx.organizationId),
      generatedAt: now.toISOString(),
      windowStart: since.toISOString(),
      windowEnd: now.toISOString(),
      busMessages,
      proposals,
      statusComponents,
      note,
    });

    return new Response(JSON.stringify(packet, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="axiom-evidence-${ctx.organizationId}-${now.toISOString().slice(0, 10)}.json"`,
        "x-correlation-id": correlationId,
        "x-safety-contract": "audit_read_only",
      },
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
