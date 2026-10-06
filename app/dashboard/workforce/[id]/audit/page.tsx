/**
 * /dashboard/workforce/[id]/audit — per-engineer audit timeline.
 *
 * Reads SecureAuditRecord for the workspace, filtered by the engineer's
 * declared audit topics. Engineers whose topics don't match any closed-
 * union AuditAction members see an honest empty state explaining why
 * — no fabricated rows to make the page look populated.
 *
 * 200 most-recent rows, ordered desc by occurredAt. Same row shape as
 * /dashboard/audit so operators learn one rendering pattern.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";

type Outcome = "success" | "failure" | "blocked";
type ActorKind = "user" | "agent" | "system";

const OUTCOME_TONE: Record<Outcome, string> = {
  success: "text-emerald-300",
  failure: "text-rose-300",
  blocked: "text-zinc-300",
};

const ACTOR_TONE: Record<ActorKind, string> = {
  user:   "text-zinc-200",
  agent:  "text-zinc-400",
  system: "text-zinc-500",
};

function timeAgo(iso: Date): string {
  const ms = Date.now() - iso.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default async function EngineerAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === id);
  if (!engineer || engineer.productLayer !== "client") notFound();

  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect(`/auth/signin?callbackUrl=/dashboard/workforce/${id}/audit`);
  }

  const topics = [...engineer.auditTopics];
  let records: Array<{
    id: string;
    action: string;
    outcome: string;
    actorKind: string;
    actorUserId: string | null;
    entityRef: string | null;
    correlationId: string;
    occurredAt: Date;
  }> = [];
  let migrationPending = false;
  if (topics.length > 0) {
    try {
      records = await prisma.secureAuditRecord.findMany({
        where: {
          organizationId: String(ctx.organizationId),
          action: { in: topics },
        },
        orderBy: { occurredAt: "desc" },
        take: 200,
        select: {
          id: true,
          action: true,
          outcome: true,
          actorKind: true,
          actorUserId: true,
          entityRef: true,
          correlationId: true,
          occurredAt: true,
        },
      }) as typeof records;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
        migrationPending = true;
      } else {
        throw err;
      }
    }
  }

  // AGI rationale relevant to this engineer's domain. Same mapping
  // the detail page uses (Phase 550) so the two surfaces agree.
  function agiKindsForDepartment(d: string): string[] {
    if (d === "safety" || d === "planning" || d === "reasoning") return ["council"];
    if (d === "incident_response" || d === "security" || d === "devops" || d === "finops" || d === "observability") return ["triage", "remediation"];
    return ["council", "triage", "remediation"];
  }
  const agiKinds = agiKindsForDepartment(engineer.department);
  const [deptAgiEntries, ownAgiEntries] = await Promise.all([
    prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId: String(ctx.organizationId),
        targetKind: { in: agiKinds },
      },
      orderBy: { generatedAt: "desc" },
      take: 10,
      select: {
        targetKind: true,
        targetId: true,
        narrative: true,
        outcome: true,
        generatedAt: true,
      },
    }).catch(() => [] as Array<{
      targetKind: string;
      targetId: string;
      narrative: string;
      outcome: string;
      generatedAt: Date;
    }>),
    // The engineer's own AGI memory: its specialty rationale + every
    // Q&A row keyed to this engineer. Interleaved chronologically
    // with the dept-mapped feed below.
    prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId: String(ctx.organizationId),
        OR: [
          { targetKind: "engineer_specialty", targetId: engineer.id },
          { targetKind: "engineer_qa", targetId: { startsWith: `${engineer.id}:` } },
        ],
      },
      orderBy: { generatedAt: "desc" },
      take: 10,
      select: {
        targetKind: true,
        targetId: true,
        narrative: true,
        outcome: true,
        generatedAt: true,
      },
    }).catch(() => [] as Array<{
      targetKind: string;
      targetId: string;
      narrative: string;
      outcome: string;
      generatedAt: Date;
    }>),
  ]);
  // Merge and re-sort so the operator sees one chronological stream
  // across both kinds of AGI activity.
  const agiEntries = [...deptAgiEntries, ...ownAgiEntries]
    .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
    .slice(0, 15);

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <Link href={`/dashboard/workforce/${id}`} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        {engineer.displayName}
      </Link>

      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">audit · {engineer.id}</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3">
          What this engineer has done.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Every workspace audit event tagged with one of this engineer&apos;s
          declared topics. {topics.length === 0
            ? "This engineer hasn't declared any audit topics yet, so there's nothing to scope to."
            : <>Topics: <span className="font-mono text-zinc-300">{topics.join(", ")}</span></>}
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-white/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            SecureAuditRecord table not migrated. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      {/* AGI rationale stream — sits above the audit event list so
          operators see what the AGI was reasoning about while events
          were emitting. Hidden when empty so the page stays tight. */}
      {agiEntries.length > 0 && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-violet-300">AGI rationale stream · {agiKinds.join(" + ")} + own specialty + Q&amp;A</p>
            <Link href="/dashboard/agi-memory" className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors">
              memory feed →
            </Link>
          </div>
          <ul className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] divide-y divide-white/[0.04] overflow-hidden">
            {agiEntries.map((e) => (
              <li key={`${e.targetKind}:${e.targetId}`}>
                <Link
                  href={`/dashboard/agi-memory/${encodeURIComponent(`${e.targetKind}:${e.targetId}`)}`}
                  className="block px-5 py-3 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span className="text-violet-300">{e.targetKind}</span>
                      <span className="text-zinc-500">·</span>
                      <span className={
                        e.outcome === "ai_generated" ? "text-emerald-300" :
                        e.outcome === "fallback_rules" ? "text-zinc-300" :
                        "text-rose-300"
                      }>{e.outcome.replace(/_/g, " ")}</span>
                    </div>
                    <span className="text-zinc-500">{e.generatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                  </div>
                  <p className="text-[12px] text-zinc-200 leading-relaxed line-clamp-2">{e.narrative}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!migrationPending && records.length === 0 && topics.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-white mb-1">No matching audit events yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto">
            Nothing in this workspace has emitted a <span className="font-mono">{topics[0]}</span> event yet.
            Once {engineer.displayName} exercises a gated tool, rows will land here.
          </p>
        </div>
      )}

      {records.length > 0 && (
        <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
          {records.map((r) => {
            const outcome = r.outcome as Outcome;
            const actor = r.actorKind as ActorKind;
            return (
              <li key={r.id} className="px-6 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                      <span className={OUTCOME_TONE[outcome] ?? "text-zinc-400"}>{r.outcome}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-300">{r.action}</span>
                      <span className="text-zinc-500">·</span>
                      <span className={ACTOR_TONE[actor] ?? "text-zinc-500"}>
                        {r.actorKind}{r.actorUserId ? ` · ${r.actorUserId.slice(0, 8)}` : ""}
                      </span>
                    </div>
                    {r.entityRef && (
                      <p className="text-[12px] font-mono text-zinc-400 truncate">{r.entityRef}</p>
                    )}
                    <p className="text-[10px] font-mono text-zinc-600 mt-1 truncate">
                      correlation · {r.correlationId}
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-600 shrink-0 text-right">
                    {timeAgo(r.occurredAt)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
