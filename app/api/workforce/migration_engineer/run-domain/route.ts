/** POST /api/workforce/migration_engineer/run-domain — Phase 601. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runMigrationEngineer, persistMigrationRunbook, MIGRATION_TARGET_KIND } from "@/lib/workforce/domains/migrationEngineer";
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
  const fromState = s(f.get("fromState"));
  const toState = s(f.get("toState"));
  if (!title.trim() || !fromState.trim() || !toState.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/migration_engineer/runbooks", req.url), 303);
  }
  const correlationId = `migration_${Date.now().toString(36)}` as CorrelationId;
  let runbook;
  try {
    runbook = await runMigrationEngineer(org, {
      title,
      fromState,
      toState,
      constraints: s(f.get("constraints")) || undefined,
      rollbackBoundaries: s(f.get("rollbackBoundaries")) || undefined,
    });
    await persistMigrationRunbook(org, runbook);
  } catch (err) {
    console.warn("[migration/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:migration_engineer", correlationId,
      detail: { action: "engineer.migration_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/migration_engineer/runbooks", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: runbook.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:migration_engineer", correlationId,
    detail: { action: "engineer.migration_engineer.run_domain", slug: runbook.slug, result: runbook.outcome },
  });
  if (runbook.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${MIGRATION_TARGET_KIND}:${runbook.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/migration_engineer/runbooks", req.url), 303);
}
