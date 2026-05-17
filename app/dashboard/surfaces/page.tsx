"use client";

/**
 * /dashboard/surfaces
 *
 * Renders the canonical 14-surface Axiom product map from
 * `/api/product/surfaces`. Every card is real data — no static demo
 * arrays. First-class macOS / Windows / Linux desktop chips at the top.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CloudIcon, ShieldCheckIcon, ComputerDesktopIcon, BoltIcon, EyeIcon } from "@heroicons/react/24/outline";

interface Surface {
  id: string;
  label: string;
  role: string;
  status: string;
  sourceMode: string;
  evidence: string;
  limitations: string[];
  blockers: string[];
  routes: string[];
  safeNextAction?: { label: string; href: string };
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

interface ProductModel {
  generatedAt: string;
  overallSourceMode: string;
  overallStatus: string;
  surfaces: Surface[];
  desktopPlatforms: PlatformStatusEntry[];
  productLimitations: string[];
  safetyContract: string;
}

const STATUS_TONE: Record<string, { border: string; bg: string; text: string; pillBg: string; pillText: string }> = {
  launch_ready:             { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.05]", text: "text-emerald-300", pillBg: "bg-emerald-500/15", pillText: "text-emerald-300" },
  pilot_ready:              { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.05]",    text: "text-cyan-300",    pillBg: "bg-cyan-500/15",    pillText: "text-cyan-300"    },
  usable_with_limitations:  { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.05]",   text: "text-amber-300",   pillBg: "bg-amber-500/15",   pillText: "text-amber-300"   },
  preview:                  { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-300",    pillBg: "bg-zinc-700/40",    pillText: "text-zinc-300"    },
  foundation:               { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pillBg: "bg-zinc-700/40",    pillText: "text-zinc-400"    },
  blocked:                  { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.05]",    text: "text-rose-300",    pillBg: "bg-rose-500/15",    pillText: "text-rose-300"    },
  broken:                   { border: "border-rose-500/[0.30]",    bg: "bg-rose-500/[0.08]",    text: "text-rose-200",    pillBg: "bg-rose-500/20",    pillText: "text-rose-200"    },
};

const SURFACE_ICON: Record<string, typeof CloudIcon> = {
  web_app: BoltIcon,
  macos_app: ComputerDesktopIcon,
  windows_app: ComputerDesktopIcon,
  linux_app: ComputerDesktopIcon,
  cloud_connectors: CloudIcon,
  releaseops_connectors: BoltIcon,
  security_engine: ShieldCheckIcon,
  remediation_engine: EyeIcon,
  simulation_engine: EyeIcon,
  approval_engine: ShieldCheckIcon,
  desktop_review_workstation: ComputerDesktopIcon,
  trust_center: ShieldCheckIcon,
  audit_evidence_layer: EyeIcon,
  safe_autonomous_loop: BoltIcon,
};

export default function SurfacesPage() {
  const [model, setModel] = useState<ProductModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/product/surfaces", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ProductModel; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setModel(json.data);
        else setError(json.error?.userMessage ?? "Surfaces unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="relative p-6">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// axiom product surfaces</p>
        <p className="text-sm text-zinc-400 mt-2">Composing the 14-surface product map…</p>
      </div>
    );
  }
  if (error || !model) {
    return (
      <div className="relative p-6">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// axiom product surfaces · preview</p>
        <p className="text-sm text-zinc-400 mt-2">{error ?? "Sign in to load surfaces."}</p>
      </div>
    );
  }

  const overallTone = STATUS_TONE[model.overallStatus] ?? STATUS_TONE.preview;

  return (
    <div className="relative">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${overallTone.pillBg} ${overallTone.pillText}`}>
            {model.overallStatus.replace(/_/g, " ")}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
            {model.overallSourceMode}
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            · last sync {new Date(model.generatedAt).toLocaleTimeString()}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-[-0.04em] mb-1">Axiom product surfaces</h1>
        <p className="text-sm text-zinc-400">
          14 canonical surfaces composed from real platform state. Every status, source mode, and safe-next-action is derived from canonical builders — never fabricated.
        </p>
      </div>

      {/* Desktop platforms — first-class */}
      <div className="mb-6">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// desktop platforms</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {model.desktopPlatforms.map((p) => {
            const ok = p.publiclyDownloadable;
            const partial = p.signed && !p.publiclyDownloadable;
            const tone = ok ? "emerald" : partial ? "cyan" : "zinc";
            const tw = {
              emerald: "border-emerald-500/[0.22] bg-emerald-500/[0.05] text-emerald-300",
              cyan:    "border-cyan-500/[0.22] bg-cyan-500/[0.05] text-cyan-300",
              zinc:    "border-zinc-700/30 bg-white/[0.02] text-zinc-400",
            }[tone];
            return (
              <div key={p.platform} className={`rounded-xl border ${tw} p-4`}>
                <p className="text-[10px] font-mono uppercase tracking-wider mb-2 text-zinc-500">{p.platform}</p>
                <p className={`text-sm font-semibold ${ok || partial ? "text-white" : "text-zinc-300"} mb-1`}>{p.label}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
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
                {p.blocker && (
                  <p className="text-[11px] text-zinc-500 mt-2 leading-snug">{p.blocker}</p>
                )}
                {p.safeNextAction && (
                  <Link href={p.safeNextAction.href} className="inline-flex items-center gap-1 mt-2 text-[11px] text-zinc-300 hover:text-white">
                    {p.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 14 surfaces */}
      <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// product surfaces</p>
      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
        {model.surfaces.map((s) => {
          const tone = STATUS_TONE[s.status] ?? STATUS_TONE.preview;
          const Icon = SURFACE_ICON[s.id] ?? CloudIcon;
          return (
            <div key={s.id} className={`rounded-xl border ${tone.border} ${tone.bg} p-5 flex flex-col`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`h-5 w-5 ${tone.text} shrink-0`} />
                  <h3 className="text-base font-semibold text-white truncate">{s.label}</h3>
                </div>
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${tone.pillBg} ${tone.pillText} shrink-0`}>
                  {s.status.replace(/_/g, " ")}
                </span>
              </div>

              <p className="text-[12px] text-zinc-400 leading-relaxed mb-3">{s.role}</p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">{s.sourceMode}</span>
              </div>

              <p className="text-[11px] text-zinc-500 font-mono mb-2 leading-snug">{s.evidence}</p>

              {s.limitations.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-mono text-amber-300/70 uppercase tracking-wider mb-1">// limitations</p>
                  <ul className="space-y-0.5">
                    {s.limitations.slice(0, 2).map((l, i) => (
                      <li key={i} className="text-[11px] text-zinc-500">{l}</li>
                    ))}
                  </ul>
                </div>
              )}

              {s.blockers.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-mono text-rose-300/70 uppercase tracking-wider mb-1">// blockers</p>
                  <ul className="space-y-0.5">
                    {s.blockers.slice(0, 2).map((l, i) => (
                      <li key={i} className="text-[11px] text-rose-200/80">{l}</li>
                    ))}
                  </ul>
                </div>
              )}

              {s.safeNextAction && (
                <Link href={s.safeNextAction.href} className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-200 hover:text-white transition-colors">
                  {s.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Product-level limitations + safety */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// product limitations</p>
        <ul className="space-y-1.5">
          {model.productLimitations.map((l, i) => (
            <li key={i} className="text-[12px] text-zinc-400 leading-relaxed">{l}</li>
          ))}
        </ul>
        <p className="text-[11px] font-mono text-emerald-300/80 mt-4">
          {model.safetyContract.replace(/_/g, " ")}
        </p>
      </div>
    </div>
  );
}
