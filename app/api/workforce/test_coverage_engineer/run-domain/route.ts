/** POST /api/workforce/test_coverage_engineer/run-domain — Phase 590. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runTestCoverageEngineer, persistTestProposal, TEST_COVERAGE_TARGET_KIND } from "@/lib/workforce/domains/testCoverageEngineer";
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
  const title = s(f.get("title")); const sourceCode = s(f.get("sourceCode"));
  if (!title.trim() || !sourceCode.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/test_coverage_engineer/proposals", req.url), 303);
  }
  const correlationId = `test_cov_${Date.now().toString(36)}` as CorrelationId;
  let proposal;
  try {
    proposal = await runTestCoverageEngineer(org, {
      title, sourceCode,
      language: s(f.get("language")) || undefined,
      framework: s(f.get("framework")) || undefined,
      focus: s(f.get("focus")) || undefined,
    });
    await persistTestProposal(org, proposal);
  } catch (err) {
    console.warn("[test_coverage/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:test_coverage_engineer", correlationId,
      detail: { action: "engineer.test_coverage_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/test_coverage_engineer/proposals", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: proposal.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:test_coverage_engineer", correlationId,
    detail: { action: "engineer.test_coverage_engineer.run_domain", slug: proposal.slug, result: proposal.outcome },
  });
  if (proposal.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${TEST_COVERAGE_TARGET_KIND}:${proposal.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/test_coverage_engineer/proposals", req.url), 303);
}
