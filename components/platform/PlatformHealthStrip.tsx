/**
 * <PlatformHealthStrip/> — server-side fetched live status row.
 *
 * Rendered on top-level platform indexes (/dashboard/modules,
 * /dashboard/sub-tools) so the operator's first-load impression
 * includes their actual tenant state, not just the catalog. Falls
 * silent when the user has no org context or the DB read fails —
 * never blocks the page.
 */

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { getLivePlatformSummary } from "@/lib/platform/livePlatformState";
import { LiveBadge } from "./LiveBadge";

export async function PlatformHealthStrip() {
  const live = await getLivePlatformSummary();
  if (!live.ok) return null;

  const cells: ReadonlyArray<{
    href: string;
    label: string;
    value: number;
    tone: "violet" | "cyan" | "emerald" | "amber";
    sub?: string;
  }> = [
    { href: "/dashboard/connectors", label: "Cloud accounts", value: live.cloudAccounts, tone: "violet" },
    { href: "/dashboard/agents",     label: "Agent runs · 24h", value: live.agentRuns24h, tone: "cyan",
      sub: live.busMessages24h > 0 ? `${live.busMessages24h.toLocaleString()} bus msgs` : undefined },
    { href: "/dashboard/automation", label: "Bus messages · 24h", value: live.busMessages24h, tone: "emerald" },
    { href: "/dashboard/approvals",  label: "Approvals pending", value: live.pendingApprovals, tone: "amber" },
  ];

  const toneMap = {
    violet:  "border-violet-500/30 bg-violet-500/[0.06] hover:bg-violet-500/[0.10]",
    cyan:    "border-cyan-500/30   bg-cyan-500/[0.06]   hover:bg-cyan-500/[0.10]",
    emerald: "border-emerald-500/30 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.10]",
    amber:   "border-white/30  bg-white/[0.06]  hover:bg-white/[0.10]",
  } as const;

  return (
    <section className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 md:p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[12.5px] font-semibold text-emerald-100 flex items-center gap-2">
          <LiveBadge />
          Platform health · your tenant
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300/70">
          24h rolling
        </span>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {cells.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={[
              "block rounded-xl border p-3 transition",
              toneMap[c.tone],
            ].join(" ")}
          >
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">{c.label}</p>
            <p className="mt-1 text-[20px] font-semibold text-white tabular-nums">{c.value.toLocaleString()}</p>
            {c.sub ? (
              <p className="mt-0.5 text-[10.5px] text-zinc-400 truncate">{c.sub}</p>
            ) : null}
            <span className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-zinc-300">
              Open
              <ArrowRightIcon className="h-2.5 w-2.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
