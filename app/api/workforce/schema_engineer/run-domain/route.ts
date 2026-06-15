/** POST /api/workforce/schema_engineer/run-domain — Phase 597. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runSchemaEngineer, persistSchemaProposal, SCHEMA_TARGET_KIND } from "@/lib/workforce/domains/schemaEngineer";
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
  const schemaFragment = s(f.get("schemaFragment"));
  const slowQueryLog = s(f.get("slowQueryLog"));
  if (!title.trim() || !schemaFragment.trim() || !slowQueryLog.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/schema_engineer/proposals", req.url), 303);
  }
  const correlationId = `schema_${Date.now().toString(36)}` as CorrelationId;
  let proposal;
  try {
    proposal = await runSchemaEngineer(org, {
      title,
      schemaFragment,
      slowQueryLog,
      databaseEngine: s(f.get("databaseEngine")) || undefined,
      knownConstraints: s(f.get("knownConstraints")) || undefined,
    });
    await persistSchemaProposal(org, proposal);
  } catch (err) {
    console.warn("[schema/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:schema_engineer", correlationId,
      detail: { action: "engineer.schema_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/schema_engineer/proposals", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: proposal.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:schema_engineer", correlationId,
    detail: { action: "engineer.schema_engineer.run_domain", slug: proposal.slug, result: proposal.outcome },
  });
  if (proposal.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${SCHEMA_TARGET_KIND}:${proposal.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/schema_engineer/proposals", req.url), 303);
}
