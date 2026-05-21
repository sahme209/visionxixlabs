"use client";

/**
 * /dashboard/cloud-inventory — unified cross-cloud resource catalog.
 *
 * One pane of glass: AWS + Azure + GCP compute / storage / database
 * totals, plus per-cloud posture chips (public exposure, unencrypted,
 * identity weaknesses). Consumes /api/cloud/unified-inventory which
 * runs every per-cloud extractor in parallel.
 */

import { useEffect, useState } from "react";
import {
  ServerStackIcon,
  CloudIcon,
  CircleStackIcon,
  ShieldExclamationIcon,
  LockOpenIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";

type Mode = "live" | "preview" | "blocked" | "disabled" | "partial";

interface Section {
  cloud: "aws" | "azure" | "gcp";
  mode: Mode;
  scopeId?: string;
  totals: { compute: number; storage: number; database: number };
  publicExposureCount: number;
  unencryptedCount: number;
  identityWeaknessCount: number;
  headline: { label: string; value: string }[];
  limitations: string[];
}

interface Report {
  generatedAt: string;
  durationMs: number;
  totals: { compute: number; storage: number; database: number };
  totalResources: number;
  totalPublicExposure: number;
  totalUnencrypted: number;
  totalIdentityWeakness: number;
  sections: Section[];
  limitations: string[];
}

const CLOUD_LABEL: Record<Section["cloud"], string> = {
  aws: "Amazon Web Services",
  azure: "Microsoft Azure",
  gcp: "Google Cloud Platform",
};

const CLOUD_GRADIENT: Record<Section["cloud"], string> = {
  aws: "from-amber-500/[0.08] to-transparent",
  azure: "from-sky-500/[0.08] to-transparent",
  gcp: "from-emerald-500/[0.08] to-transparent",
};

export default function CloudInventoryPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cloud/unified-inventory", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Unified inventory unavailable.");
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(124,58,237,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(16,185,129,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ServerStackIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Cloud Inventory
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">
              last sync {new Date(report.generatedAt).toLocaleTimeString()} · {report.durationMs}ms
            </span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Every cloud. <span className="text-gradient">One inventory.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          AWS + Azure + GCP — compute, storage, and databases in a single normalized catalog. Real counts only,
          no fabricated numbers, ever.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total resources" value={report.totalResources.toLocaleString()} tone="violet" icon={ServerStackIcon} />
            <Stat label="Public exposure" value={report.totalPublicExposure.toLocaleString()} tone={report.totalPublicExposure > 0 ? "rose" : "emerald"} icon={ShieldExclamationIcon} />
            <Stat label="Unencrypted" value={report.totalUnencrypted.toLocaleString()} tone={report.totalUnencrypted > 0 ? "amber" : "emerald"} icon={LockOpenIcon} />
            <Stat label="Identity weakness" value={report.totalIdentityWeakness.toLocaleString()} tone={report.totalIdentityWeakness > 0 ? "amber" : "emerald"} icon={KeyIcon} />
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">
          // building unified inventory across 3 clouds…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <FamilyTile label="Compute" value={report.totals.compute} icon={ServerStackIcon} />
            <FamilyTile label="Storage" value={report.totals.storage} icon={CloudIcon} />
            <FamilyTile label="Databases" value={report.totals.database} icon={CircleStackIcon} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            {report.sections.map((s) => (
              <div key={s.cloud} className={`relative rounded-2xl border border-white/[0.06] bg-gradient-to-br ${CLOUD_GRADIENT[s.cloud]} p-5 overflow-hidden`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{s.cloud.toUpperCase()}</p>
                    <p className="text-[14px] font-semibold text-white">{CLOUD_LABEL[s.cloud]}</p>
                    {s.scopeId && (
                      <p className="text-[10px] font-mono text-zinc-400 truncate max-w-[200px]">{s.scopeId}</p>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      s.mode === "live"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : s.mode === "partial"
                          ? "bg-cyan-500/15 text-cyan-300"
                          : s.mode === "preview"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {s.mode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {s.headline.map((h) => (
                    <div key={h.label} className="rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-1.5">
                      <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{h.label}</p>
                      <p className="text-[14px] font-semibold text-white">{h.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Chip
                    label={`${s.publicExposureCount} public`}
                    tone={s.publicExposureCount > 0 ? "rose" : "emerald"}
                  />
                  <Chip
                    label={`${s.unencryptedCount} unencrypted`}
                    tone={s.unencryptedCount > 0 ? "amber" : "emerald"}
                  />
                  <Chip
                    label={`${s.identityWeaknessCount} id weak`}
                    tone={s.identityWeaknessCount > 0 ? "amber" : "emerald"}
                  />
                </div>

                {s.limitations.length > 0 && (
                  <details className="mt-3 group">
                    <summary className="text-[10px] font-mono text-zinc-500 cursor-pointer hover:text-zinc-300">
                      {s.limitations.length} note{s.limitations.length === 1 ? "" : "s"}
                    </summary>
                    <div className="mt-1.5 space-y-0.5 text-[10px] text-zinc-400 max-h-32 overflow-y-auto">
                      {s.limitations.slice(0, 8).map((l, i) => (
                        <p key={i}>· {l}</p>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>

          {report.limitations.length > 0 && (
            <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.03] p-4 mb-8">
              <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-2">
                // overall limitations
              </p>
              {report.limitations.map((l, i) => (
                <p key={i} className="text-[12px] text-zinc-300">· {l}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "violet";
  icon?: typeof ServerStackIcon;
}) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber: "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose: "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    violet: "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}

function FamilyTile({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ServerStackIcon }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
      <div className="rounded-lg bg-white/[0.04] p-2">
        <Icon className="h-5 w-5 text-violet-300" />
      </div>
      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-[26px] font-bold text-white leading-tight">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: "emerald" | "amber" | "rose" }) {
  const cls = {
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono ${cls}`}>
      {label}
    </span>
  );
}
