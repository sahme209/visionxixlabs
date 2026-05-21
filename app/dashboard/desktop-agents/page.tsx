/**
 * /dashboard/desktop-agents — desktop agent bridge.
 *
 * Registered desktop devices (macOS / Windows / Linux), their local
 * capabilities, sync state, pending and completed tasks, and the
 * locally installed AI models. Differs from /dashboard/desktop (which
 * is the desktop runtime cockpit) by focusing on the FLEET of devices
 * the platform talks to, not a single host.
 *
 * Reads from lib/platform/platformSeedData.ts today. When the
 * DesktopSessionRecord + DesktopHandoffRecord rows already in Prisma
 * are surfaced through a real service, swap the read in this file —
 * consumers are typed against the shared shape.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  ComputerDesktopIcon,
  CommandLineIcon,
  ArrowDownTrayIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import {
  DEMO_DESKTOP_AGENTS,
  type DesktopOS,
} from "@/lib/platform/platformSeedData";
import { DemoBadge } from "@/components/platform/DemoBadge";
import { PlatformHero } from "@/components/platform/PlatformHero";
import { getTenantFreshness } from "@/lib/platform/tenantFreshness";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";

export const metadata: Metadata = {
  title: "Desktop agents · Axiom",
  description:
    "Registered macOS / Windows / Linux desktop agents, their local capabilities, sync state, pending tasks, and installed local models.",
};

const OS_LABEL: Record<DesktopOS, string> = {
  macos:   "macOS",
  windows: "Windows",
  linux:   "Linux",
};

const STATUS_TONE: Record<"online" | "stale" | "paused", { tone: string; label: string }> = {
  online: { tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", label: "Online" },
  stale:  { tone: "border-amber-500/30   bg-amber-500/10   text-amber-300",   label: "Stale" },
  paused: { tone: "border-zinc-500/30    bg-zinc-500/10    text-zinc-400",    label: "Paused" },
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.floor((Date.now() - then) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function DesktopAgentsPage() {
  const freshness = await getTenantFreshness();
  const showSampleData = !freshness.freshTenant;
  const byOs: Record<DesktopOS, number> = { macos: 0, windows: 0, linux: 0 };
  for (const d of DEMO_DESKTOP_AGENTS) byOs[d.os] += 1;
  const totalPending = DEMO_DESKTOP_AGENTS.reduce((acc, d) => acc + d.pendingTasks, 0);
  const totalCompletedToday = DEMO_DESKTOP_AGENTS.reduce((acc, d) => acc + d.completedToday, 0);

  return (
    <div className="relative">
      <PlatformHero
        eyebrow="AI ops · desktop bridge"
        eyebrowTone="violet"
        title="Desktop agents"
        description="Devices running the Axiom desktop runtime. The desktop app is a separate companion that executes locally-scoped tasks (git, docker, kubectl, terraform, local AI models) only after a task handoff from this platform — never autonomously."
        gradientFromColor="radial-gradient(900px 320px at 14% 0%, rgba(124,58,237,0.12), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(217,70,239,0.08), transparent 60%)"
        right={
          <>
            {showSampleData && (
              <>
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 px-2.5 py-1 text-[11px] font-mono">
                  {DEMO_DESKTOP_AGENTS.length} devices
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 text-[11px] font-mono">
                  {totalCompletedToday} tasks today
                </span>
                <DemoBadge />
              </>
            )}
          </>
        }
      />

      {!showSampleData && (
        <div className="mb-6">
          <TenantEmptyState
            icon={ComputerDesktopIcon}
            tone="violet"
            eyebrow="No desktop devices yet"
            title="Pair your first machine to extend AGI to local execution."
            description="Install the Axiom desktop app on macOS, Windows, or Linux. Once paired, it executes only the tasks your workspace hands off — git, docker, kubectl, terraform, local model inference — with an on-device approval for risky actions."
            agiNote="The desktop runtime never runs anything autonomously. Every local action is staged, scoped, time-boxed, and logged to both the local and cloud audit trail."
            actions={[
              { href: "/download", label: "Download desktop app", variant: "primary" },
              { href: "/dashboard/desktop", label: "Read the safety contract", variant: "ghost" },
            ]}
          />
        </div>
      )}

      {/* Stat strip */}
      {showSampleData && (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="macOS"           value={byOs.macos} />
        <Stat label="Windows"         value={byOs.windows} />
        <Stat label="Linux"           value={byOs.linux} />
        <Stat label="Pending tasks"   value={totalPending} />
        <Stat label="Completed today" value={totalCompletedToday} />
      </div>
      )}

      {/* Device fleet */}
      {showSampleData && (
      <section className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:p-5 mb-6">
        <header className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-[13px] font-semibold text-zinc-200 flex items-center gap-2">
            Fleet
            <DemoBadge />
          </h2>
          <Link
            href="/download"
            className="inline-flex items-center gap-1.5 text-[11.5px] text-violet-300 hover:text-violet-200 transition"
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
            Download app
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEMO_DESKTOP_AGENTS.map((d) => {
            const status = STATUS_TONE[d.status];
            return (
              <article
                key={d.id}
                className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 hover:border-violet-500/30 hover:bg-white/[0.035] transition"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2">
                      <ComputerDesktopIcon className="h-4 w-4 text-violet-300" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate">{d.hostname}</p>
                      <p className="mt-0.5 text-[10.5px] font-mono text-zinc-500 truncate">
                        {OS_LABEL[d.os]} · v{d.appVersion} · {d.userEmail}
                      </p>
                    </div>
                  </div>
                  <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap", status.tone].join(" ")}>
                    {status.label}
                  </span>
                </header>

                <p className="mt-2 text-[10.5px] font-mono text-zinc-500">
                  Last seen {formatRelative(d.lastSeenAt)}
                </p>

                <div className="mt-3">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1.5">
                    <CommandLineIcon className="h-3 w-3" />
                    Local capabilities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {d.localCapabilities.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10.5px] font-mono text-zinc-300"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {d.installedModels.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">
                      Installed models
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {d.installedModels.map((m) => (
                        <Link
                          key={m}
                          href="/dashboard/models"
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-0.5 text-[10.5px] font-mono hover:bg-emerald-500/15 transition"
                        >
                          {m}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <footer className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] py-2">
                    <p className="text-[9.5px] font-mono text-zinc-500 uppercase tracking-widest">Pending</p>
                    <p className="mt-0.5 text-[14px] font-semibold text-white tabular-nums">{d.pendingTasks}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] py-2">
                    <p className="text-[9.5px] font-mono text-zinc-500 uppercase tracking-widest">Today</p>
                    <p className="mt-0.5 text-[14px] font-semibold text-white tabular-nums">{d.completedToday}</p>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      </section>
      )}

      {/* Safety rail */}
      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <h2 className="text-[13px] font-semibold text-emerald-100">Desktop runtime safety contract</h2>
        </header>
        <ul className="text-[12.5px] text-emerald-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-emerald-400/80">
          <li>The desktop app never executes a task that wasn't handed off from the web platform.</li>
          <li>Every handoff carries a risk level, scope, and approval state — local execution refuses anything missing those.</li>
          <li>Risky actions (file delete, git push, terraform apply, network mutation) require a local approval on the device.</li>
          <li>Every local execution writes a row to the local audit log; the web platform replicates the row on reconnect.</li>
          <li>Local AI models are gated by the Model Registry — a model rejected on the registry cannot be invoked locally.</li>
        </ul>
        <div className="mt-4 flex items-center gap-2">
          <Link
            href="/dashboard/desktop"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-200 hover:bg-emerald-500/15 transition"
          >
            Desktop runtime cockpit
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <Link
            href="/dashboard/automation"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            Automation engine
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </section>

    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-[20px] font-semibold text-white tabular-nums">{value}</p>
      {sub ? <p className="text-[10.5px] text-zinc-500 mt-0.5">{sub}</p> : null}
    </div>
  );
}
