/** POST /api/workforce/release_notes_engineer/run-domain — Phase 592. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runReleaseNotesEngineer, persistReleaseNotesDraft, RELEASE_NOTES_TARGET_KIND } from "@/lib/workforce/domains/releaseNotesEngineer";
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
  const title = s(f.get("title")); const commitLog = s(f.get("commitLog"));
  if (!title.trim() || !commitLog.trim()) {
    return NextResponse.redirect(new URL("/dashboard/workforce/release_notes_engineer/drafts", req.url), 303);
  }
  const correlationId = `release_notes_${Date.now().toString(36)}` as CorrelationId;
  let draft;
  try {
    draft = await runReleaseNotesEngineer(org, {
      title, commitLog,
      releaseTag: s(f.get("releaseTag")) || undefined,
      audience: s(f.get("audience")) || undefined,
    });
    await persistReleaseNotesDraft(org, draft);
  } catch (err) {
    console.warn("[release_notes/run-domain] hard failure:", err instanceof Error ? err.message : err);
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted", outcome: "failure",
      entityRef: "engineer:release_notes_engineer", correlationId,
      detail: { action: "engineer.release_notes_engineer.run_domain", error: err instanceof Error ? err.message : "unknown" },
    });
    return NextResponse.redirect(new URL("/dashboard/workforce/release_notes_engineer/drafts", req.url), 303);
  }
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: draft.outcome === "error" ? "failure" : "success",
    entityRef: "engineer:release_notes_engineer", correlationId,
    detail: { action: "engineer.release_notes_engineer.run_domain", slug: draft.slug, result: draft.outcome },
  });
  if (draft.slug) {
    return NextResponse.redirect(new URL(`/dashboard/agi-memory/${encodeURIComponent(`${RELEASE_NOTES_TARGET_KIND}:${draft.slug}`)}`, req.url), 303);
  }
  return NextResponse.redirect(new URL("/dashboard/workforce/release_notes_engineer/drafts", req.url), 303);
}
