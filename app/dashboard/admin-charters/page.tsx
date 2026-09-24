/**
 * /dashboard/admin-charters — Phase 674.
 *
 * Platform-admin-only surface listing every TenantAutonomyCharter
 * across tenants. Non-admins see a forbidden message — no data.
 *
 * NEVER echoes the slackWebhookOverride URL — only a presence flag —
 * so an admin viewing the roster can't accidentally leak per-tenant
 * webhook secrets.
 *
 * Ships the missing page called out by Phase 670's fs guard.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ShieldCheckIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { isPlatformAdmin } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const MODE_TONE: Record<string, string> = {
  observer:   "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
  review:     "text-sky-300 bg-sky-500/10 border-sky-500/20",
  assisted:   "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  autonomous: "text-amber-300 bg-amber-500/10 border-amber-500/20",
};

export default async function AdminChartersPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    redirect("/auth/signin?callbackUrl=/dashboard/admin-charters");
  }

  if (!isPlatformAdmin(ctx.email)) {
    return (
      <div className="max-w-3xl mx-auto px-1 -mt-2">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <div className="rounded-md border border-rose-500/20 bg-rose-500/[0.04] p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-rose-300 mb-3 inline-flex items-center gap-2">
            <LockClosedIcon className="h-4 w-4" />
            <span>forbidden</span>
            <span className="text-zinc-700">::</span>
            <span className="text-zinc-500">platform admin only</span>
          </p>
          <p className="text-[14px] text-zinc-200 leading-relaxed">
            This surface lists autonomy charters across every tenant. Access requires the caller&apos;s
            email to be in the <span className="font-mono text-zinc-300">ADMIN_EMAILS</span> environment
            allow-list. Your session does not have that role.
          </p>
        </div>
      </div>
    );
  }

  let rows: Array<{ organizationId: string; mode: string; perCycleActionLimit: number | null; rationale: string | null; slackWebhookOverride: string | null; updatedAt: Date; updatedBy: string | null }> = [];
  try {
    rows = await prisma.tenantAutonomyCharter.findMany({
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
  } catch {
    // DB unavailable — render empty
  }

  const perMode: Record<string, number> = {};
  for (const r of rows) perMode[r.mode] = (perMode[r.mode] ?? 0) + 1;

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Dashboard
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">admin-charters</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">{rows.length} tenants</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ShieldCheckIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Tenant autonomy charters
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-2xl">
          Platform admin view. Slack webhook URLs are never echoed — only a presence flag.
        </p>
      </header>

      {/* Per-mode count ribbon */}
      <section className="mb-8 flex gap-3 flex-wrap">
        {["observer", "review", "assisted", "autonomous"].map((mode) => (
          <div key={mode} className={`rounded-md border ${MODE_TONE[mode] ?? "border-white/[0.06] bg-white/[0.02]"} px-4 py-2`}>
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{mode}</p>
            <p className="text-[18px] font-semibold tabular-nums">{perMode[mode] ?? 0}</p>
          </div>
        ))}
      </section>

      {/* Roster */}
      {rows.length === 0 ? (
        <div className="rounded-md border border-white/[0.06] bg-white/[0.012] px-6 py-10 text-center">
          <p className="text-[13px] text-zinc-400">No autonomy charters yet.</p>
        </div>
      ) : (
        <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
          {rows.map((r) => (
            <li key={r.organizationId} className="px-5 py-3.5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1 text-[10px] font-mono uppercase tracking-wider">
                    <span className={MODE_TONE[r.mode]?.split(" ")[0] ?? "text-zinc-400"}>{r.mode}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-500">per-cycle limit {r.perCycleActionLimit ?? "—"}</span>
                    {r.slackWebhookOverride && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="text-amber-300">slack override set</span>
                      </>
                    )}
                  </div>
                  <p className="text-[13px] text-white font-mono">{r.organizationId}</p>
                  {r.rationale && (
                    <p className="text-[11.5px] text-zinc-500 mt-1 font-mono leading-relaxed">rationale :: {r.rationale}</p>
                  )}
                </div>
                <div className="text-right text-[10.5px] font-mono text-zinc-500 shrink-0">
                  <p>updated {r.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</p>
                  {r.updatedBy && <p>by {r.updatedBy}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
