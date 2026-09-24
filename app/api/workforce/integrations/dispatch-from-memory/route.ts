/** POST /api/workforce/integrations/dispatch-from-memory — Phase 649.
 *
 * Manual dispatch: operator selects an AGI memory entry + which
 * integrations to fire, and the platform opens a GitHub issue / posts
 * to Slack / files a Linear ticket carrying the rationale row.
 *
 * Unlike Phase 646's approver auto-dispatch (which fires
 * automatically on signed high-stakes packets), this is a deliberate
 * operator click — no gating rules. The audit trail records exactly
 * which kinds the operator chose and why each leg succeeded or failed.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { dispatchAction, type ActionKind } from "@/lib/workforce/domains/actionExecutor";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 45;

const ALLOWED_KINDS: ReadonlyArray<ActionKind> = ["github_issue", "slack_action_post", "linear_ticket"];

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

function parseKinds(raw: FormDataEntryValue[]): ActionKind[] {
  const out: ActionKind[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const candidate = v as ActionKind;
    if (ALLOWED_KINDS.includes(candidate) && !out.includes(candidate)) {
      out.push(candidate);
    }
  }
  return out;
}

function buildPayloadBody(narrative: string, risks: ReadonlyArray<string>, actions: ReadonlyArray<string>): string {
  const lines: string[] = [];
  lines.push(narrative);
  if (risks.length > 0) {
    lines.push("");
    lines.push("**Risk factors:**");
    for (const r of risks) lines.push(`- ${r}`);
  }
  if (actions.length > 0) {
    lines.push("");
    lines.push("**Next actions:**");
    for (const a of actions) lines.push(`- ${a}`);
  }
  return lines.join("\n");
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const targetKind = s(f.get("targetKind")).trim();
  const targetId = s(f.get("targetId")).trim();
  const kinds = parseKinds(f.getAll("kind"));
  const correlationId = `dispatch_memory_${Date.now().toString(36)}` as CorrelationId;

  if (!targetKind || !targetId || kinds.length === 0) {
    return NextResponse.redirect(
      new URL(`/dashboard/agi-memory/${encodeURIComponent(`${targetKind}:${targetId}`)}?error=missing_dispatch_args`, req.url),
      303,
    );
  }

  const row = await prisma.aiRationaleEnrichment.findUnique({
    where: {
      organizationId_targetKind_targetId: {
        organizationId: org,
        targetKind,
        targetId,
      },
    },
    select: { narrative: true, riskFactorsJson: true, nextActionsJson: true },
  }).catch(() => null);

  if (!row) {
    return NextResponse.redirect(
      new URL(`/dashboard/agi-memory/${encodeURIComponent(`${targetKind}:${targetId}`)}?error=row_not_found`, req.url),
      303,
    );
  }

  const risks = Array.isArray(row.riskFactorsJson)
    ? (row.riskFactorsJson as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const actions = Array.isArray(row.nextActionsJson)
    ? (row.nextActionsJson as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  // Use the first 120 chars of narrative as a title; the rest goes
  // into the body. Operators viewing the memory page already see the
  // full narrative — the title needs to be scannable in the issue
  // tracker, not perfectly faithful.
  const firstLine = row.narrative.split(/\r?\n/)[0]?.trim() ?? "";
  const title = (firstLine.length > 0 ? firstLine : row.narrative.trim()).slice(0, 120);
  const body = buildPayloadBody(row.narrative, risks, actions);
  const upstreamRef = `${targetKind}:${targetId}`;

  const results = await Promise.all(
    kinds.map(async (kind) => {
      const dispatch = await dispatchAction(org, kind, { title, body, upstreamRef });
      return { kind, ...dispatch };
    }),
  );

  for (const r of results) {
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: r.result.status === "executed"
        ? "engineer.action_executed"
        : r.result.status === "skipped"
          ? "engineer.action_attempted"
          : "engineer.action_execution_failed",
      outcome: r.result.status === "executed"
        ? "success"
        : r.result.status === "skipped"
          ? "success"
          : "failure",
      entityRef: `dispatch:memory:${r.kind}:${r.executionSlug}`,
      correlationId,
      detail: {
        action: "dispatch_from_memory",
        kind: r.kind,
        targetKind,
        targetId,
        status: r.result.status,
        externalRef: r.result.externalRef,
        errorCode: r.result.errorCode,
      },
    });
  }

  const allExecuted = results.every((r) => r.result.status === "executed");
  const anyFailed = results.some((r) => r.result.status === "failed");
  const notice = allExecuted ? "dispatched" : anyFailed ? "dispatched_with_errors" : "dispatched_partial";

  return NextResponse.redirect(
    new URL(`/dashboard/agi-memory/${encodeURIComponent(`${targetKind}:${targetId}`)}?notice=${notice}`, req.url),
    303,
  );
}
