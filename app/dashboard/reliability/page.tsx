"use client";

import Link from "next/link";
import {
  BoltIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  SignalIcon,
  ServerStackIcon,
  ArrowRightIcon,
  CpuChipIcon,
  ClockIcon,
  InboxStackIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { buildReliabilityPosture } from "@/lib/reliability/reliabilityPosture";
import type { ReliabilityCheck, ReliabilitySemantic } from "@/lib/reliability/reliabilityPosture";
import type { ComponentHealth } from "@/lib/reliability/systemHealth";
import { displayFor as healthDisplay, COMPONENT_LABEL } from "@/lib/reliability/systemHealth";
import type { CircuitSnapshot } from "@/lib/reliability/circuitBreaker";
import type { DeadLetterRecord } from "@/lib/reliability/deadLetter";
import type { WorkflowDiagnosis } from "@/lib/reliability/workflowRecovery";
import { CATEGORY_LABEL } from "@/lib/reliability/failureClassifier";
import { id } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Honest preview inputs — typed shapes from the canonical modules. Source
// is "preview" so every surface labels itself honestly.
// ---------------------------------------------------------------------------

const SAMPLE_COMPONENTS: ComponentHealth[] = [
  { id: "web_app",             label: COMPONENT_LABEL.web_app,             status: "healthy",  lastCheckAt: iso(2), latencyMs: 38,  errorRate: 0.001 },
  { id: "database",            label: COMPONENT_LABEL.database,            status: "healthy",  lastCheckAt: iso(2), latencyMs: 12,  errorRate: 0 },
  { id: "auth",                label: COMPONENT_LABEL.auth,                status: "healthy",  lastCheckAt: iso(2), latencyMs: 24,  errorRate: 0 },
  { id: "connector.aws",       label: COMPONENT_LABEL["connector.aws"],    status: "healthy",  lastCheckAt: iso(5), latencyMs: 220, errorRate: 0.004 },
  { id: "connector.azure",     label: COMPONENT_LABEL["connector.azure"],  status: "degraded", lastCheckAt: iso(8), latencyMs: 540, errorRate: 0.04, userMessage: "Azure REST showing intermittent 503s.", safeNextAction: { label: "View circuit", href: "#circuits" } },
  { id: "connector.gcp",       label: COMPONENT_LABEL["connector.gcp"],    status: "unknown",  internalDetail: "No connector configured yet." },
  { id: "connector.github",    label: COMPONENT_LABEL["connector.github"], status: "healthy",  lastCheckAt: iso(3), latencyMs: 150, errorRate: 0.002 },
  { id: "terraform_generator", label: COMPONENT_LABEL.terraform_generator, status: "healthy",  lastCheckAt: iso(15), errorRate: 0 },
  { id: "copilot_llm",         label: COMPONENT_LABEL.copilot_llm,         status: "healthy",  lastCheckAt: iso(4), latencyMs: 820, errorRate: 0.005 },
  { id: "event_bus",           label: COMPONENT_LABEL.event_bus,           status: "healthy",  lastCheckAt: iso(1), errorRate: 0 },
  { id: "audit_log",           label: COMPONENT_LABEL.audit_log,           status: "healthy",  lastCheckAt: iso(1), errorRate: 0 },
  { id: "workflow_engine",     label: COMPONENT_LABEL.workflow_engine,     status: "healthy",  lastCheckAt: iso(2), errorRate: 0 },
  { id: "desktop_runtime",     label: COMPONENT_LABEL.desktop_runtime,     status: "unknown",  internalDetail: "No paired desktop." },
  { id: "notification_system", label: COMPONENT_LABEL.notification_system, status: "healthy",  lastCheckAt: iso(6), errorRate: 0 },
];

const SAMPLE_CIRCUITS: CircuitSnapshot[] = [
  { organizationId: id.organization("preview"), target: "azure.compute",    state: "open",      recentFailuresMs: [Date.now() - 30_000, Date.now() - 22_000, Date.now() - 8_000, Date.now() - 2_000], successesSinceOpen: 0, stateEnteredAtMs: Date.now() - 30_000, nextProbeAtMs: Date.now() + 18_000, lastFailureReason: "503 Service Unavailable" },
  { organizationId: id.organization("preview"), target: "github.api",       state: "half_open", recentFailuresMs: [Date.now() - 120_000], successesSinceOpen: 0, stateEnteredAtMs: Date.now() - 5_000 },
  { organizationId: id.organization("preview"), target: "copilot.llm",      state: "closed",    recentFailuresMs: [], successesSinceOpen: 42, stateEnteredAtMs: Date.now() - 2 * 60 * 60_000 },
];

const SAMPLE_DEADLETTERS: DeadLetterRecord[] = [
  {
    id: "dlq_preview_1",
    organizationId: id.organization("preview"),
    source: "job",
    originalRef: "job_preview_scan",
    category: "github_api_failure",
    reason: "GitHub returned 504 on repo enumeration after 4 retries.",
    payloadPreview: { org: "demo-org", repo: "[REDACTED]" },
    retryHistory: [{ at: iso(2), reason: "503", errorCode: "github.5xx" }, { at: iso(4), reason: "504", errorCode: "github.5xx" }],
    suggestedRecovery: "Re-run scan once GitHub status page clears.",
    correlationId: id.correlation("corr_preview_1"),
    createdAt: iso(10),
  },
];

const SAMPLE_DIAGNOSES: WorkflowDiagnosis[] = [
  {
    runId: "run_preview_drift",
    organizationId: "preview",
    workflowId: "wf.drift_detection",
    health: "stalled",
    reason: "Running but no progress for 18m.",
    action: { kind: "resume_from_last_safe_step", label: "Resume from last safe step", reason: "Step 2 produced output but step 3 hasn't started.", autoSafe: false, targetStepIndex: 2 },
  },
];

export default function ReliabilityCenterPage() {
  const posture = buildReliabilityPosture({
    source: "preview",
    components: SAMPLE_COMPONENTS,
    circuits: SAMPLE_CIRCUITS,
    deadLetters: SAMPLE_DEADLETTERS,
    fleet: { total: 12, healthy: 10, stalled: 1, stuck: 0, failed: 0, partial: 1, actionable: SAMPLE_DIAGNOSES },
    retryingJobs: 3,
    successfulRetries24h: 17,
    rateLimitPauses24h: 4,
  });

  const tone: Record<ReliabilitySemantic, string> = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    error:   "text-red-400",
    neutral: "text-zinc-400",
  };
  const bg: Record<ReliabilitySemantic, string> = {
    success: "bg-emerald-500/10 border-emerald-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
    error:   "bg-red-500/10 border-red-500/20",
    neutral: "bg-white/[0.04] border-white/[0.08]",
  };

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <BoltIcon className="h-4 w-4 text-cyan-400" />
            <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest">Reliability Center</p>
            <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
              {posture.source === "live" ? "Live" : posture.source === "preview" ? "Preview" : "Demo"}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Production <span className="text-gradient">control plane.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            How Axiom fails, how it recovers, and what's safe to retry — visible at a glance. <span className="dim-1">No silent failures, no opaque retries.</span>
          </p>
        </div>
      </Reveal>

      {/* KPI strip */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Reliability score",      value: `${Math.round(posture.score * 100)}%`, sub: posture.semantic === "success" ? "Healthy" : posture.semantic === "warning" ? "Action needed" : "Critical", icon: SignalIcon,           semantic: posture.semantic },
          { label: "Components healthy",     value: `${posture.health.counts.healthy}/${posture.health.components.length}`, sub: `${posture.health.counts.degraded} degraded · ${posture.health.counts.failing + posture.health.counts.unavailable} failing`, icon: ServerStackIcon, semantic: posture.health.overall === "healthy" ? "success" : posture.health.overall === "degraded" || posture.health.overall === "unknown" ? "warning" : "error" as ReliabilitySemantic },
          { label: "Circuits open",          value: String(posture.openCircuits.length), sub: posture.openCircuits.length === 0 ? "All closed" : `${posture.openCircuits.filter((c) => c.state === "half_open").length} probing`, icon: ArrowPathIcon, semantic: posture.openCircuits.length === 0 ? "success" : posture.openCircuits.length > 2 ? "error" : "warning" as ReliabilitySemantic },
          { label: "Dead-letter items",      value: String(posture.unresolvedDeadLetters.length), sub: posture.unresolvedDeadLetters.length === 0 ? "All clear" : "Awaiting review", icon: InboxStackIcon, semantic: posture.unresolvedDeadLetters.length === 0 ? "success" : posture.unresolvedDeadLetters.length > 10 ? "error" : "warning" as ReliabilitySemantic },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`w-9 h-9 rounded-lg ${bg[kpi.semantic]} border flex items-center justify-center mb-3`}>
                <Icon className={`h-4.5 w-4.5 ${tone[kpi.semantic]}`} />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{kpi.sub}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Posture checks */}
      <Reveal direction="up" delay={0.08}>
        <div className="mb-8 rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.03] via-transparent to-emerald-500/[0.02] p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/[0.06] blur-[60px] pointer-events-none" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest mb-1">Posture checks</p>
                <h2 className="text-lg font-bold text-white">Signals from the reliability layer.</h2>
              </div>
              <span className="text-[11px] text-zinc-500">Updated {timeAgo(posture.health.computedAt)}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {posture.checks.map((c) => (
                <PostureRow key={c.id} check={c} />
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* System health */}
      <Reveal direction="up" delay={0.12}>
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ServerStackIcon className="h-4 w-4 text-cyan-400" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">System health</p>
            </div>
            <p className="text-[11px] text-zinc-500">{posture.health.components.length} components</p>
          </div>
          <div className="p-3 grid sm:grid-cols-2 gap-2">
            {posture.health.components.map((c) => {
              const disp = healthDisplay(c.status);
              return (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {c.userMessage ?? c.internalDetail ?? `${c.latencyMs ?? "—"}ms · ${c.lastCheckAt ? timeAgo(c.lastCheckAt) : "no recent check"}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2 py-0.5 ml-3 shrink-0 ${
                    disp.semantic === "success" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                    disp.semantic === "warning" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                    disp.semantic === "error" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                    "text-zinc-400 bg-white/[0.04] border-white/[0.08]"
                  }`}>{disp.pill}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Circuit breakers */}
      <Reveal direction="up" delay={0.16}>
        <div id="circuits" className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ArrowPathIcon className="h-4 w-4 text-amber-400" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Circuit breakers</p>
            </div>
            <p className="text-[11px] text-zinc-500">{SAMPLE_CIRCUITS.length} integrations protected</p>
          </div>
          <div className="p-3 space-y-2">
            {SAMPLE_CIRCUITS.map((c) => {
              const semantic =
                c.state === "open" ? "error" :
                c.state === "half_open" ? "warning" :
                                          "success";
              return (
                <div key={c.target} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">{c.target}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${
                        semantic === "success" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                        semantic === "warning" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                        "text-red-400 bg-red-500/10 border-red-500/20"
                      }`}>{c.state.replace("_", " ")}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {c.state === "open" && c.nextProbeAtMs
                        ? `Next probe in ${Math.max(0, Math.round((c.nextProbeAtMs - Date.now()) / 1000))}s · last failure: ${c.lastFailureReason ?? "—"}`
                        : c.state === "half_open"
                          ? "Probing — one request will be allowed through."
                          : `Healthy · ${c.successesSinceOpen} successes in window`}
                    </p>
                  </div>
                  <span className="text-[10px] text-zinc-500 ml-3 shrink-0 font-mono">{c.recentFailuresMs.length} fail/win</span>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Stuck workflows */}
      <Reveal direction="up" delay={0.2}>
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-violet-400" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Workflows needing attention</p>
            </div>
            <Link href="/dashboard/workflows" className="text-[11px] font-semibold text-violet-300 hover:text-violet-200">View all <ArrowRightIcon className="inline h-3 w-3 ml-0.5 -mt-0.5" /></Link>
          </div>
          <div className="p-3 space-y-2">
            {posture.actionableDiagnoses.length === 0 ? (
              <p className="text-[11px] text-zinc-500 px-3 py-2">All workflow runs healthy.</p>
            ) : posture.actionableDiagnoses.map((d) => (
              <div key={d.runId} className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <p className="text-sm font-semibold text-white">{d.workflowId}</p>
                  <span className="text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px text-amber-400 bg-amber-500/10 border-amber-500/20">
                    {d.health}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mb-2">{d.reason}</p>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-zinc-400">
                    <span className="font-semibold text-emerald-300">Suggested:</span> {d.action.label} — <span className="dim-1">{d.action.reason}</span>
                  </span>
                  {!d.action.autoSafe && <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-1.5 py-px uppercase tracking-wider">Human review</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Dead-letter items */}
      <Reveal direction="up" delay={0.24}>
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <InboxStackIcon className="h-4 w-4 text-red-400" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Dead-letter queue</p>
            </div>
            <p className="text-[11px] text-zinc-500">{posture.unresolvedDeadLetters.length} unresolved</p>
          </div>
          <div className="p-3 space-y-2">
            {posture.unresolvedDeadLetters.length === 0 ? (
              <p className="text-[11px] text-zinc-500 px-3 py-2">No items in the dead-letter queue.</p>
            ) : posture.unresolvedDeadLetters.map((dlq) => (
              <div key={dlq.id} className="rounded-lg border border-red-500/10 bg-red-500/[0.02] px-4 py-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <p className="text-sm font-semibold text-white">{CATEGORY_LABEL[dlq.category]}</p>
                  <span className="text-[10px] text-zinc-500 font-mono">{dlq.id}</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{dlq.reason}</p>
                <p className="text-[10px] text-zinc-500 mt-2">
                  Suggested: <span className="text-emerald-300">{dlq.suggestedRecovery}</span> · {dlq.retryHistory.length} retries attempted
                </p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Enterprise trust strip */}
      <Reveal direction="up" delay={0.28}>
        <div className="mt-8 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <CpuChipIcon className="h-4 w-4 text-cyan-400" />
            <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest">If your operations team asks…</p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2 text-xs text-zinc-300">
            {[
              ["Can the system fail safely?",            "Yes — every operation routes through the failure classifier; unrecoverable failures land in the dead-letter queue, not silent state."],
              ["Can we retry?",                          "Safe retries happen automatically with provider-aware backoff. Risky actions (execute, rollback) require human review."],
              ["Are operations idempotent?",             "Mutations accept an Idempotency-Key. Replays return the prior result; conflicts fail loud."],
              ["Can it recover from partial failure?",   "The workflow recovery engine diagnoses stalled/stuck/partial runs and suggests safe next moves."],
              ["Does it protect downstream providers?",  "Per-(tenant, target) circuit breakers open after repeated failures and probe before resuming."],
              ["Do we honour rate limits?",              "Provider-specific backoff with Retry-After and X-RateLimit-Reset support."],
              ["Are inconsistent writes flagged?",       "Cross-system flows carry a correlation stitch; consistency invariants run after every flow."],
              ["Can we see what's failing right now?",   "This page — every signal lives in one place, no silent state, no opaque retries."],
            ].map(([q, a]) => (
              <li key={q} className="flex items-start gap-2">
                <CheckCircleIcon className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed"><span className="font-semibold text-zinc-100">{q}</span> <span className="dim-1">{a}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* Self-serve links */}
      <Reveal direction="up" delay={0.32}>
        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          {[
            { href: "/dashboard/workflows",  label: "Workflows",      icon: ArrowPathIcon, sub: "Workflow runs, jobs, and retry queues." },
            { href: "/dashboard/jobs",       label: "Jobs",           icon: ClockIcon,     sub: "Inspect individual job state and retry history." },
            { href: "/dashboard/security",   label: "Security center",icon: SignalIcon,    sub: "Tenant isolation, RBAC, credential health." },
          ].map(({ href, label, icon: Icon, sub }) => (
            <Link key={href} href={href} className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-cyan-500/25 hover:bg-cyan-500/[0.03] transition-colors">
              <Icon className="h-4 w-4 text-cyan-400 mb-2" />
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{sub}</p>
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

function PostureRow({ check }: { check: ReliabilityCheck }) {
  const Icon =
    check.semantic === "success" ? CheckCircleIcon :
    check.semantic === "warning" ? ExclamationTriangleIcon :
    check.semantic === "error"   ? XCircleIcon :
                                   CheckCircleIcon;
  const tone =
    check.semantic === "success" ? "text-emerald-400" :
    check.semantic === "warning" ? "text-amber-400" :
    check.semantic === "error"   ? "text-red-400" :
                                   "text-zinc-400";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3">
      <Icon className={`h-4 w-4 ${tone} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{check.label}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{check.detail}</p>
      </div>
    </div>
  );
}

function iso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.round(diff / (60 * 60_000))}h ago`;
  return `${Math.round(diff / (24 * 60 * 60_000))}d ago`;
}
