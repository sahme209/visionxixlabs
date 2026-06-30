"use client";

import Link from "next/link";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  CubeTransparentIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import {
  VALIDATION_MATRIX,
  STATUS_LABEL,
  summarizeValidation,
  type ValidationStatus,
  type ValidationRow,
} from "@/lib/validation/platformValidationMatrix";
import {
  CAPABILITY_TABLES,
  CATEGORY_LABEL as CAP_CATEGORY_LABEL,
  summarizeCapabilities,
} from "@/lib/cloud/providerCapabilities";

export default function ValidationPage() {
  const summary = summarizeValidation();
  const caps = summarizeCapabilities();

  return (
    <div className="relative">
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <CubeTransparentIcon className="h-4 w-4 text-cyan-300" />
            <p className="text-[10px] font-semibold text-cyan-300 uppercase tracking-[0.18em]">Validation Matrix</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            What actually <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">works.</span>
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Every capability listed below carries an honest status and a pointer to the file or route that proves it. Nothing claims &quot;passing&quot; without backing evidence.
          </p>
          <p className="text-[12px] text-zinc-500 mt-3 font-mono">
            <Link href="/dashboard/capabilities" className="text-emerald-300 hover:text-white transition-colors underline underline-offset-2">
              action surface · what axiom can do today →
            </Link>
            <span className="text-zinc-700 mx-2">·</span>
            <Link href="/dashboard/command-center" className="text-emerald-300 hover:text-white transition-colors underline underline-offset-2">
              live operating state →
            </Link>
          </p>
        </div>
      </Reveal>

      {/* Posture KPIs */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {[
          { label: "Score",     value: `${Math.round(summary.score * 100)}%`, sub: "Weighted by status", tone: "emerald" as const, Icon: CheckCircleIcon },
          { label: "Passing",   value: `${summary.passing}`,   sub: "Backed by evidence",   tone: "emerald" as const, Icon: CheckCircleIcon },
          { label: "Partial",   value: `${summary.partial}`,   sub: "Works in some modes",   tone: "amber"   as const, Icon: ExclamationTriangleIcon },
          { label: "Preview",   value: `${summary.preview}`,   sub: "Honest preview only",   tone: "amber"   as const, Icon: EyeIcon },
          { label: "Blocked",   value: `${summary.blocked}`,   sub: "Missing config / cert", tone: "zinc"    as const, Icon: ClockIcon },
        ].map((kpi) => {
          const { Icon } = kpi;
          const toneClass =
            kpi.tone === "emerald" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
            kpi.tone === "amber"   ? "text-amber-300 bg-amber-500/10 border-amber-500/20"       :
                                      "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
          return (
            <div key={kpi.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${toneClass}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-2xl font-bold text-white tracking-[-0.04em]">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 uppercase tracking-[0.12em] mt-1">{kpi.label}</p>
              <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{kpi.sub}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Matrix grouped by area */}
      <Reveal direction="up" delay={0.08}>
        <div className="space-y-3 mb-10">
          {Object.entries(groupBy(VALIDATION_MATRIX, "area")).map(([area, rows]) => (
            <div key={area} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
                <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-[0.15em]">
                  {area.replace(/_/g, " ")}
                </p>
                <span className="text-[10px] text-zinc-500 font-mono">{rows.length} item{rows.length === 1 ? "" : "s"}</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {rows.map((row) => <ValidationRowCard key={row.id} row={row} />)}
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Multi-cloud capability table */}
      <Reveal direction="up" delay={0.12}>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-10">
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-[0.15em]">Normalised multi-cloud capabilities</p>
            <span className="text-[11px] text-zinc-500">Same concept, three providers</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.05] text-left">
                  <th className="px-4 py-3 text-zinc-500 font-semibold uppercase tracking-[0.12em] text-[10px]">Category</th>
                  <th className="px-4 py-3 text-zinc-500 font-semibold uppercase tracking-[0.12em] text-[10px]">AWS</th>
                  <th className="px-4 py-3 text-zinc-500 font-semibold uppercase tracking-[0.12em] text-[10px]">Azure</th>
                  <th className="px-4 py-3 text-zinc-500 font-semibold uppercase tracking-[0.12em] text-[10px]">GCP</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set(CAPABILITY_TABLES.flatMap((t) => t.capabilities.map((c) => c.category)))).map((category) => {
                  const aws   = CAPABILITY_TABLES.find((t) => t.provider === "aws")?.capabilities.find((c) => c.category === category);
                  const azure = CAPABILITY_TABLES.find((t) => t.provider === "azure")?.capabilities.find((c) => c.category === category);
                  const gcp   = CAPABILITY_TABLES.find((t) => t.provider === "gcp")?.capabilities.find((c) => c.category === category);
                  return (
                    <tr key={category} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3 text-white font-semibold">{CAP_CATEGORY_LABEL[category]}</td>
                      <td className="px-4 py-3"><CapCell label={aws?.providerName} status={aws?.status} /></td>
                      <td className="px-4 py-3"><CapCell label={azure?.providerName} status={azure?.status} /></td>
                      <td className="px-4 py-3"><CapCell label={gcp?.providerName} status={gcp?.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between flex-wrap gap-2 text-[10px] text-zinc-500">
            <span>AWS: {caps.aws.preview} preview · {caps.aws.planned} planned</span>
            <span>Azure: {caps.azure.preview} preview · {caps.azure.expanding} expanding · {caps.azure.planned} planned</span>
            <span>GCP: {caps.gcp.preview} preview · {caps.gcp.expanding} expanding · {caps.gcp.planned} planned</span>
          </div>
        </div>
      </Reveal>

      {/* Footer */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { href: "/dashboard/security-scanner", label: "Security scanner", sub: "Run the cloud + app + supply-chain + desktop checks." },
          { href: "/dashboard/trust",            label: "Trust Center",      sub: "Compliance controls + evidence bundles." },
          { href: "/dashboard/command-center",   label: "Command Center",    sub: "Live workspace state." },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-cyan-500/25 hover:bg-cyan-500/[0.03] transition-colors">
            <p className="text-sm font-semibold text-white">{c.label}</p>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{c.sub}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300">Open <ArrowRightIcon className="h-3 w-3" /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ValidationRowCard({ row }: { row: ValidationRow }) {
  const Icon =
    row.status === "passing" ? CheckCircleIcon :
    row.status === "partial" ? ExclamationTriangleIcon :
    row.status === "failing" ? XCircleIcon :
    row.status === "preview" ? EyeIcon :
                                ClockIcon;
  const tone =
    row.status === "passing" ? "text-emerald-300" :
    row.status === "partial" ? "text-amber-300" :
    row.status === "failing" ? "text-red-300" :
    row.status === "preview" ? "text-amber-300" :
                                "text-zinc-500";
  return (
    <div className="px-5 py-3 flex items-start gap-3">
      <Icon className={`h-4 w-4 ${tone} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-sm font-semibold text-white truncate">{row.capability}</p>
          <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${statusBadgeClass(row.status)}`}>
            {STATUS_LABEL[row.status]}
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 font-mono truncate">evidence · {row.evidence}</p>
        {row.nextFix && (
          <p className="text-[11px] text-amber-300/80 mt-1 leading-relaxed">→ {row.nextFix}</p>
        )}
      </div>
    </div>
  );
}

function CapCell({ label, status }: { label?: string; status?: "live" | "preview" | "expanding" | "planned" }) {
  if (!label) return <span className="text-zinc-700">—</span>;
  const badge =
    status === "live"      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
    status === "preview"   ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
    status === "expanding" ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/20" :
                              "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-200">{label}</span>
      <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${badge}`}>{status}</span>
    </div>
  );
}

function statusBadgeClass(status: ValidationStatus): string {
  switch (status) {
    case "passing": return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    case "partial": return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "failing": return "text-red-300 bg-red-500/10 border-red-500/20";
    case "preview": return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "blocked": return "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
  }
}

function groupBy<T, K extends keyof T>(arr: T[], key: K): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    (out[k] ?? (out[k] = [])).push(item);
  }
  return out;
}
