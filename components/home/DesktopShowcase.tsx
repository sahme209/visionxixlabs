/**
 * Cinematic Huly-style desktop product showcase.
 *
 * Rendered on the homepage right under the hero. Shows a styled rendering
 * of the Tauri desktop app (sidebar + dashboard) with a beam-of-light
 * backdrop, then a 4-feature row below it.
 */

import Link from "next/link";
import {
  ArrowDownTrayIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export function DesktopShowcase() {
  return (
    <section className="relative py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* ── Aurora backdrop ─ refined coral × violet × cyan drift ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {/* Single hairline beam descending from the top — Apple keynote feel */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-[36%] bg-gradient-to-b from-transparent via-brand-coral/50 to-transparent" />
        <div className="ambient-drift absolute top-0 left-1/2 -translate-x-1/2 w-[680px] h-[420px] rounded-full bg-brand-violet/[0.10] blur-[130px]" />
        <div className="ambient-drift absolute top-[20%] left-1/2 -translate-x-1/2 w-[820px] h-[420px] rounded-full bg-brand-coral/[0.08] blur-[140px]" style={{ animationDelay: "-8s" }} />
        <div className="ambient-drift absolute top-[10%] right-0 w-[460px] h-[440px] rounded-full bg-cyan-500/[0.05] blur-[120px]" style={{ animationDelay: "-14s" }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* ── Heading — Apple keynote style ─────────────────────── */}
        <div className="text-center mb-16">
          <p className="mono-label inline-flex items-center gap-3 mb-5">
            <span className="text-brand-coral/90 tabular-nums">DT</span>
            <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
            Axiom Desktop
          </p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.04] mb-5">
            One operating system
            <br />
            <span className="relative inline-block">
              for every cloud.
              <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
            </span>
          </h2>
          <p className="text-base md:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Axiom Agent on your workstation — AWS, Azure, GCP, GitHub, security scanner, remediation,
            simulation, approvals and audit, all on one local control plane.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/download"
              className="btn-press inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold tracking-tight"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download desktop app
            </Link>
            <Link
              href="/demo"
              className="btn-ghost-press inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium tracking-tight"
            >
              Explore demo <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* ── Stylized product render — surface-frost with restrained coral halo ─ */}
        <div className="relative">
          {/* Soft coral halo replacing the loud violet/fuchsia/cyan rainbow */}
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-coral/15 via-brand-violet/10 to-transparent blur-3xl opacity-70" />

          <div className="surface-frost relative rounded-2xl overflow-hidden shadow-huly-coral-glow">
            {/* macOS window chrome */}
            <div className="h-9 flex items-center px-3 bg-axiom-bg-elev/60 border-b border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              </div>
              <div className="flex-1 text-center text-[10px] font-mono text-zinc-600">
                Axiom Agent · v0.1.5 · workspace · visionxixlabs
              </div>
            </div>

            {/* Body — sidebar + content layout */}
            <div className="flex h-[420px]">
              {/* Sidebar */}
              <aside className="w-52 bg-[#0c0c10] border-r border-white/[0.05] flex flex-col">
                <div className="h-12 flex items-center px-4 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold text-white">A</div>
                    <span className="text-[12px] font-semibold text-white">Axiom Agent</span>
                  </div>
                </div>
                <div className="flex-1 p-2.5 text-[11px] space-y-4 overflow-hidden">
                  <SidebarSection label="Operations" items={[
                    { label: "Dashboard", active: true },
                    { label: "Multi-cloud" },
                  ]} />
                  <SidebarSection label="Workflow" items={[
                    { label: "Remediation" },
                    { label: "Simulations" },
                    { label: "Orchestration" },
                    { label: "Handoffs" },
                  ]} />
                  <SidebarSection label="Operating" items={[
                    { label: "Security" },
                    { label: "Connectors" },
                    { label: "Settings" },
                  ]} />
                </div>
                <div className="px-3 py-2.5 border-t border-white/[0.04]">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                    connected
                  </div>
                </div>
              </aside>

              {/* Content */}
              <main className="flex-1 overflow-hidden relative">
                {/* Top bar */}
                <div className="h-12 px-5 flex items-center justify-between border-b border-white/[0.05] bg-[#0a0a0e]/60">
                  <div>
                    <p className="text-[12px] font-semibold text-white leading-tight">Dashboard</p>
                    <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.18em]">Control plane snapshot</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-violet-500/25 bg-violet-500/[0.05] text-[10px] font-mono text-violet-300">
                      <span className="w-1 h-1 rounded-full bg-violet-400" />
                      visionxixlabs
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/[0.05] text-[10px] font-mono text-emerald-300">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      live
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                  {/* KPI strip */}
                  <div className="grid grid-cols-4 gap-2.5">
                    <Kpi label="Resources"      value="247"  tone="text-violet-300" />
                    <Kpi label="Providers live" value="3/3"  tone="text-emerald-300" />
                    <Kpi label="Risks"          value="12"   tone="text-rose-300" />
                    <Kpi label="Next actions"   value="9"    tone="text-cyan-300" />
                  </div>

                  {/* Posture rail */}
                  <div className="grid grid-cols-4 gap-2.5">
                    <PostureTile label="Security"    score={82} status="healthy" />
                    <PostureTile label="Reliability" score={71} status="warning" />
                    <PostureTile label="ReleaseOps"  score={88} status="healthy" />
                    <PostureTile label="Validation"  score={95} status="healthy" />
                  </div>

                  {/* Provider row */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <ProviderCard provider="AWS"   tone="amber"   resources={142} />
                    <ProviderCard provider="Azure" tone="cyan"    resources={67}  />
                    <ProviderCard provider="GCP"   tone="emerald" resources={38}  />
                  </div>
                </div>

                {/* Aurora wash */}
                <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-violet-500/[0.08] blur-[120px] pointer-events-none" aria-hidden />
              </main>
            </div>
          </div>
        </div>

        {/* ── 4-feature row below the render ───────────────────────── */}
        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureTile
            Icon={CpuChipIcon}
            title="Control plane projection"
            detail="Every web API surfaced locally — providers, security, releases, audit, validation."
          />
          <FeatureTile
            Icon={ShieldCheckIcon}
            title="Governed remediation"
            detail="Terraform + CLI + rollback + verification rendered locally. Apply stays approval-gated."
          />
          <FeatureTile
            Icon={CommandLineIcon}
            title="Signed + reproducible"
            detail="macOS notarized · all binaries GPG-signed · published from a public CI pipeline."
          />
          <FeatureTile
            Icon={ArrowDownTrayIcon}
            title="One install, three platforms"
            detail="macOS · Windows · Linux. AppImage / .deb / .rpm / .dmg / .msi all from one tag."
          />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SidebarSection({ label, items }: { label: string; items: { label: string; active?: boolean }[] }) {
  return (
    <div>
      <p className="px-2 mb-1 text-[8px] font-mono text-zinc-600 uppercase tracking-[0.22em]">{label}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <div
            key={item.label}
            className={`px-2 py-1 rounded-md text-[11px] ${
              item.active
                ? "bg-gradient-to-r from-violet-500/15 to-transparent border border-violet-500/20 text-white"
                : "text-zinc-500"
            }`}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-[0.18em]">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function PostureTile({ label, score, status }: { label: string; score: number; status: "healthy" | "warning" | "degraded" }) {
  const tone =
    status === "healthy"  ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" :
    status === "warning"  ? "text-amber-300 bg-amber-500/10 border-amber-500/25" :
    "text-rose-300 bg-rose-500/10 border-rose-500/25";
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-[0.18em]">{label}</p>
        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${tone}`}>{status}</span>
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{score}<span className="text-[10px] text-zinc-500">/100</span></p>
    </div>
  );
}

function ProviderCard({ provider, tone, resources }: { provider: string; tone: "amber" | "cyan" | "emerald"; resources: number }) {
  const bg =
    tone === "amber"   ? "from-amber-500/15 to-amber-500/[0.02] border-amber-500/20" :
    tone === "cyan"    ? "from-cyan-500/15 to-cyan-500/[0.02] border-cyan-500/20" :
    "from-emerald-500/15 to-emerald-500/[0.02] border-emerald-500/20";
  return (
    <div className={`rounded-lg border bg-gradient-to-br ${bg} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-white tracking-tight">{provider}</p>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">connected</span>
      </div>
      <p className="text-[10px] font-mono text-zinc-500">resources</p>
      <p className="text-base font-bold text-white tabular-nums">{resources}</p>
    </div>
  );
}

function FeatureTile({ Icon, title, detail }: { Icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div className="group surface-glass rounded-2xl p-5 hover:border-brand-coral/30 transition-all relative overflow-hidden">
      <div aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-violet-500/20 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="inline-flex w-9 h-9 rounded-lg items-center justify-center mb-3 border border-violet-500/25 bg-violet-500/10">
          <Icon className="h-4 w-4 text-violet-300" />
        </div>
        <p className="text-sm font-semibold text-white tracking-tight mb-1.5">{title}</p>
        <p className="text-[12px] text-zinc-500 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}
