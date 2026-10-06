/**
 * /dashboard/audit — the live audit trail.
 *
 * Reads SecureAuditRecord directly, scoped by org. Every meaningful
 * platform event (scan.start, scan.success, approval.approve,
 * connector_linked, etc.) lands here. Operators reviewing what
 * happened see the chain, not a curated demo.
 *
 * 200 most-recent rows, ordered desc by occurredAt. Each row shows
 * the action, outcome tone, time, entity, correlation id, and the
 * actor — system vs user.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";

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

export default async function AuditPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/audit");
  }

  let records: Array<{
    id: string;
    action: string;
    outcome: string;
    actorKind: string;
    actorUserId: string | null;
    entityRef: string | null;
    correlationId: string;
    occurredAt: Date;
    detail: unknown;
    errorCode: string | null;
  }> = [];
  let migrationPending = false;
  try {
    records = await (prisma as unknown as {
      secureAuditRecord: {
        findMany: (args: unknown) => Promise<typeof records>;
      };
    }).secureAuditRecord.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  const counts = records.reduce<Record<Outcome, number>>(
    (acc, r) => {
      const o = r.outcome as Outcome;
      if (o === "success" || o === "failure" || o === "blocked") {
        acc[o] = (acc[o] ?? 0) + 1;
      }
      return acc;
    },
    { success: 0, failure: 0, blocked: 0 },
  );

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">audit</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Every meaningful event.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Each row is a real platform event — scans, approvals, connector links,
          failures. Read top-down for the most recent.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-white/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            The audit table hasn&apos;t been migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code> to populate the trail.
          </p>
        </div>
      )}

      {!migrationPending && records.length === 0 && (
        <div className="surface-glass rounded-2xl px-7 py-12 text-center">
          <p className="text-[15px] font-semibold text-white mb-1">No events yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto">
            Connect a cloud, run a scan, or approve a recommendation — every
            action you take here lands in this trail.
          </p>
        </div>
      )}

      {records.length > 0 && (
        <>
          <section className="surface-glass mb-10 rounded-2xl divide-x divide-white/[0.04] grid grid-cols-3 overflow-hidden">
            <CountTile label="success"  count={counts.success}  tone={counts.success > 0 ? "text-emerald-300" : "text-zinc-600"} />
            <CountTile label="failure"  count={counts.failure}  tone={counts.failure > 0 ? "text-rose-300" : "text-zinc-600"} />
            <CountTile label="blocked"  count={counts.blocked}  tone={counts.blocked > 0 ? "text-zinc-300" : "text-zinc-600"} />
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">timeline · latest 200</p>
            <ul className="surface-glass rounded-2xl divide-y divide-white/[0.04] overflow-hidden">
              {records.map((r) => {
                const outcome = r.outcome as Outcome;
                const actor = r.actorKind as ActorKind;
                const tone = OUTCOME_TONE[outcome] ?? "text-zinc-400";
                const actorTone = ACTOR_TONE[actor] ?? "text-zinc-500";
                return (
                  <li key={r.id} className="px-6 py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                          <span className={tone}>{r.outcome}</span>
                          <span className="text-zinc-500">·</span>
                          <span className="text-zinc-300">{r.action}</span>
                          {r.errorCode && (
                            <>
                              <span className="text-zinc-500">·</span>
                              <span className="text-rose-300/80">{r.errorCode}</span>
                            </>
                          )}
                        </div>
                        {r.entityRef && (
                          <p className="text-[11px] font-mono text-zinc-500 mt-1 truncate">
                            {(() => {
                              // Cross-surface deep-link: certain entityRef
                              // prefixes map to a stable dashboard route so
                              // the audit row is also a navigation anchor.
                              const ref = r.entityRef;
                              if (ref.startsWith("engineer:")) {
                                const eid = ref.slice("engineer:".length);
                                return <Link href={`/dashboard/workforce/${eid}`} className="hover:text-white underline transition-colors">{ref}</Link>;
                              }
                              if (ref.startsWith("approval:")) {
                                return <Link href="/dashboard/approvals" className="hover:text-white underline transition-colors">{ref}</Link>;
                              }
                              if (ref.startsWith("schedule:")) {
                                return <Link href="/dashboard/scheduled-scans" className="hover:text-white underline transition-colors">{ref}</Link>;
                              }
                              if (ref.startsWith("cloudAccount:")) {
                                const cid = ref.slice("cloudAccount:".length);
                                return <Link href={`/dashboard/cloud-accounts/${cid}`} className="hover:text-white underline transition-colors">{ref}</Link>;
                              }
                              return ref;
                            })()}
                          </p>
                        )}
                        <p className="text-[10px] font-mono mt-1">
                          <span className={actorTone}>{r.actorKind}</span>
                          <span className="text-zinc-600"> · {r.correlationId.slice(0, 16)}</span>
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
          </section>
        </>
      )}
    </div>
  );
}

function CountTile({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className={`text-[22px] font-semibold tabular-nums ${tone}`}>{count}</p>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
