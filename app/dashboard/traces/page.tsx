"use client";

import Link from "next/link";
import {
  ChartBarSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  CubeTransparentIcon,
  CpuChipIcon,
  DocumentTextIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { buildObservabilityPosture } from "@/lib/observability/observabilityPosture";
import type { ObservabilityCheck, ObservabilitySemantic } from "@/lib/observability/observabilityPosture";
import type { OperationTrace } from "@/lib/tracing/operationTrace";
import { id } from "@/lib/domain/ids";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";
import { useTenantFreshness } from "@/components/platform/useTenantFreshness";

// ---------------------------------------------------------------------------
// Honest preview traces — typed shapes from the canonical OperationTrace.
// All values flow through the same redaction notice the export bundle ships.
// ---------------------------------------------------------------------------

function previewTrace(args: {
  traceId: string;
  operation: string;
  rootSpanName: string;
  durationMs: number;
  status: "ok" | "error" | "cancelled";
  sourceSystem: OperationTrace["sourceSystem"];
  spans: { name: string; durationMs: number; status: "ok" | "error" | "cancelled" }[];
  evidence?: { kind: OperationTrace["evidence"][number]["kind"]; label: string }[];
  errorCode?: string;
}): OperationTrace {
  const now = Date.now();
  const startedMs = now - args.durationMs;
  let cursorMs = startedMs;
  return {
    traceId: id.trace(args.traceId),
    organizationId: id.organization("preview"),
    correlationId: id.correlation(`corr_${args.traceId}`),
    operation: args.operation,
    sourceSystem: args.sourceSystem,
    rootSpanName: args.rootSpanName,
    startedAt: new Date(startedMs).toISOString(),
    endedAt: new Date(now).toISOString(),
    spans: args.spans.map((s, idx) => {
      const span = {
        spanId: id.span(`span_${args.traceId}_${idx}`),
        name: s.name,
        startedAt: new Date(cursorMs).toISOString(),
        endedAt: new Date(cursorMs + s.durationMs).toISOString(),
        durationMs: s.durationMs,
        status: s.status,
        attributes: {} as Record<string, string | number | boolean>,
      };
      cursorMs += s.durationMs;
      return span;
    }),
    links: {},
    evidence: (args.evidence ?? []).map((e, idx) => ({ id: `ev_${args.traceId}_${idx}`, kind: e.kind, label: e.label })),
    source: "preview",
    redacted: true,
    errorCode: args.errorCode,
  };
}

const SAMPLE_TRACES: OperationTrace[] = [
  previewTrace({
    traceId: "scan_aws_prod",
    operation: "cloud.scan",
    rootSpanName: "AWS scan · prod-account",
    durationMs: 41_200,
    status: "ok",
    sourceSystem: "workflow",
    spans: [
      { name: "credentials.validate",  durationMs: 800,  status: "ok" },
      { name: "regions.enumerate",     durationMs: 2400, status: "ok" },
      { name: "resources.discover",    durationMs: 28_000, status: "ok" },
      { name: "snapshot.persist",      durationMs: 5_000, status: "ok" },
      { name: "findings.generate",     durationMs: 5_000, status: "ok" },
    ],
    evidence: [
      { kind: "snapshot", label: "snapshot snp_a3b1 · 412 resources" },
      { kind: "policy_rule", label: "policy: security.s3_public_block" },
      { kind: "reasoning", label: "reasoning trace · 6 phases" },
    ],
  }),
  previewTrace({
    traceId: "approve_plan",
    operation: "execution_plan.approve",
    rootSpanName: "Approval · close S3 public access",
    durationMs: 1_950,
    status: "ok",
    sourceSystem: "api",
    spans: [
      { name: "policy.evaluate",  durationMs: 410, status: "ok" },
      { name: "rbac.check",       durationMs: 80,  status: "ok" },
      { name: "approval.persist", durationMs: 220, status: "ok" },
      { name: "audit.record",     durationMs: 110, status: "ok" },
      { name: "event.publish",    durationMs: 90,  status: "ok" },
      { name: "memory.record",    durationMs: 60,  status: "ok" },
    ],
    evidence: [
      { kind: "policy_rule", label: "policy: production.requires_two_approvers" },
      { kind: "audit_event", label: "audit · approval.grant by approver" },
    ],
  }),
  previewTrace({
    traceId: "github_sync_failed",
    operation: "releaseops.sync",
    rootSpanName: "GitHub sync · 18 repos",
    durationMs: 12_700,
    status: "error",
    sourceSystem: "scheduler",
    errorCode: "github.5xx",
    spans: [
      { name: "github.repos.fetch",      durationMs: 4_200, status: "ok" },
      { name: "github.workflows.fetch",  durationMs: 6_800, status: "error" },
      { name: "circuit.open",            durationMs: 50,    status: "ok" },
      { name: "deadletter.append",       durationMs: 90,    status: "ok" },
    ],
    evidence: [
      { kind: "external_doc", label: "GitHub status · partial outage" },
      { kind: "memory", label: "memory · 3rd github 5xx in 1h" },
    ],
  }),
  previewTrace({
    traceId: "policy_block_iam",
    operation: "execution_plan.submit",
    rootSpanName: "Plan submit blocked · IAM tightening",
    durationMs: 690,
    status: "ok",
    sourceSystem: "api",
    spans: [
      { name: "plan.validate", durationMs: 110, status: "ok" },
      { name: "policy.evaluate", durationMs: 260, status: "ok" },
      { name: "approval.route",  durationMs: 220, status: "ok" },
      { name: "audit.record",    durationMs: 100, status: "ok" },
    ],
    evidence: [
      { kind: "policy_rule", label: "policy: iam.requires_security_review" },
      { kind: "audit_event", label: "audit · policy.evaluated decision=require_approval" },
    ],
  }),
  previewTrace({
    traceId: "copilot_query_redacted",
    operation: "copilot.query",
    rootSpanName: "Copilot · why is azure circuit open?",
    durationMs: 1_180,
    status: "ok",
    sourceSystem: "copilot",
    spans: [
      { name: "intent.classify",     durationMs: 60,  status: "ok" },
      { name: "context.build",       durationMs: 220, status: "ok" },
      { name: "context.redact",      durationMs: 80,  status: "ok" },
      { name: "llm.invoke",          durationMs: 720, status: "ok" },
      { name: "response.guardrail",  durationMs: 100, status: "ok" },
    ],
    evidence: [
      { kind: "metric", label: "reliability.circuit.opened · 4 in 1h" },
      { kind: "memory", label: "memory · azure 503 spike on 2026-05-12" },
    ],
  }),
];

export default function TraceViewerPage() {
  const { isFreshOrLoading, loaded } = useTenantFreshness();
  const showSampleData = loaded && !isFreshOrLoading;
  const posture = buildObservabilityPosture({
    source: "preview",
    traces24h: showSampleData ? 287 : 0,
    auditRecords24h: showSampleData ? 612 : 0,
    bundlesExported30d: showSampleData ? 4 : 0,
    loggerActive: true,
    auditStoreConfigured: true,
    copilotAuditActive: true,
  });

  const tone: Record<ObservabilitySemantic, string> = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    error: "text-red-400",
    neutral: "text-zinc-400",
  };
  const bg: Record<ObservabilitySemantic, string> = {
    success: "bg-emerald-500/10 border-emerald-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
    error: "bg-red-500/10 border-red-500/20",
    neutral: "bg-white/[0.04] border-white/[0.08]",
  };

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <ChartBarSquareIcon className="h-4 w-4 text-violet-400" />
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Trace Viewer</p>
            {showSampleData && (
              <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
                Preview
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Operational <span className="text-gradient">truth.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            Every critical action — connector validation, scan, recommendation, plan, approval, sync — traced end to end. <span className="dim-1">Spans, evidence, audit links, and policy decisions all in one view.</span>
          </p>
        </div>
      </Reveal>

      {!showSampleData && (
        <Reveal direction="up" delay={0.04}>
          <div className="mb-8">
            <TenantEmptyState
              icon={<ChartBarSquareIcon className="h-5 w-5" />}
              tone="violet"
              eyebrow="No traces yet"
              title="Operation traces appear automatically the moment work begins."
              description="Every connector validation, scan, recommendation, plan, approval, and sync is traced end-to-end with redaction baked in. Once a cloud is connected, your first traces show up here within seconds."
              agiNote="AGI will start producing spans and evidence chains automatically — there are no SDKs to install and no agents to deploy."
              actions={[
                { href: "/dashboard/connectors", label: "Connect first cloud", variant: "primary" },
                { href: "/dashboard/audit", label: "Audit Center", variant: "ghost" },
              ]}
            />
          </div>
        </Reveal>
      )}

      {/* Posture KPI strip */}
      {showSampleData && (
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Traces · last 24h",       value: "287",                         sub: "operations captured",                            icon: ChartBarSquareIcon, semantic: "success"  as ObservabilitySemantic },
          { label: "Audit records · last 24h",value: "612",                         sub: "across the canonical taxonomy",                   icon: DocumentTextIcon,   semantic: "success"  as ObservabilitySemantic },
          { label: "Bundles · last 30d",      value: "4",                           sub: "JSON / CSV / NDJSON exports",                     icon: CubeTransparentIcon, semantic: "neutral"  as ObservabilitySemantic },
          { label: "Metrics observed",        value: String(posture.distinctMetricsObserved || 38), sub: "of 41 in the canonical taxonomy", icon: CommandLineIcon,    semantic: "neutral"  as ObservabilitySemantic },
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
      )}

      {/* Posture checks */}
      {showSampleData && (
      <Reveal direction="up" delay={0.08}>
        <div className="mb-8 rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-fuchsia-500/[0.02] p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-500/[0.06] blur-[60px] pointer-events-none" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-1">Observability posture</p>
                <h2 className="text-lg font-bold text-white">Every action traceable. Every trace redacted.</h2>
              </div>
              <Link href="/dashboard/audit" className="text-[11px] font-semibold text-violet-300 hover:text-violet-200 transition-colors">
                Audit Center <ArrowRightIcon className="inline h-3 w-3 ml-0.5 -mt-0.5" />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {posture.checks.map((c) => (
                <PostureRow key={c.id} check={c} />
              ))}
            </div>
          </div>
        </div>
      </Reveal>
      )}

      {/* Recent traces */}
      {showSampleData && (
        <>
          <Reveal direction="up" delay={0.12}>
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Recent operation traces</p>
                  <h2 className="text-xl font-bold text-white">{SAMPLE_TRACES.length} traces in the last 24h.</h2>
                </div>
                <span className="text-[11px] text-zinc-500">Source-tagged, redacted, tenant-scoped.</span>
              </div>
            </div>
          </Reveal>

          <div className="space-y-3 mb-8">
            {SAMPLE_TRACES.map((trace) => (
              <Reveal key={trace.traceId} direction="up" delay={0.05}>
                <TraceCard trace={trace} />
              </Reveal>
            ))}
          </div>
        </>
      )}

      {/* Trust strip */}
      <Reveal direction="up" delay={0.24}>
        <div className="mt-8 rounded-2xl border border-violet-500/15 bg-violet-500/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <CpuChipIcon className="h-4 w-4 text-violet-400" />
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">If your compliance team asks…</p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2 text-xs text-zinc-300">
            {[
              ["What happened?",            "Every action carries an operation trace with span timings and an evidence chain."],
              ["Who initiated it?",         "Traces link to the user or system actor; cross-tenant attempts are recorded separately."],
              ["Why was it allowed?",       "Policy decisions appear in the trace alongside the approval and audit references."],
              ["What was changed?",         "Artifacts (Terraform/CLI/rollback/plan) link from the trace to the audit bundle."],
              ["What evidence supports it?","The trace carries an Evidence panel — snapshot, finding, policy, memory, reasoning."],
              ["Can I export it?",          "Audit bundles ship as JSON / CSV / NDJSON via the bundle engine."],
              ["Are secrets visible?",      "No — every string passes through canonical redaction before persistence and display."],
              ["Can I see what failed?",    "Failed spans render in red with the safe next action; trace ties into the dead-letter queue."],
            ].map(([q, a]) => (
              <li key={q} className="flex items-start gap-2">
                <CheckCircleIcon className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed"><span className="font-semibold text-zinc-100">{q}</span> <span className="dim-1">{a}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}

function PostureRow({ check }: { check: ObservabilityCheck }) {
  const Icon =
    check.semantic === "success" ? CheckCircleIcon :
    check.semantic === "warning" ? ExclamationTriangleIcon :
    check.semantic === "error"   ? XCircleIcon :
                                   CheckCircleIcon;
  const t =
    check.semantic === "success" ? "text-emerald-400" :
    check.semantic === "warning" ? "text-amber-400" :
    check.semantic === "error"   ? "text-red-400" :
                                   "text-zinc-400";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3">
      <Icon className={`h-4 w-4 ${t} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{check.label}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{check.detail}</p>
      </div>
    </div>
  );
}

function TraceCard({ trace }: { trace: OperationTrace }) {
  const totalMs = trace.spans.reduce((s, x) => s + (x.durationMs ?? 0), 0);
  const failed = trace.spans.find((s) => s.status === "error");
  const semantic: "success" | "warning" | "error" = failed ? "error" : "success";
  return (
    <div className={`rounded-2xl border bg-white/[0.02] overflow-hidden ${
      semantic === "error" ? "border-red-500/20" : "border-white/[0.06]"
    }`}>
      <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px text-violet-400 bg-violet-500/10 border-violet-500/20">
            {trace.operation}
          </span>
          <span className="text-sm font-semibold text-white truncate">{trace.rootSpanName}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono shrink-0">
          <span><ClockIcon className="inline h-3 w-3 mr-0.5 -mt-0.5" /> {formatDuration(totalMs)}</span>
          <span>{trace.sourceSystem}</span>
          <span className="text-[9px]">{trace.traceId.slice(0, 18)}…</span>
        </div>
      </div>

      {/* Span timeline */}
      <div className="px-5 py-3 border-b border-white/[0.05]">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Spans · {trace.spans.length}</p>
        <div className="space-y-1">
          {trace.spans.map((s) => {
            const pct = totalMs === 0 ? 0 : Math.max(2, Math.round(((s.durationMs ?? 0) / totalMs) * 100));
            const fill =
              s.status === "error"     ? "bg-red-500/40 border-red-500/60" :
              s.status === "cancelled" ? "bg-zinc-500/30 border-zinc-500/40" :
                                          "bg-violet-500/30 border-violet-500/40";
            return (
              <div key={s.spanId} className="flex items-center gap-3">
                <span className="w-44 truncate text-[11px] text-zinc-400">{s.name}</span>
                <div className="flex-1 h-3 rounded-full bg-white/[0.03] border border-white/[0.04] overflow-hidden">
                  <div className={`h-full border-r ${fill}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right text-[10px] text-zinc-500 font-mono">{formatDuration(s.durationMs ?? 0)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Evidence */}
      {trace.evidence.length > 0 && (
        <div className="px-5 py-3 border-b border-white/[0.05]">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Evidence</p>
          <div className="flex flex-wrap gap-1.5">
            {trace.evidence.map((e) => (
              <span key={e.id} className="text-[10px] text-violet-300/90 bg-violet-500/[0.06] border border-violet-500/15 rounded-full px-2 py-0.5">
                {e.kind} · {e.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="text-[11px] text-zinc-500">
          {failed
            ? <span className="text-red-400">Failed · <span className="font-mono">{trace.errorCode}</span></span>
            : <span className="text-emerald-400">Completed cleanly</span>}
          {trace.redacted && <span className="ml-2 text-zinc-500">· redacted</span>}
        </div>
        <Link href="/dashboard/audit" className="text-[11px] font-semibold text-violet-300 hover:text-violet-200">
          View audit story <ArrowRightIcon className="inline h-3 w-3 ml-0.5 -mt-0.5" />
        </Link>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}
