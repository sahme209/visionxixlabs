/**
 * POST /api/workforce/spec_writer_engineer/run-domain — Phase 584.
 *
 * Operator-input form handler. Reads { title, problem, audience,
 * constraints } from the form, runs the Spec Writer Engineer, and
 * 303-redirects into the new spec's permalink so the operator sees
 * the freshly-written draft.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runSpecWriter, persistWrittenSpec, SPEC_WRITER_TARGET_KIND } from "@/lib/workforce/domains/specWriterEngineer";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const form = await req.formData();

  const title = typeof form.get("title") === "string" ? String(form.get("title")) : "";
  const problem = typeof form.get("problem") === "string" ? String(form.get("problem")) : "";
  const audience = typeof form.get("audience") === "string" ? String(form.get("audience")) : "";
  const constraints = typeof form.get("constraints") === "string" ? String(form.get("constraints")) : "";

  if (!title.trim() || !problem.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/spec_writer_engineer", req.url), 303);
  }

  const correlationId = `specwriter_${Date.now().toString(36)}` as CorrelationId;
  let spec;
  try {
    spec = await runSpecWriter(org, { title, problem, audience, constraints });
    await persistWrittenSpec(org, spec);
  } catch (err) {
    console.warn("[spec_writer/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted",
      outcome: "failure",
      entityRef: "engineer:spec_writer_engineer",
      correlationId,
      detail: { action: "engineer.spec_writer_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/spec_writer_engineer", req.url), 303);
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: spec.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:spec_writer_engineer",
    correlationId,
    detail: {
      action: "engineer.spec_writer_engineer.run_domain",
      slug: spec.slug,
      result: spec.outcome,
    },
  });

  // Land on the spec permalink (AGI memory entry route) so the
  // operator sees the draft immediately.
  if (spec.slug) {
    return NextResponse.redirect(
      new URL(`/dashboard/agi-memory/${encodeURIComponent(`${SPEC_WRITER_TARGET_KIND}:${spec.slug}`)}`, req.url),
      303,
    );
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/spec_writer_engineer", req.url), 303);
}
