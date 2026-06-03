/** POST /api/workforce/simulator_engineer/run-domain — Phase 605. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runSimulatorEngineer, persistSimulatorReport, SIMULATOR_TARGET_KIND } from "@/lib/workforce/domains/simulatorEngineer";
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
  const proposedAction = s(f.get("proposedAction"));
  const currentState = s(f.get("currentState"));
  if (!title.trim() || !proposedAction.trim() || !currentState.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/simulator_engineer/simulations", req.url), 303);
  }
  const correlationId = `simulator_${Date.now().toString(36)}` as CorrelationId;
  let report;
  try {
    report = await runSimulatorEngineer(org, {
      title,
      proposedAction,
      currentState,
      knownConstraints: s(f.get("knownConstraints")) || undefined,
      blastRadius: s(f.get("blastRadius")) || undefined,
    });
    await persistSimulatorReport(org, report);
  } catch (err) {
    console.warn("[simulator/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:simulator_engineer", correlationId,
      detail: { action: "engineer.simulator_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/simulator_engineer/simulations", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: report.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:simulator_engineer", correlationId,
    detail: { action: "engineer.simulator_engineer.run_domain", slug: report.slug, result: report.outcome, verdict: report.verdict },
  });
  if (report.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${SIMULATOR_TARGET_KIND}:${report.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/simulator_engineer/simulations", req.url), 303);
}
