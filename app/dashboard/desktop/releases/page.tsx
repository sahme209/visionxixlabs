"use client";

/**
 * /dashboard/desktop/releases — Desktop Release Management Center.
 *
 * The operator's release-control surface. Joins the live GH release
 * manifest with the per-platform gate registry. Never publishes — the
 * contract is `release_review_only_no_publish`.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  RocketLaunchIcon,
  XCircleIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";

type GateStatus = "passing" | "partial" | "preview" | "blocked" | "planned";
type PlatformState = "live" | "preview" | "planned" | "blocked" | "deprecated";

interface GateLite {
  id: string;
  label: string;
  description: string;
  status: GateStatus;
  reason: string;
  evidenceRef: string;
  nextFix?: string;
}

interface PlatformLite {
  platform: string;
  label: string;
  state: PlatformState;
  liveVersion?: string;
  channel: string;
  assetFileName?: string;
  downloadUrl?: string;
  sizeBytes?: number;
  signed: boolean;
  notarized: boolean;
  installFriction: string;
  gates: GateLite[];
}

interface ReportLite {
  generatedAt: string;
  sourceMode: string;
  platforms: PlatformLite[];
  globalGates: GateLite[];
  summary: {
    totalPlatforms: number;
    liveCount: number;
    previewCount: number;
    plannedCount: number;
    blockedCount: number;
    signedCount: number;
    notarizedCount: number;
    allSignedAndNotarized: boolean;
    latestTag?: string;
    latestPublishedAt?: string;
    latestHtmlUrl?: string;
  };
  safetyContract: "release_review_only_no_publish";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const GATE_VISUAL: Record<GateStatus, { pill: string; icon: typeof CheckCircleIcon; label: string }> = {
  passing: { pill: "bg-emerald-500/15 text-emerald-300",  icon: CheckCircleIcon,         label: "passing" },
  partial: { pill: "bg-cyan-500/15 text-cyan-300",        icon: ClockIcon,               label: "partial" },
  preview: { pill: "bg-white/15 text-zinc-300",      icon: ExclamationTriangleIcon, label: "preview" },
  blocked: { pill: "bg-rose-500/15 text-rose-300",        icon: XCircleIcon,             label: "blocked" },
  planned: { pill: "bg-zinc-700/40 text-zinc-300",        icon: MinusCircleIcon,         label: "planned" },
};

const PLATFORM_STATE_VISUAL: Record<PlatformState, { border: string; bg: string; pill: string }> = {
  live:       { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", pill: "bg-emerald-500/15 text-emerald-300" },
  preview:    { border: "border-white/[0.18]",   bg: "bg-white/[0.04]",   pill: "bg-white/15 text-zinc-300" },
  planned:    { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       pill: "bg-zinc-700/40 text-zinc-300" },
  blocked:    { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    pill: "bg-rose-500/15 text-rose-300" },
  deprecated: { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       pill: "bg-zinc-700/40 text-zinc-300" },
};

export default function DesktopReleasesPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/desktop/releases", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Release management unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
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
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <RocketLaunchIcon className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              Desktop Releases · release_review_only_no_publish
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Every release. <span className="text-gradient">Every gate.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          The release control surface. Live GitHub manifest joined with per-platform signing + notarization gates. The view never publishes — that happens in CI from a tagged commit.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Platforms" value={String(report.summary.totalPlatforms)} tone="zinc" />
            <Stat label="Live" value={String(report.summary.liveCount)} tone={report.summary.liveCount > 0 ? "emerald" : "zinc"} />
            <Stat label="Signed" value={`${report.summary.signedCount}/${report.summary.totalPlatforms}`} tone={report.summary.signedCount === report.summary.totalPlatforms ? "emerald" : "amber"} />
            <Stat label="Notarized" value={`${report.summary.notarizedCount}/2`} tone={report.summary.notarizedCount === 2 ? "emerald" : "amber"} />
          </div>
        )}
        {report?.summary.latestTag && (
          <div className="mt-4 flex items-center gap-2 flex-wrap text-[12px] font-mono text-zinc-400">
            <span>active tag <span className="text-white">{report.summary.latestTag}</span></span>
            {report.summary.latestPublishedAt && (
              <span>· published {new Date(report.summary.latestPublishedAt).toLocaleString()}</span>
            )}
            {report.summary.latestHtmlUrl && (
              <Link href={report.summary.latestHtmlUrl} target="_blank" className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200">
                open release page <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">Loading desktop release info…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-1">// release center unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {/* Next action */}
          <div className="rounded-2xl border border-violet-500/15 bg-white/[0.015] p-5 mb-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-violet-300/80 uppercase tracking-[0.18em] mb-1">// recommended next step</p>
              <p className="text-[14px] text-white font-semibold leading-snug">{report.safeNextAction.label}</p>
            </div>
            <Link href={report.safeNextAction.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white hover:text-violet-100 border border-white/[0.12] hover:border-violet-500/50 bg-white/[0.025] rounded-md px-3 py-1.5 transition-colors">
              {report.safeNextAction.label}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>

          {/* Per-platform grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {report.platforms.map((p) => {
              const visual = PLATFORM_STATE_VISUAL[p.state];
              return (
                <div key={p.platform} className={`rounded-2xl border ${visual.border} ${visual.bg} p-5`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white tracking-tight">{p.label}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${visual.pill}`}>{p.state}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">{p.channel}</span>
                        {p.liveVersion && (
                          <span className="text-[10px] font-mono text-zinc-400">v{p.liveVersion}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.signed && <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">signed</span>}
                      {p.notarized && <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">notarized</span>}
                    </div>
                  </div>

                  <p className="text-[11.5px] text-zinc-400 italic leading-snug mb-2">{p.installFriction}</p>

                  {p.assetFileName && p.downloadUrl && (
                    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2 mb-3">
                      <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-0.5">// active asset</p>
                      <Link href={p.downloadUrl} target="_blank" className="text-[11px] font-mono text-emerald-300 hover:text-emerald-200 break-all inline-flex items-center gap-1">
                        {p.assetFileName} <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                      </Link>
                      {typeof p.sizeBytes === "number" && (
                        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{(p.sizeBytes / 1024 / 1024).toFixed(2)} MB</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    {p.gates.map((g) => {
                      const gv = GATE_VISUAL[g.status];
                      const Icon = gv.icon;
                      return (
                        <div key={`${p.platform}:${g.id}`} className="flex items-start gap-2 rounded-md border border-white/[0.04] bg-white/[0.015] p-2">
                          <Icon className="h-3.5 w-3.5 text-white/60 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11.5px] text-white font-medium">{g.label}</span>
                              <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${gv.pill}`}>{gv.label}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-snug">{g.reason}</p>
                            {g.nextFix && (
                              <p className="text-[10px] font-mono text-zinc-300/80 mt-0.5">next: {g.nextFix}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Global gates */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// global release gates</p>
            <div className="space-y-1">
              {report.globalGates.map((g) => {
                const gv = GATE_VISUAL[g.status];
                const Icon = gv.icon;
                return (
                  <div key={g.id} className="flex items-start gap-2 rounded-md border border-white/[0.04] bg-white/[0.015] p-2">
                    <Icon className="h-3.5 w-3.5 text-white/60 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11.5px] text-white font-medium">{g.label}</span>
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${gv.pill}`}>{gv.label}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug">{g.reason}</p>
                      {g.nextFix && (
                        <p className="text-[10px] font-mono text-zinc-300/80 mt-0.5">next: {g.nextFix}</p>
                      )}
                      <p className="text-[9px] font-mono text-zinc-500 mt-0.5">evidence: {g.evidenceRef}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contract */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// release center contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                {report.limitations.join(" ")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[18px] font-bold mt-1">{value}</p>
    </div>
  );
}
