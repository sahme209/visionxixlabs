"use client";

/**
 * /dashboard/sources
 *
 * Main-journey provider + connector aggregator. The single page an
 * operator visits to see "what sources Axiom currently reads from" —
 * every card is real ProviderPosture from /api/axiom-os/state, plus a
 * first-class desktop platform ribbon and a pointer to docs explaining
 * the sourceMode taxonomy.
 *
 * Replaces a previously missing /dashboard/sources route that doc CTAs
 * and the connector registry had been linking to since the platform
 * shipped.
 *
 * No fake data. Every status, missing requirement, and safeNextAction
 * comes from canonical builders. Empty + error states are explicit.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CloudIcon,
  CodeBracketIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

interface ProviderPostureLite {
  provider: string;
  mode: string;
  headline: string;
  connectionStatus: string;
  missingRequirements: string[];
  resourceCount?: number;
  findingCount?: number;
  lastScannedAt?: string;
  safeNextAction?: { label: string; href: string };
}

interface AxiomOSStateLite {
  sourceMode: string;
  generatedAt: string;
  providers: ProviderPostureLite[];
}

interface PlatformStatusEntry {
  platform: "macos-arm" | "macos-intel" | "windows" | "linux";
  buildStatus: string;
  signed: boolean;
  notarized?: boolean;
  publiclyDownloadable: boolean;
  label: string;
  blocker?: string;
  safeNextAction?: { label: string; href: string };
}

interface DesktopStateLite {
  sourceMode: string;
  platformStatus: PlatformStatusEntry[];
}

const PROVIDER_DETAIL: Record<string, { icon: typeof CloudIcon; label: string; docs: string }> = {
  aws:    { icon: CloudIcon,        label: "AWS",    docs: "/docs/aws-setup"   },
  azure:  { icon: CloudIcon,        label: "Azure",  docs: "/docs/azure-setup" },
  gcp:    { icon: CloudIcon,        label: "GCP",    docs: "/docs/gcp-setup"   },
  github: { icon: CodeBracketIcon,  label: "GitHub", docs: "/docs/architecture#github-connector" },
};

const MODE_TONE: Record<string, { border: string; bg: string; text: string; pillBg: string; dot: string }> = {
  live:         { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pillBg: "bg-emerald-500/15", dot: "bg-emerald-400 animate-pulse" },
  partial_live: { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pillBg: "bg-cyan-500/15",    dot: "bg-cyan-400 animate-pulse"    },
  expanding:    { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pillBg: "bg-amber-500/15",   dot: "bg-amber-400"                 },
  preview:      { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pillBg: "bg-amber-500/15",   dot: "bg-amber-400"                 },
  blocked:      { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pillBg: "bg-rose-500/15",    dot: "bg-rose-400"                  },
  disabled:     { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pillBg: "bg-zinc-700/40",    dot: "bg-zinc-600"                  },
  unknown:      { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pillBg: "bg-zinc-700/40",    dot: "bg-zinc-600"                  },
};

export default function SourcesPage() {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [desktop, setDesktop] = useState<DesktopStateLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/axiom-os/state", { credentials: "include" })
        .then((r) => r.json())
        .then((json: { ok?: boolean; data?: AxiomOSStateLite; error?: { userMessage?: string } }) => {
          if (cancelled) return;
          if (json.ok && json.data) setState(json.data);
          else setError(json.error?.userMessage ?? "Sources unavailable.");
        }),
      fetch("/api/desktop/platform-status", { credentials: "include" })
        .then((r) => r.json())
        .then((json: { ok?: boolean; data?: DesktopStateLite }) => {
          if (cancelled) return;
          if (json.ok && json.data) setDesktop(json.data);
        })
        .catch(() => {}),
    ])
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const providers = state?.providers ?? [];
  const liveCount = providers.filter((p) => p.mode === "live").length;
  const partialCount = providers.filter((p) => p.mode === "partial_live").length;
  const previewCount = providers.filter((p) => p.mode === "preview" || p.mode === "expanding").length;
  const blockedCount = providers.filter((p) => p.mode === "blocked" || p.mode === "disabled").length;

  return (
    <div className="relative">
      {/* Hero */}
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

        <div className="grid md:grid-cols-[1fr_auto] items-end gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
                <CloudIcon className="h-3.5 w-3.5 text-cyan-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
                  Sources · {state?.sourceMode?.replace(/_/g, " ") ?? (loading ? "composing…" : "preview")}
                </span>
              </span>
              {state?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(state.generatedAt).toLocaleTimeString()}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              Where Axiom <span className="text-gradient">reads from.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Every cloud + repo source Axiom is currently connected to — with honest mode labels, missing requirements, and the safe next action per source. <span className="text-zinc-500">No mutations. Read-only by default.</span>
            </p>
          </div>

          {/* Counts ribbon */}
          <div className="hidden md:flex items-end gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
            <Stat label="Live" value={liveCount} tone="text-emerald-300" />
            <div className="w-px h-9 bg-white/[0.08]" />
            <Stat label="Partial" value={partialCount} tone="text-cyan-300" />
            <div className="w-px h-9 bg-white/[0.08]" />
            <Stat label="Preview" value={previewCount} tone="text-amber-300" />
            <div className="w-px h-9 bg-white/[0.08]" />
            <Stat label="Blocked" value={blockedCount} tone={blockedCount > 0 ? "text-rose-300" : "text-zinc-500"} />
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing source map…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// state unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {/* Cloud + Code sources */}
      {!loading && !error && providers.length > 0 && (
        <section className="mb-10">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// cloud + code sources</p>
              <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">Connected providers</h2>
            </div>
            <Link href="/docs/source-modes" className="text-[11px] text-zinc-500 hover:text-white transition-colors">What do these modes mean? →</Link>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {providers.map((p) => {
              const tone = MODE_TONE[p.mode] ?? MODE_TONE.preview;
              const detail = PROVIDER_DETAIL[p.provider];
              const Icon = detail?.icon ?? CloudIcon;
              return (
                <div key={p.provider} className={`group rounded-2xl border ${tone.border} ${tone.bg} p-5 hover:-translate-y-0.5 transition-all`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-lg border ${tone.border} ${tone.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4.5 w-4.5 ${tone.text}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-white tracking-tight">{detail?.label ?? p.provider}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                          <p className={`text-[10px] font-mono uppercase tracking-wider ${tone.text}`}>{p.mode.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                    </div>
                    {p.lastScannedAt && (
                      <span className="text-[10px] font-mono text-zinc-500">last scan {new Date(p.lastScannedAt).toLocaleTimeString()}</span>
                    )}
                  </div>
                  <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-3">{p.headline}</p>

                  {(typeof p.resourceCount === "number" || typeof p.findingCount === "number") && (
                    <div className="flex items-center gap-4 mb-3 text-[11px]">
                      {typeof p.resourceCount === "number" && (
                        <span className="text-zinc-400">{p.resourceCount} resources</span>
                      )}
                      {typeof p.findingCount === "number" && (
                        <span className={p.findingCount > 0 ? "text-amber-300" : "text-emerald-300"}>
                          {p.findingCount} attention-required
                        </span>
                      )}
                    </div>
                  )}

                  {p.missingRequirements.length > 0 && (
                    <div className="rounded-lg border border-amber-500/[0.12] bg-amber-500/[0.03] px-2.5 py-2 mb-3">
                      <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider mb-1">Setup needed</p>
                      <ul className="space-y-0.5">
                        {p.missingRequirements.slice(0, 3).map((r, i) => (
                          <li key={i} className="text-[11px] text-zinc-300 font-mono leading-snug">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    {p.safeNextAction && (
                      <Link href={p.safeNextAction.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white transition-colors">
                        {p.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                    )}
                    {detail?.docs && (
                      <Link href={detail.docs} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-white transition-colors">
                        Setup docs
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!loading && !error && providers.length === 0 && (
        <section className="mb-8 rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-2">// no sources connected</p>
          <p className="text-[14px] text-zinc-200 font-semibold mb-1">No providers wired yet.</p>
          <p className="text-[12px] text-zinc-400 leading-relaxed mb-3">
            Connect at least one cloud provider or GitHub to unlock the scan → finding → remediation → simulation → approval → desktop review → evidence flow.
          </p>
          <Link href="/operator/onboarding" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-200 hover:text-amber-100 border border-amber-500/30 bg-amber-500/[0.06] rounded-md px-3 py-1.5 transition-colors">
            Start onboarding <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </section>
      )}

      {/* Desktop platforms ribbon — first-class source from /api/desktop/platform-status */}
      {desktop && (
        <section className="mb-10">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// review surfaces</p>
              <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">Desktop platforms</h2>
            </div>
            <Link href="/download" className="text-[11px] text-zinc-500 hover:text-white transition-colors">Open download page →</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {desktop.platformStatus.map((p) => {
              const ok = p.publiclyDownloadable;
              const partial = p.signed && !p.publiclyDownloadable;
              const tw = ok
                ? "border-emerald-500/[0.22] bg-emerald-500/[0.04] hover:border-emerald-500/40"
                : partial
                  ? "border-cyan-500/[0.22] bg-cyan-500/[0.04] hover:border-cyan-500/40"
                  : "border-zinc-700/30 bg-white/[0.02] hover:border-white/20";
              const platformLabel =
                p.platform === "macos-arm"   ? "macOS · Apple Silicon" :
                p.platform === "macos-intel" ? "macOS · Intel" :
                p.platform === "windows"     ? "Windows" :
                                                "Linux";
              return (
                <div key={p.platform} className={`rounded-2xl border ${tw} p-4 transition-colors`}>
                  <div className="flex items-center justify-between mb-3">
                    <ComputerDesktopIcon className={`h-5 w-5 ${ok ? "text-emerald-300" : partial ? "text-cyan-300" : "text-zinc-400"}`} />
                    <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded ${
                      ok ? "bg-emerald-500/15 text-emerald-300" :
                      partial ? "bg-cyan-500/15 text-cyan-300" :
                      "bg-zinc-700/40 text-zinc-400"
                    }`}>
                      {p.buildStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className={`text-sm font-semibold ${ok || partial ? "text-white" : "text-zinc-300"} mb-0.5 tracking-tight`}>{platformLabel}</p>
                  <p className="text-[11px] text-zinc-500 mb-3 leading-snug">{p.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${p.signed ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400"}`}>
                      {p.signed ? "signed" : "unsigned"}
                    </span>
                    {p.notarized !== undefined && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${p.notarized ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400"}`}>
                        {p.notarized ? "notarized" : "not-notarized"}
                      </span>
                    )}
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${p.publiclyDownloadable ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                      {p.publiclyDownloadable ? "public download" : "local build only"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Safety contract footer */}
      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// safety contract</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
              Every source is read-only. Mutations require an approval. Local execution on desktop is disabled by safety contract.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-right min-w-[4rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}
