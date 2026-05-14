"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CloudIcon,
  CodeBracketIcon,
  CommandLineIcon,
  CubeTransparentIcon,
  DocumentCheckIcon,
  PuzzlePieceIcon,
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import {
  CONNECTOR_REGISTRY,
  categorySummary,
  type ConnectorCategory,
  type ConnectorRecord,
  type ConnectorStatus,
} from "@/lib/connectors/connectorRegistry";

const CATEGORY_LABEL: Record<ConnectorCategory, string> = {
  cloud: "Cloud providers",
  repository: "Repositories",
  ci_cd: "CI/CD",
  iac: "Infrastructure as Code",
  ticketing: "Ticketing & change",
  incident: "Incident management",
  messaging: "Messaging",
  desktop: "Desktop runtime",
  audit: "Audit & export",
  identity: "Identity",
};

const CATEGORY_ICON: Record<ConnectorCategory, typeof CloudIcon> = {
  cloud: CloudIcon,
  repository: CodeBracketIcon,
  ci_cd: CommandLineIcon,
  iac: CubeTransparentIcon,
  ticketing: PuzzlePieceIcon,
  incident: CpuChipIcon,
  messaging: ChatBubbleLeftRightIcon,
  desktop: CommandLineIcon,
  audit: DocumentCheckIcon,
  identity: ShieldCheckIcon,
};

const STATUS_COLOR: Record<ConnectorStatus, { text: string; bg: string; label: string }> = {
  live:        { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Live" },
  preview:     { text: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20",   label: "Preview" },
  expanding:   { text: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       label: "Expanding" },
  planned:     { text: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",     label: "Planned" },
  unavailable: { text: "text-zinc-500",    bg: "bg-white/[0.04] border-white/[0.08]",     label: "Unavailable" },
};

type FilterKind = "all" | ConnectorStatus;

export default function IntegrationsPage() {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [selected, setSelected] = useState<string | null>(CONNECTOR_REGISTRY[0]?.id ?? null);

  const filtered = filter === "all" ? CONNECTOR_REGISTRY : CONNECTOR_REGISTRY.filter((c) => c.status === filter);
  const active = filtered.find((c) => c.id === selected) ?? filtered[0];
  const summary = categorySummary();
  const liveCount = CONNECTOR_REGISTRY.filter((c) => c.status === "live").length;
  const previewCount = CONNECTOR_REGISTRY.filter((c) => c.status === "preview").length;
  const plannedCount = CONNECTOR_REGISTRY.filter((c) => c.status === "planned" || c.status === "expanding").length;

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <PuzzlePieceIcon className="h-4 w-4 text-violet-400" />
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">
              Integrations · Operational nervous system
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Connectors & <span className="text-gradient">Integrations.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            Axiom coordinates above the systems you already run. <span className="dim-1">Every connector is registered, lifecycle-tracked, and security-profiled — nothing is hardcoded in the UI.</span>
          </p>
        </div>
      </Reveal>

      {/* KPI strip */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Live connectors", value: liveCount, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircleIcon },
          { label: "Preview", value: previewCount, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", icon: CpuChipIcon },
          { label: "Planned / expanding", value: plannedCount, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: ClockIcon },
          { label: "Total registry", value: CONNECTOR_REGISTRY.length, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: PuzzlePieceIcon },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`w-9 h-9 rounded-lg ${kpi.bg} border flex items-center justify-center mb-3`}>
                <Icon className={`h-4.5 w-4.5 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Filter pills */}
      <Reveal direction="up" delay={0.08}>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-2">Filter:</span>
          {(["all", "live", "preview", "expanding", "planned"] as FilterKind[]).map((id) => {
            const isActive = filter === id;
            const label = id === "all" ? "All connectors" : STATUS_COLOR[id as ConnectorStatus]?.label ?? id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isActive
                    ? "bg-violet-500/15 border-violet-500/30 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Reveal>

      {/* Two-pane: list on left, detail on right */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Category-grouped list */}
        <div className="lg:col-span-2">
          <Reveal direction="up" delay={0.1}>
            <div className="space-y-3">
              {(Object.keys(CATEGORY_LABEL) as ConnectorCategory[]).map((cat) => {
                const connectors = filtered.filter((c) => c.category === cat);
                if (connectors.length === 0) return null;
                const Icon = CATEGORY_ICON[cat];
                const sum = summary[cat];
                return (
                  <div key={cat} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-violet-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">{CATEGORY_LABEL[cat]}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">{sum.live + sum.preview} live · {sum.planned} planned</span>
                    </div>
                    <div className="p-2 space-y-1">
                      {connectors.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelected(c.id)}
                          className={`w-full text-left rounded-xl border p-3 transition-all ${
                            c.id === active?.id
                              ? "border-violet-500/30 bg-violet-500/[0.06]"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold text-white">{c.name}</p>
                            <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${STATUS_COLOR[c.status].bg} ${STATUS_COLOR[c.status].text}`}>
                              {STATUS_COLOR[c.status].label}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-snug">{c.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          <Reveal direction="up" delay={0.14}>
            {active ? <ConnectorDetailPanel connector={active} /> : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
                <p className="text-sm text-zinc-500">Select a connector to see its full profile.</p>
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function ConnectorDetailPanel({ connector }: { connector: ConnectorRecord }) {
  const status = STATUS_COLOR[connector.status];
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">{connector.id}</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${connector.riskLevel === "low" ? "text-emerald-400" : connector.riskLevel === "medium" ? "text-amber-400" : "text-red-400"}`}>
              {connector.riskLevel} risk
            </span>
          </div>
          {connector.eta && (
            <span className="text-[10px] text-zinc-500 font-mono">ETA: {connector.eta}</span>
          )}
        </div>
        <h3 className="text-xl font-bold text-white tracking-[-0.02em] mb-1">{connector.name}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{connector.description}</p>
      </div>

      {/* Auth + setup */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-2">Auth model</p>
        <p className="text-sm text-zinc-300 mb-3 font-mono">{connector.authModel}</p>
        <div className="flex flex-wrap gap-1">
          {connector.permissions.map((p) => (
            <span key={p} className="text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5 font-mono">{p}</span>
          ))}
        </div>
      </div>

      {/* Reads / does not read */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 p-4">
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-2">What Axiom reads</p>
            <ul className="text-xs text-zinc-300 space-y-1">
              {connector.reads.map((r) => <li key={r} className="leading-snug">· {r}</li>)}
            </ul>
          </div>
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">What Axiom does NOT read</p>
            <ul className="text-xs text-zinc-400 space-y-1">
              {connector.doesNotRead.map((r) => <li key={r} className="leading-snug">· {r}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Capabilities + events */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Actions</p>
            <div className="flex flex-wrap gap-1">
              {connector.supportedActions.map((a) => (
                <span key={a} className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5 font-mono">{a}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Events emitted</p>
            <div className="flex flex-wrap gap-1">
              {connector.supportedEvents.map((e) => (
                <span key={e} className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5 font-mono">{e}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Limitations + roadmap */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-2">Current limitations</p>
            <ul className="text-xs text-zinc-400 space-y-1">
              {connector.limitations.length === 0
                ? <li className="text-zinc-600">No documented limitations.</li>
                : connector.limitations.map((l) => <li key={l} className="leading-snug">· {l}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-2">Next milestones</p>
            <ul className="text-xs text-zinc-400 space-y-1">
              {connector.nextMilestones.length === 0
                ? <li className="text-zinc-600">No documented next milestones.</li>
                : connector.nextMilestones.map((m) => <li key={m} className="leading-snug">· {m}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Trust notes */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-emerald-500/[0.02]">
        <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-2">Enterprise trust</p>
        <ul className="text-xs text-zinc-300 space-y-1">
          {connector.enterpriseTrustNotes.map((n) => (
            <li key={n} className="flex items-start gap-2 leading-snug">
              <CheckCircleIcon className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-x-3 gap-y-1 text-[11px] flex-wrap">
          {connector.docsRoute && (
            <Link href={connector.docsRoute} target="_blank" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
              Setup guide →
            </Link>
          )}
          {connector.dashboardRoute && connector.status !== "planned" && (
            <Link href={connector.dashboardRoute} className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
              Open dashboard →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {connector.setupRoute && connector.status !== "planned" ? (
            <Link
              href={connector.setupRoute}
              className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider"
            >
              Start setup
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full border border-white/[0.1] text-zinc-500 text-xs font-semibold uppercase tracking-wider">
              {connector.status === "planned" ? "Coming soon" : "Not yet available"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
