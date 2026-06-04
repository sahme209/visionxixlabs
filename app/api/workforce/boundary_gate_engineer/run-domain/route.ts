/** POST /api/workforce/boundary_gate_engineer/run-domain — Phase 609. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  runBoundaryGateEngineer,
  persistBoundaryClassification,
  BOUNDARY_GATE_TARGET_KIND,
} from "@/lib/workforce/domains/boundaryGateEngineer";
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
  const actionDescription = s(f.get("actionDescription"));
  if (!title.trim() || !actionDescription.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/boundary_gate_engineer/classifications", req.url), 303);
  }
  const correlationId = `boundary_${Date.now().toString(36)}` as CorrelationId;
  let classification;
  try {
    classification = await runBoundaryGateEngineer(org, {
      title,
      actionDescription,
      systemTopology: s(f.get("systemTopology")) || undefined,
      existingContainment: s(f.get("existingContainment")) || undefined,
    });
    await persistBoundaryClassification(org, classification);
  } catch (err) {
    console.warn("[boundary_gate/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:boundary_gate_engineer", correlationId,
      detail: { action: "engineer.boundary_gate_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/boundary_gate_engineer/classifications", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: classification.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:boundary_gate_engineer", correlationId,
    detail: {
      action: "engineer.boundary_gate_engineer.run_domain",
      slug: classification.slug,
      result: classification.outcome,
      tier: classification.tier,
    },
  });
  if (classification.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${BOUNDARY_GATE_TARGET_KIND}:${classification.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/boundary_gate_engineer/classifications", req.url), 303);
}
