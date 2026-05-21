"use client";

/**
 * /dashboard/admin-charters — platform-admin view of every tenant's
 * autonomy charter.
 *
 * Requires the caller's email to be in ADMIN_EMAILS. Surfaces a
 * forbidden message otherwise; the underlying API also enforces.
 */

import { useEffect, useState } from "react";
import { ShieldCheckIcon, CpuChipIcon } from "@heroicons/react/24/outline";

interface CharterRecord {
  organizationId: string;
  mode: string;
  perCycleActionLimit: number | null;
  rationale: string | null;
  slackWebhookOverridePresent: boolean;
  updatedAt: string;
  updatedBy: string | null;
  createdAt: string;
}

interface Report {
  total: number;
  perMode: Record<string, number>;
  records: CharterRecord[];
}

const MODE_TONE: Record<string, string> = {
  observer:   "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  review:     "bg-sky-500/15 text-sky-300 border-sky-500/30",
  assisted:   "bg-violet-500/15 text-violet-300 border-violet-500/30",
  autonomous: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export default function AdminChartersPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/admin/charters", { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as { ok?: boolean; data?: Report; error?: { code?: string; userMessage?: string } };
        if (j.ok && j.data) {
          setReport(j.data);
        } else if (j.error?.code === "admin.required") {
          setForbidden(true);
        } else {
          setError(j.error?.userMessage ?? "Admin charters unavailable.");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."));
  }, []);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(244,114,182,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ShieldCheckIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              Admin
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Every tenant's <span className="text-gradient">charter.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Cross-tenant snapshot of every TenantAutonomyCharter row. Set ADMIN_EMAILS to access.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-2">
            <Stat label="Tenants" value={String(report.total)} tone="indigo" icon={CpuChipIcon} />
            <Stat label="Observer" value={String(report.perMode.observer ?? 0)} tone="zinc" />
            <Stat label="Review"   value={String(report.perMode.review ?? 0)}   tone="sky" />
            <Stat label="Assisted" value={String(report.perMode.assisted ?? 0)} tone="violet" />
            <Stat label="Autonomous" value={String(report.perMode.autonomous ?? 0)} tone="emerald" />
          </div>
        )}
      </div>

      {forbidden && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-amber-100">
          <p className="font-semibold mb-1">Platform admin required.</p>
          <p>Add your email to the ADMIN_EMAILS env var to view this page.</p>
        </div>
      )}

      {error && !forbidden && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {report && (
        report.total === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No tenants have set a charter override yet. They're all running on the global observer default.
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden mb-8">
            {report.records.map((r) => (
              <div key={r.organizationId} className="px-3 py-2.5 hover:bg-white/[0.02]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${MODE_TONE[r.mode] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                    {r.mode}
                  </span>
                  <code className="text-[10px] font-mono text-zinc-400">{r.organizationId}</code>
                  {r.perCycleActionLimit !== null && (
                    <span className="text-[10px] font-mono text-zinc-500">cap {r.perCycleActionLimit}/cycle</span>
                  )}
                  {r.slackWebhookOverridePresent && (
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      slack override
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                    {r.updatedBy ? `by ${r.updatedBy} · ` : ""}{new Date(r.updatedAt).toLocaleString()}
                  </span>
                </div>
                {r.rationale && (
                  <p className="text-[11px] text-zinc-400 italic">"{r.rationale}"</p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "indigo" | "zinc" | "sky" | "violet" | "emerald"; icon?: typeof CpuChipIcon }) {
  const cls = {
    indigo:  "border-indigo-500/[0.18] bg-indigo-500/[0.03] text-indigo-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
    sky:     "border-sky-500/[0.18] bg-sky-500/[0.03] text-sky-200",
    violet:  "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[18px] font-bold">{value}</p>
      </div>
    </div>
  );
}
