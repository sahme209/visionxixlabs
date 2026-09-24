/** POST /api/workforce/approver_engineer/run-domain — Phase 608. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runApproverEngineer,
  persistApprovalPacket,
  APPROVER_TARGET_KIND,
} from "@/lib/workforce/domains/approverEngineer";
import { dispatchApprovalActions } from "@/lib/workforce/domains/actionExecutor";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const title = s(f.get("title"));
  const proposalDescription = s(f.get("proposalDescription"));
  const riskContext = s(f.get("riskContext"));
  if (!title.trim() || !proposalDescription.trim() || !riskContext.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/approver_engineer/packets", req.url), 303);
  }
  const correlationId = `approver_${Date.now().toString(36)}` as CorrelationId;
  let packet;
  try {
    packet = await runApproverEngineer(org, {
      title,
      proposalDescription,
      riskContext,
      requestedAuthority: s(f.get("requestedAuthority")) || undefined,
      knownDependencies: s(f.get("knownDependencies")) || undefined,
    });
    await persistApprovalPacket(org, packet);
  } catch (err) {
    console.warn("[approver/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:approver_engineer", correlationId,
      detail: { action: "engineer.approver_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/approver_engineer/packets", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: packet.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:approver_engineer", correlationId,
    detail: {
      action: "engineer.approver_engineer.run_domain",
      slug: packet.slug,
      result: packet.outcome,
      decision: packet.recommendedDecision,
      authority: packet.decisionAuthority,
      impact: packet.impactRadius,
    },
  });

  // Phase 646: signed high-stakes packets fan out to configured
  // integrations (GitHub issue, Slack post). The gate inside
  // dispatchApprovalActions skips when stakes are low or the packet
  // wasn't signed. Each integration leg is best-effort; failures audit
  // but do not block the operator redirect.
  if (packet.outcome !== "error") {
    try {
      const dispatched = await dispatchApprovalActions(org, packet);
      for (const d of dispatched) {
        void auditRecord({
          organizationId: ids.organization(org),
          actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
          action: d.result.status === "executed"
            ? "engineer.action_executed"
            : d.result.status === "skipped"
              ? "engineer.action_attempted"
              : "engineer.action_execution_failed",
          outcome: d.result.status === "executed"
            ? "success"
            : d.result.status === "skipped"
              ? "success"
              : "failure",
          entityRef: `engineer:approver_engineer:dispatch:${d.kind}`,
          correlationId,
          detail: {
            action: "engineer.approver_engineer.dispatch",
            kind: d.kind,
            packetSlug: packet.slug,
            executionSlug: d.executionSlug,
            status: d.result.status,
            externalRef: d.result.externalRef,
            errorCode: d.result.errorCode,
          },
        });
      }
    } catch (err) {
      console.warn(
        "[approver/run-domain] dispatch failure:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (packet.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${APPROVER_TARGET_KIND}:${packet.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/approver_engineer/packets", req.url), 303);
}
