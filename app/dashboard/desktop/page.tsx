"use client";

/**
 * /dashboard/desktop
 *
 * Operator-facing desktop runtime status page. Consumes
 * /api/desktop/platform-status for canonical DesktopState and renders:
 *
 *   - session status (paired / expired / not_paired)
 *   - source mode pill
 *   - per-platform packaging (macOS arm/intel, Windows, Linux) with
 *     real signed/notarized/publiclyDownloadable + blocker
 *   - handoff inbox count + review item count
 *   - audit sync status
 *   - localExecutionStatus literal = "disabled" (TS-enforced)
 *   - product limitations
 *   - safeNextAction
 *
 * Closes the sidebar gap where Desktop nav only linked to /download.
 * Read-only. No fake binaries.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

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
  tenantId: string;
  generatedAt: string;
  platform: string;
  appVersion?: string;
  sessionStatus: "active" | "expired" | "not_paired";
  sourceMode: "live" | "partial_live" | "preview" | "blocked" | "unknown";
  handoffInboxCount: number;
  reviewItemCount: number;
  platformStatus: PlatformStatusEntry[];
  auditSyncStatus: "live" | "preview" | "disabled";
  syncStatus: "synced" | "stale" | "not_synced";
  localExecutionStatus: "disabled";
  limitations: string[];
  safeNextAction?: { label: string; href: string };
}

const PLATFORM_LABEL: Record<string, string> = {
  "macos-arm":   "macOS · Apple Silicon",
  "macos-intel": "macOS · Intel",
  windows:       "Windows",
  linux:         "Linux",
};

const SOURCE_PILL: Record<string, string> = {
  live:         "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  partial_live: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  preview:      "bg-amber-500/15 text-amber-300 border-amber-500/30",
  blocked:      "bg-rose-500/15 text-rose-300 border-rose-500/30",
  unknown:      "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

export default function DesktopDashboardPage() {
  const [state, setState] = useState<DesktopStateLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/desktop/platform-status", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: DesktopStateLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
        else setError(json.error?.userMessage ?? "Desktop state unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const sourceMode = state?.sourceMode ?? "preview";

  return (
    <div className="relative">
      {/* Hero */}
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(139,92,246,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ComputerDesktopIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Desktop runtime · {sourceMode.replace(/_/g, " ")}
            </span>
          </span>
          {state?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(state.generatedAt).toLocaleTimeString()}</span>
          )}
          <Link href="/download" className="text-[10px] text-zinc-500 hover:text-white transition-colors ml-auto">Open download page →</Link>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Desktop <span className="text-gradient">review workstation.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          The desktop is a review workstation, not an executor. <span className="text-zinc-500">Local execution is disabled by safety contract. Cloud + GitHub mutations require approval and remain web-side.</span>
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing desktop state…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// state unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && state && (
        <>
          {/* Session + sync rollup */}
          <section className="mb-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <RollupCard
              label="Session"
              value={
                state.sessionStatus === "active" ? "Paired" :
                state.sessionStatus === "expired" ? "Expired" :
                "Not paired"
              }
              detail={state.sessionStatus === "active" ? `${state.platform} · v${state.appVersion ?? "—"}` : "Pair from desktop Settings"}
              tone={state.sessionStatus === "active" ? "emerald" : state.sessionStatus === "expired" ? "amber" : "zinc"}
            />
            <RollupCard
              label="Handoff inbox"
              value={String(state.handoffInboxCount)}
              detail={state.handoffInboxCount === 0 ? "Queue empty" : "Pending review"}
              tone={state.handoffInboxCount > 0 ? "amber" : "zinc"}
            />
            <RollupCard
              label="Review items"
              value={String(state.reviewItemCount)}
              detail={state.reviewItemCount === 0 ? "None waiting" : "Open in desktop"}
              tone={state.reviewItemCount > 0 ? "cyan" : "zinc"}
            />
            <RollupCard
              label="Audit sync"
              value={state.auditSyncStatus}
              detail={state.auditSyncStatus === "live" ? "Persistent" : "In-memory"}
              tone={state.auditSyncStatus === "live" ? "emerald" : "amber"}
            />
          </section>

          {/* Local exec literal — TS-enforced */}
          <section className="mb-8 rounded-2xl border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-5 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// safety contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug mb-1">
                localExecutionStatus = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{state.localExecutionStatus}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed">
                The TypeScript literal type prevents drift. No Terraform apply, no CLI apply, no cloud mutation, no GitHub mutation can be wired without rewriting the DesktopState contract.
              </p>
            </div>
          </section>

          {/* Per-platform packaging */}
          <section className="mb-8">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// packaging</p>
                <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">macOS · Windows · Linux</h2>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">{state.platformStatus.length} platforms</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {state.platformStatus.map((p) => {
                const ok = p.publiclyDownloadable;
                const partial = p.signed && !p.publiclyDownloadable;
                const cardTone = ok
                  ? "border-emerald-500/[0.22] bg-emerald-500/[0.04]"
                  : partial
                    ? "border-cyan-500/[0.22] bg-cyan-500/[0.04]"
                    : "border-zinc-700/30 bg-white/[0.02]";
                return (
                  <div key={p.platform} className={`rounded-2xl border ${cardTone} p-4 transition-colors hover:-translate-y-0.5`}>
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
                    <p className={`text-sm font-semibold ${ok || partial ? "text-white" : "text-zinc-300"} mb-0.5 tracking-tight`}>{PLATFORM_LABEL[p.platform] ?? p.platform}</p>
                    <p className="text-[11px] text-zinc-500 mb-3 leading-snug">{p.label}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <BadgeFlag label={p.signed ? "signed" : "unsigned"} good={p.signed} />
                      {p.notarized !== undefined && (
                        <BadgeFlag label={p.notarized ? "notarized" : "not-notarized"} good={p.notarized} />
                      )}
                      <BadgeFlag
                        label={p.publiclyDownloadable ? "public download" : "local build only"}
                        good={p.publiclyDownloadable}
                        amberIfBad
                      />
                    </div>
                    {p.blocker && (
                      <p className="text-[11px] text-zinc-500 mt-2 leading-snug">{p.blocker}</p>
                    )}
                    {p.safeNextAction && (
                      <Link
                        href={p.safeNextAction.href}
                        className="inline-flex items-center gap-1.5 mt-3 text-[11px] text-zinc-300 hover:text-white transition-colors"
                      >
                        {p.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Limitations */}
          {state.limitations.length > 0 && (
            <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">// limitations</p>
              <ul className="space-y-1">
                {state.limitations.map((l, i) => (
                  <li key={i} className="text-[12px] text-zinc-400 leading-relaxed flex items-start gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Safe next action */}
          {state.safeNextAction && (
            <section className="mb-8 flex items-center justify-between rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-5 gap-3">
              <div>
                <p className="text-[11px] font-mono text-violet-300/80 uppercase tracking-[0.18em] mb-1">// next safe step</p>
                <p className="text-[13px] text-white font-semibold">{state.safeNextAction.label}</p>
              </div>
              <Link
                href={state.safeNextAction.href}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-200 hover:text-white border border-violet-500/30 hover:border-violet-500/50 bg-violet-500/[0.06] rounded-md px-3 py-1.5 transition-colors"
              >
                Open <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RollupCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "emerald" | "amber" | "cyan" | "zinc" }) {
  const toneClasses: Record<string, { border: string; bg: string; text: string }> = {
    emerald: { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300" },
    amber:   { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300"   },
    cyan:    { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300"    },
    zinc:    { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-300"    },
  };
  const t = toneClasses[tone];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-4`}>
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold tracking-tight ${t.text} capitalize mb-0.5`}>{value}</p>
      <p className="text-[11px] text-zinc-500 leading-snug">{detail}</p>
    </div>
  );
}

function BadgeFlag({ label, good, amberIfBad }: { label: string; good: boolean; amberIfBad?: boolean }) {
  const cls = good
    ? "bg-emerald-500/15 text-emerald-300"
    : amberIfBad
      ? "bg-amber-500/15 text-amber-300"
      : "bg-zinc-700/40 text-zinc-400";
  const Icon = good ? CheckCircleIcon : XCircleIcon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${cls}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}
