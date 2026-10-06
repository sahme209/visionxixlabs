/**
 * /admin/billing-alerts — Phase 385.
 *
 * Internal-only feed of BillingAlert rows. Admin-gated (ADMIN_EMAILS).
 * Shows the 70/90/100% threshold crossings across every workspace
 * this month, with per-workspace plan tier + dimension + ratio at
 * trigger time.
 *
 * Never linked from client surfaces.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightIcon,
  ExclamationTriangleIcon,
  BellAlertIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/billing/computeInvocationCost";

export const metadata: Metadata = {
  title: "Billing alerts · Admin",
};

export const dynamic = "force-dynamic";

const THRESHOLD_TONE: Record<number, string> = {
  70:  "text-zinc-300 bg-white/10 border-white/30",
  90:  "text-orange-300 bg-orange-500/10 border-orange-500/30",
  100: "text-rose-300 bg-rose-500/15 border-rose-500/40",
};

const DIMENSION_LABEL: Record<string, string> = {
  ai_credits:                  "AI credits",
  agent_runs_per_month:        "Agent runs",
  automation_runs_per_month:   "Automation runs",
  connector_syncs_per_month:   "Connector syncs",
  cloud_scans_per_month:       "Cloud scans",
  security_scans_per_month:    "Security scans",
  reports_per_month:           "Reports",
  pdf_exports_per_month:       "PDF exports",
  monitoring_events_per_month: "Monitoring events",
};

const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export default async function AdminBillingAlertsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/login");
  }

  const period = periodKey(new Date());

  const alerts = await prisma.billingAlert.findMany({
    where: { periodMonth: period },
    orderBy: { createdAt: "desc" },
    take: 200,
  }).catch(() => [] as Array<never>);

  // Counters for the top bar.
  const by70 = alerts.filter((a) => a.threshold === 70).length;
  const by90 = alerts.filter((a) => a.threshold === 90).length;
  const by100 = alerts.filter((a) => a.threshold === 100).length;
  const uniqueWorkspaces = new Set(alerts.map((a) => a.organizationId)).size;

  return (
    <div className="relative max-w-6xl">
      <div className="mb-6">
        <Link href="/admin" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to admin
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <BellAlertIcon className="h-4 w-4 text-zinc-400" />
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Billing alerts · admin only</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          {period} threshold crossings · <span className="text-gradient">{alerts.length} alerts</span>
        </h1>
        <p className="text-[13px] text-zinc-400 max-w-3xl leading-relaxed">
          Every 70%, 90%, and 100% threshold crossing across workspaces this month. The cron runs every 30 minutes; rows are de-duped per (workspace, dimension, threshold, period) so re-runs are no-ops.
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <SummaryStat label="70% crossings" value={String(by70)} tone="text-zinc-300" />
        <SummaryStat label="90% crossings" value={String(by90)} tone="text-orange-300" />
        <SummaryStat label="100% crossings" value={String(by100)} tone="text-rose-300" />
        <SummaryStat label="Workspaces alerting" value={String(uniqueWorkspaces)} tone={uniqueWorkspaces > 0 ? "text-violet-300" : "text-zinc-300"} icon={ChartBarIcon} />
      </section>

      {alerts.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <BellAlertIcon className="h-6 w-6 text-zinc-500 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-white">No alerts this period.</p>
          <p className="text-[11.5px] text-zinc-500 mt-1 max-w-md mx-auto leading-snug">
            The cron runs every 30 minutes. Alerts fire when a workspace crosses 70%, 90%, or 100% of any tracked dimension.
          </p>
        </section>
      ) : (
        <section className="space-y-2">
          {alerts.map((a) => {
            const tone = THRESHOLD_TONE[a.threshold] ?? "text-zinc-300 bg-white/[0.04] border-white/[0.08]";
            const dimLabel = DIMENSION_LABEL[a.dimension] ?? a.dimension;
            const isCostDim = a.dimension === "ai_credits";
            return (
              <article key={a.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <header className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ExclamationTriangleIcon className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${tone}`}>
                      {a.threshold}%
                    </span>
                    <span className="text-[11px] font-semibold text-white">{dimLabel}</span>
                    <span className="text-[10px] font-mono text-zinc-500">·</span>
                    <span className="text-[11px] font-mono text-zinc-300 truncate">{a.organizationId}</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-violet-300">
                    {a.planTier}
                  </span>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10.5px]">
                  <Field
                    label="Used"
                    value={isCostDim ? formatCents(a.currentAtTrigger) : a.currentAtTrigger.toLocaleString()}
                  />
                  <Field
                    label="Limit"
                    value={a.limitAtTrigger == null
                      ? "Custom"
                      : isCostDim ? formatCents(a.limitAtTrigger) : a.limitAtTrigger.toLocaleString()}
                  />
                  <Field label="Ratio" value={`${Math.round(a.ratioAtTrigger * 100)}%`} />
                  <Field label="Fired at" value={a.createdAt.toISOString()} />
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-white/15 bg-white/[0.04] p-5">
        <p className="text-[10px] font-semibold text-zinc-300 uppercase tracking-widest mb-2">// alert mechanics</p>
        <ul className="text-[12px] text-zinc-300 leading-relaxed list-disc list-inside marker:text-white/70 space-y-1">
          <li>Cron <code className="text-zinc-200">/api/cron/check-billing-alerts</code> runs every 30 minutes (Bearer CRON_SECRET guarded).</li>
          <li>Unique index on (workspace, dimension, threshold, period) makes re-runs no-ops.</li>
          <li>Delivery channel defaults to <span className="font-mono text-zinc-200">dashboard</span>. Email + Slack delivery wired in a follow-up phase.</li>
          <li>Enterprise (custom-contract) dimensions with null limits are skipped — no threshold to cross.</li>
        </ul>
      </section>
    </div>
  );
}

function SummaryStat({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon?: typeof ChartBarIcon }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      {Icon && <Icon className={`h-4 w-4 ${tone} mb-2`} />}
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-[11px] font-mono text-zinc-100 mt-0.5 truncate">{value}</p>
    </div>
  );
}
