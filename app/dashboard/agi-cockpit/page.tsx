"use client";

/**
 * /dashboard/agi-cockpit — Phase 508.
 *
 * The headline AGI surface for ReleaseOps. Fuses the Release Advisor +
 * Policy Proposal engines into one operator hub. Shows top pending
 * items across both, the engines' telemetry, and a single call-to-
 * action banner that adapts to severity.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  SparklesIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface CockpitRec {
  id: string; releaseId: string; kind: string; title: string;
  rationale: string; confidence: number; severity: string; generatedAtIso: string;
}
interface CockpitProp {
  id: string; kind: string; suggestedRuleKey: string; title: string;
  rationale: string; confidence: number; severity: string; generatedAtIso: string;
}
interface CockpitSugg {
  id: string; kind: string; title: string; rationale: string;
  targetKind: string | null; targetId: string | null;
  confidence: number; generatedAtIso: string;
}
interface AvailSnapshot {
  windowSize: number; aiGenerated: number; fallbackRules: number;
  errored: number; aiAvailabilityPct: number;
}
interface EngineTelemetry {
  name: string; version: string;
  pendingCount: number; acceptedCount: number; rejectedCount: number;
  lastRunIso: string | null;
}
interface CockpitData {
  generatedAt: string;
  engines: {
    advisor: EngineTelemetry;
    policyProposal: EngineTelemetry;
    proactiveSuggestion?: EngineTelemetry;
  };
  topRecommendations: CockpitRec[];
  topProposals: CockpitProp[];
  topSuggestions: CockpitSugg[];
  aiAvailability: AvailSnapshot | null;
  headline: {
    totalPending: number;
    highestSeverity: "low" | "medium" | "high" | "critical" | "none";
    callToAction: string;
  };
}

const SUGGESTION_KIND_LABEL: Record<string, string> = {
  review_release: "Review release",
  tighten_protection: "Tighten protection",
  reconcile_manual_fix: "Reconcile manual fix",
  investigate_incident: "Investigate incident",
  reduce_fallback_rate: "Reduce AI fallback",
  review_pattern: "Review pattern",
  no_action_needed: "No action needed",
};

const KIND_HREF: Record<string, string> = {
  release: "/dashboard/releases",
  council: "/dashboard/advisor-council",
  triage:  "/dashboard/incident-triage",
  remediation: "/dashboard/remediation-proposals",
  repo: "/dashboard/repositories",
};
type CockpitBody = { ok: true; data: CockpitData } | { ok: false; error: string; hint?: string };

const SEVERITY_CLASS: Record<string, string> = {
  critical: "bg-rose-500/25 text-rose-200 border-rose-500/40",
  high:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  none:     "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const HEADLINE_TONE: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/[0.05]",
  high:     "border-rose-500/30 bg-rose-500/[0.04]",
  medium:   "border-amber-500/30 bg-amber-500/[0.04]",
  low:      "border-emerald-500/30 bg-emerald-500/[0.04]",
  none:     "border-emerald-500/30 bg-emerald-500/[0.04]",
};

export default function AgiCockpitPage() {
  const [resp, setResp] = useState<CockpitBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadCockpit() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/agi-cockpit", { credentials: "include" })
      .then((r) => r.json())
      .then((j: CockpitBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCockpit(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`AGI cockpit · all-up · ${data ? data.headline.totalPending : 0} pending`}
        title={<>The AI cockpit. <span className="text-zinc-500">One hub.</span></>}
        description="The fused view of the platform's autonomous engines: Release Advisor (per-release recommendations) + Policy Proposal (org-level rule suggestions). The headline banner adapts to the highest-severity item pending across both."
        helps="When in doubt, start here. The cockpit tells you the single most important thing to look at right now."
        connectFirst="Reads from the two engines' existing outputs. Generate via the per-engine pages if either inbox is empty."
        engineers={["AI Operations", "Release Captain", "Compliance"]}
        requiresApproval="The cockpit is read-only. All decisions still happen on the per-engine pages."
        actions={[
          { label: "Release advisor",   href: "/dashboard/release-advisor" },
          { label: "Policy proposals",  href: "/dashboard/policy-proposals" },
        ]}
        safetyNote="Pure read · safe-degraded across both engines · severity-aware headline"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading cockpit…
        </div>
      )}
      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        <>
          {/* Headline banner */}
          <div className={`rounded-2xl border ${HEADLINE_TONE[data.headline.highestSeverity] ?? HEADLINE_TONE.none} p-5 mb-6`}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${SEVERITY_CLASS[data.headline.highestSeverity] ?? SEVERITY_CLASS.none}`}>
                {data.headline.highestSeverity === "none" ? "all clear" : `severity ${data.headline.highestSeverity}`}
              </span>
              <p className="text-[14px] font-semibold text-white flex-1 min-w-[200px]">{data.headline.callToAction}</p>
              {data.headline.totalPending > 0 && (
                <div className="flex gap-2">
                  <Link href="/dashboard/release-advisor"
                        className="px-3 py-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] text-[11.5px] font-mono text-white hover:bg-white/[0.08]">
                    Release advisor →
                  </Link>
                  <Link href="/dashboard/policy-proposals"
                        className="px-3 py-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] text-[11.5px] font-mono text-white hover:bg-white/[0.08]">
                    Policy proposals →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Engine telemetry */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <EngineCard engine={data.engines.advisor} icon={<SparklesIcon className="h-4 w-4" />} href="/dashboard/release-advisor" />
            <EngineCard engine={data.engines.policyProposal} icon={<CpuChipIcon className="h-4 w-4" />} href="/dashboard/policy-proposals" />
            {data.engines.proactiveSuggestion && (
              <EngineCard engine={data.engines.proactiveSuggestion} icon={<SparklesIcon className="h-4 w-4" />} href="/dashboard/agi-suggestions" />
            )}
          </div>

          {/* Phase 528 — AI availability snapshot */}
          {data.aiAvailability && data.aiAvailability.windowSize > 0 && (
            <AvailabilityStrip snapshot={data.aiAvailability} />
          )}

          {/* Phase 528 — Top pending proactive suggestions */}
          {data.engines.proactiveSuggestion && (
            <Section title="Top pending AGI suggestions" subtitle="Operator next-actions proposed by Claude from recent memory">
              {data.topSuggestions.length === 0 ? (
                <p className="text-[12.5px] text-zinc-400 italic">No pending suggestions. Generate from /dashboard/agi-suggestions.</p>
              ) : (
                <div className="space-y-2">
                  {data.topSuggestions.map((s) => {
                    const targetHref = s.targetKind && KIND_HREF[s.targetKind] ? KIND_HREF[s.targetKind] : "/dashboard/agi-suggestions";
                    const severity = s.confidence >= 80 ? "high" : s.confidence >= 60 ? "medium" : "low";
                    return (
                      <CompactCard
                        key={s.id}
                        severity={severity}
                        title={s.title}
                        rationale={s.rationale}
                        confidence={s.confidence}
                        chip={SUGGESTION_KIND_LABEL[s.kind] ?? s.kind}
                        meta={s.targetId ? `${s.targetKind ?? "target"} ${s.targetId}` : "no specific target"}
                        href={targetHref}
                        generatedAtIso={s.generatedAtIso}
                      />
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {/* Top recommendations */}
          <Section title="Top pending recommendations" subtitle={`From the Release Advisor (${data.engines.advisor.version})`}>
            {data.topRecommendations.length === 0 ? (
              <p className="text-[12.5px] text-zinc-400 italic">Nothing pending. Generate from /dashboard/release-advisor.</p>
            ) : (
              <div className="space-y-2">
                {data.topRecommendations.map((r) => (
                  <CompactCard
                    key={r.id}
                    severity={r.severity}
                    title={r.title}
                    rationale={r.rationale}
                    confidence={r.confidence}
                    chip={r.kind}
                    meta={`release ${r.releaseId}`}
                    href="/dashboard/release-advisor"
                    generatedAtIso={r.generatedAtIso}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Top proposals */}
          <Section title="Top pending policy proposals" subtitle={`From the Policy Proposal engine (${data.engines.policyProposal.version})`}>
            {data.topProposals.length === 0 ? (
              <p className="text-[12.5px] text-zinc-400 italic">Nothing pending. Generate from /dashboard/policy-proposals.</p>
            ) : (
              <div className="space-y-2">
                {data.topProposals.map((p) => (
                  <CompactCard
                    key={p.id}
                    severity={p.severity}
                    title={p.title}
                    rationale={p.rationale}
                    confidence={p.confidence}
                    chip={p.kind}
                    meta={`key ${p.suggestedRuleKey}`}
                    href="/dashboard/policy-proposals"
                    generatedAtIso={p.generatedAtIso}
                  />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function EngineCard({ engine, icon, href }: { engine: EngineTelemetry; icon: React.ReactNode; href: string }) {
  const lastRun = engine.lastRunIso ? new Date(engine.lastRunIso).toLocaleString() : "never";
  return (
    <div className="rounded-xl border border-violet-500/[0.18] bg-violet-500/[0.03] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-violet-300">{icon}</span>
        <p className="text-[13px] font-semibold text-white">{engine.name}</p>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{engine.version}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2 text-[11px] font-mono">
        <Metric label="pending" value={engine.pendingCount} tone={engine.pendingCount > 0 ? "amber" : "zinc"} />
        <Metric label="accepted" value={engine.acceptedCount} tone="emerald" />
        <Metric label="rejected" value={engine.rejectedCount} tone={engine.rejectedCount > 0 ? "rose" : "zinc"} />
      </div>
      <div className="flex items-center justify-between text-[10.5px] font-mono text-zinc-500">
        <span>last run · {lastRun}</span>
        <Link href={href} className="text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          Open <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "text-emerald-300",
    amber:   "text-amber-300",
    rose:    "text-rose-300",
    zinc:    "text-zinc-300",
  }[tone];
  return (
    <div className="rounded border border-white/[0.06] bg-black/20 px-2 py-1">
      <p className="text-zinc-500 uppercase tracking-[0.18em] text-[8px]">{label}</p>
      <p className={`${cls} text-[14px] font-bold`}>{value}</p>
    </div>
  );
}

function AvailabilityStrip({ snapshot }: { snapshot: AvailSnapshot }) {
  const tone =
    snapshot.aiAvailabilityPct >= 80
      ? "border-emerald-500/[0.20] bg-emerald-500/[0.04]"
      : snapshot.aiAvailabilityPct >= 50
      ? "border-amber-500/[0.20] bg-amber-500/[0.04]"
      : "border-rose-500/[0.20] bg-rose-500/[0.04]";
  return (
    <Link href="/dashboard/agi-memory" className="block mb-6">
      <div className={`rounded-xl border p-3 ${tone} hover:brightness-110 transition`}>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[11px] font-semibold text-violet-100">AI provider availability</p>
          <span className="text-[10px] font-mono text-zinc-300">window: last {snapshot.windowSize}</span>
          <div className="flex items-center gap-2 ml-auto text-[11px] font-mono">
            <span className="text-violet-300">{snapshot.aiGenerated} AI</span>
            <span className="text-zinc-500">·</span>
            <span className="text-amber-300">{snapshot.fallbackRules} fallback</span>
            <span className="text-zinc-500">·</span>
            <span className="text-rose-300">{snapshot.errored} err</span>
            <span className="text-zinc-500">·</span>
            <span className="text-white font-bold">{snapshot.aiAvailabilityPct}%</span>
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" style={{ width: `${snapshot.aiAvailabilityPct}%` }} />
        </div>
      </div>
    </Link>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="text-[13px] font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-[10.5px] font-mono text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function CompactCard({ severity, title, rationale, confidence, chip, meta, href, generatedAtIso }: {
  severity: string; title: string; rationale: string; confidence: number;
  chip: string; meta: string; href: string; generatedAtIso: string;
}) {
  return (
    <Link href={href}
          className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-violet-500/30 transition-colors">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEVERITY_CLASS[severity] ?? SEVERITY_CLASS.unknown}`}>
          {severity}
        </span>
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-300">
          {chip}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">confidence {confidence}%</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(generatedAtIso).toLocaleString()}</span>
      </div>
      <p className="text-[12.5px] font-semibold text-white">{title}</p>
      <p className="text-[12px] text-zinc-300 mt-0.5 line-clamp-2">{rationale}</p>
      <p className="text-[10.5px] font-mono text-zinc-500 mt-1">{meta}</p>
    </Link>
  );
}
