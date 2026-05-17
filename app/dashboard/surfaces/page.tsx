"use client";

/**
 * /dashboard/surfaces
 *
 * Renders the canonical 14-surface Axiom product map from
 * `/api/product/surfaces`. Every card is real data — no static demo
 * arrays. First-class macOS / Windows / Linux desktop chips, then a
 * bento composition grouping surfaces by operator-meaning:
 *   - Operator front doors (web + desktop review)
 *   - Sources & connectors
 *   - Operating engines (scan / simulate / remediate / approve / loop)
 *   - Trust + audit + evidence
 *
 * Every status, source-mode, evidence, limitation, blocker, and
 * safeNextAction is derived from canonical builders — never fabricated.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CloudIcon,
  ShieldCheckIcon,
  ComputerDesktopIcon,
  BoltIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

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

const STATUS_TONE: Record<string, { border: string; bg: string; text: string; pillBg: string; pillText: string; hoverBorder: string }> = {
  launch_ready:             { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pillBg: "bg-emerald-500/15", pillText: "text-emerald-300", hoverBorder: "hover:border-emerald-500/40" },
  pilot_ready:              { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pillBg: "bg-cyan-500/15",    pillText: "text-cyan-300",    hoverBorder: "hover:border-cyan-500/40"    },
  usable_with_limitations:  { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pillBg: "bg-amber-500/15",   pillText: "text-amber-300",   hoverBorder: "hover:border-amber-500/40"   },
  preview:                  { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-300",    pillBg: "bg-zinc-700/40",    pillText: "text-zinc-300",    hoverBorder: "hover:border-white/20"       },
  foundation:               { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pillBg: "bg-zinc-700/40",    pillText: "text-zinc-400",    hoverBorder: "hover:border-white/20"       },
  blocked:                  { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pillBg: "bg-rose-500/15",    pillText: "text-rose-300",    hoverBorder: "hover:border-rose-500/40"    },
  broken:                   { border: "border-rose-500/[0.30]",    bg: "bg-rose-500/[0.07]",    text: "text-rose-200",    pillBg: "bg-rose-500/20",    pillText: "text-rose-200",    hoverBorder: "hover:border-rose-500/50"    },
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

// Operator-meaning categories — groups the 14 surfaces into bento sections.
const CATEGORIES: { title: string; eyebrow: string; ids: string[] }[] = [
  {
    title: "Operator front doors",
    eyebrow: "// where you work from",
    ids: ["web_app", "desktop_review_workstation"],
  },
  {
    title: "Sources & connectors",
    eyebrow: "// what Axiom reads",
    ids: ["cloud_connectors", "releaseops_connectors"],
  },
  {
    title: "Operating engines",
    eyebrow: "// scan · simulate · remediate · approve",
    ids: ["security_engine", "remediation_engine", "simulation_engine", "approval_engine", "safe_autonomous_loop"],
  },
  {
    title: "Trust, audit & evidence",
    eyebrow: "// proof you can hand an auditor",
    ids: ["trust_center", "audit_evidence_layer"],
  },
];

function summarize(surfaces: Surface[]) {
  let launchReady = 0, pilotReady = 0, preview = 0, blocked = 0;
  for (const s of surfaces) {
    if (s.status === "launch_ready") launchReady++;
    else if (s.status === "pilot_ready") pilotReady++;
    else if (s.status === "blocked" || s.status === "broken") blocked++;
    else if (s.status === "preview" || s.status === "foundation") preview++;
  }
  return { launchReady, pilotReady, preview, blocked, total: surfaces.length };
}

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
  const counts = summarize(model.surfaces);
  const surfacesById = new Map(model.surfaces.map((s) => [s.id, s]));
  const uncategorizedIds = model.surfaces
    .map((s) => s.id)
    .filter((id) => !CATEGORIES.some((c) => c.ids.includes(id)));

  return (
    <div className="relative">
      {/* Hero — premium, calm depth, honest status pill, real summary ribbon */}
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
              <span className={`inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1`}>
                <span className={`w-2 h-2 rounded-full ${
                  model.overallSourceMode === "live" ? "bg-emerald-400 animate-pulse" :
                  model.overallSourceMode === "partial_live" ? "bg-cyan-400 animate-pulse" :
                  model.overallSourceMode === "blocked" ? "bg-rose-400" :
                  "bg-amber-400"
                }`} />
                <span className={`text-[10px] font-semibold uppercase tracking-widest ${overallTone.pillText}`}>
                  {model.overallStatus.replace(/_/g, " ")} · {model.overallSourceMode.replace(/_/g, " ")}
                </span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                last sync {new Date(model.generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              Axiom <span className="text-gradient">product surfaces.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Every surface Axiom ships, grouped by operator meaning. Each card is real platform state — status, source mode, evidence, limitations, blockers, and safeNextAction come from canonical builders. <span className="text-zinc-500">No demo data.</span>
            </p>
          </div>

          {/* Counts ribbon */}
          <div className="hidden md:flex items-end gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
            <RibbonStat label="Launch-ready" value={counts.launchReady} tone="text-emerald-300" />
            <div className="w-px h-9 bg-white/[0.08]" />
            <RibbonStat label="Pilot-ready" value={counts.pilotReady} tone="text-cyan-300" />
            <div className="w-px h-9 bg-white/[0.08]" />
            <RibbonStat label="Preview" value={counts.preview} tone="text-amber-300" />
            <div className="w-px h-9 bg-white/[0.08]" />
            <RibbonStat label="Blocked" value={counts.blocked} tone={counts.blocked > 0 ? "text-rose-300" : "text-zinc-500"} />
          </div>
        </div>
      </div>

      {/* Desktop platforms — first-class, refined chips */}
      <div className="mb-10">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// desktop platforms</p>
            <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">macOS · Windows · Linux</h2>
          </div>
          <p className="text-[11px] text-zinc-500 hidden sm:block">Each platform reports real signing + notarization + public-download state.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {model.desktopPlatforms.map((p) => {
            const ok = p.publiclyDownloadable;
            const partial = p.signed && !p.publiclyDownloadable;
            const platformLabel =
              p.platform === "macos-arm"   ? "macOS · Apple Silicon" :
              p.platform === "macos-intel" ? "macOS · Intel" :
              p.platform === "windows"     ? "Windows" :
                                              "Linux";
            const tw = ok
              ? "border-emerald-500/[0.22] bg-emerald-500/[0.04] hover:border-emerald-500/40"
              : partial
                ? "border-cyan-500/[0.22] bg-cyan-500/[0.04] hover:border-cyan-500/40"
                : "border-zinc-700/30 bg-white/[0.02] hover:border-white/20";
            return (
              <div key={p.platform} className={`group rounded-2xl border ${tw} p-4 transition-colors`}>
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
                {p.blocker && (
                  <p className="text-[11px] text-zinc-500 mt-3 leading-snug">{p.blocker}</p>
                )}
                {p.safeNextAction && (
                  <Link href={p.safeNextAction.href} className="inline-flex items-center gap-1.5 mt-3 text-[11px] text-zinc-300 hover:text-white transition-colors group-hover:translate-x-0.5">
                    {p.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 14 surfaces, grouped by operator meaning */}
      <div className="space-y-10 mb-8">
        {CATEGORIES.map((cat) => {
          const items = cat.ids.map((id) => surfacesById.get(id)).filter((x): x is Surface => Boolean(x));
          if (items.length === 0) return null;
          return (
            <section key={cat.title}>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">{cat.eyebrow}</p>
                  <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">{cat.title}</h2>
                </div>
                <span className="text-[11px] text-zinc-500 font-mono">{items.length} surfaces</span>
              </div>
              <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((s) => (
                  <SurfaceCard key={s.id} surface={s} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Uncategorized fallback — keeps the page honest if the canonical
            taxonomy adds a surface the local CATEGORIES list hasn't been
            updated for yet. */}
        {uncategorizedIds.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// other surfaces</p>
                <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">Newly added</h2>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">{uncategorizedIds.length} surfaces</span>
            </div>
            <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {uncategorizedIds.map((id) => {
                const s = surfacesById.get(id);
                if (!s) return null;
                return <SurfaceCard key={s.id} surface={s} />;
              })}
            </div>
          </section>
        )}
      </div>

      {/* Product-level limitations + safety contract */}
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 mb-8 relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-80 pointer-events-none"
          style={{
            background:
              "radial-gradient(500px 200px at 90% 0%, rgba(16,185,129,0.08), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="grid md:grid-cols-[1fr_auto] items-start gap-6">
          <div>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// product limitations</p>
            <ul className="space-y-1.5">
              {model.productLimitations.map((l, i) => (
                <li key={i} className="text-[13px] text-zinc-300 leading-relaxed flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-emerald-500/[0.22] bg-emerald-500/[0.04] px-4 py-3 min-w-[14rem]">
            <p className="text-[10px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// safety contract</p>
            <p className="text-[13px] text-emerald-200 font-semibold leading-snug">
              {model.safetyContract.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable surface card — premium hover, refined typography, honest hierarchy
// ---------------------------------------------------------------------------

function SurfaceCard({ surface }: { surface: Surface }) {
  const tone = STATUS_TONE[surface.status] ?? STATUS_TONE.preview;
  const Icon = SURFACE_ICON[surface.id] ?? CloudIcon;
  return (
    <div className={`group rounded-2xl border ${tone.border} ${tone.bg} ${tone.hoverBorder} p-5 flex flex-col transition-all hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-lg border ${tone.border} ${tone.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-4.5 w-4.5 ${tone.text}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-white truncate tracking-tight">{surface.label}</h3>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">{surface.sourceMode.replace(/_/g, " ")}</p>
          </div>
        </div>
        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${tone.pillBg} ${tone.pillText} shrink-0`}>
          {surface.status.replace(/_/g, " ")}
        </span>
      </div>

      <p className="text-[12.5px] text-zinc-400 leading-relaxed mb-3">{surface.role}</p>

      <p className="text-[11px] text-zinc-500 font-mono mb-3 leading-snug line-clamp-2">{surface.evidence}</p>

      {surface.limitations.length > 0 && (
        <div className="mb-2 rounded-lg border border-amber-500/[0.12] bg-amber-500/[0.03] px-2.5 py-2">
          <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider mb-1">// limitations</p>
          <ul className="space-y-0.5">
            {surface.limitations.slice(0, 2).map((l, i) => (
              <li key={i} className="text-[11px] text-zinc-400 leading-snug">{l}</li>
            ))}
          </ul>
        </div>
      )}

      {surface.blockers.length > 0 && (
        <div className="mb-2 rounded-lg border border-rose-500/[0.18] bg-rose-500/[0.04] px-2.5 py-2">
          <p className="text-[10px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// blockers</p>
          <ul className="space-y-0.5">
            {surface.blockers.slice(0, 2).map((l, i) => (
              <li key={i} className="text-[11px] text-rose-200/80 leading-snug">{l}</li>
            ))}
          </ul>
        </div>
      )}

      {surface.safeNextAction && (
        <Link
          href={surface.safeNextAction.href}
          className="mt-auto pt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white transition-colors"
        >
          {surface.safeNextAction.label}
          <ArrowRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function RibbonStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-right min-w-[4.5rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}
