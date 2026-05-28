"use client";

/**
 * /dashboard/learning-loop — Phase 511.
 *
 * The AGI's self-improvement queue. Operator decisions across all
 * three engines (advisor, policy-proposal, triage) get clustered by
 * keyword; the result is a ranked list of "engine improvement
 * signals" — actionable feedback the platform team can use to tune
 * the engines.
 */

import { useEffect, useState } from "react";
import {
  CpuChipIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type SignalKind = "rejection_cluster" | "override_cluster" | "low_confidence_acceptance" | "high_rejection_rate";

interface Signal {
  kind: SignalKind;
  engine: "release_advisor" | "policy_proposal" | "incident_triage";
  targetKind: string;
  keyword: string | null;
  occurrences: number;
  strength: number;
  title: string;
  rationale: string;
  suggestedAction: string;
}

interface Data {
  generatedAt: string;
  engineVersion: string;
  totalDecisionsAnalyzed: number;
  signals: Signal[];
  summary: { totalRows: number; signalsByKind: Record<string, number> };
}

type Body = { ok: true; data: Data } | { ok: false; error: string; hint?: string };

const KIND_LABEL: Record<SignalKind, string> = {
  rejection_cluster: "Rejection cluster",
  override_cluster: "Override cluster",
  low_confidence_acceptance: "Low confidence accept",
  high_rejection_rate: "High rejection rate",
};

const ENGINE_LABEL: Record<Signal["engine"], string> = {
  release_advisor: "Release Advisor",
  policy_proposal: "Policy Proposal",
  incident_triage: "Incident Triage",
};

function strengthClass(s: number): string {
  if (s >= 80) return "bg-rose-500/15 text-rose-300 border-rose-500/25";
  if (s >= 60) return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  if (s >= 40) return "bg-violet-500/15 text-violet-300 border-violet-500/25";
  return "bg-zinc-700/40 text-zinc-300 border-zinc-700/40";
}

export default function LearningLoopPage() {
  const [resp, setResp] = useState<Body | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/learning-loop", { credentials: "include" })
      .then((r) => r.json())
      .then((j: Body) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`AGI cockpit · learning loop${data ? ` · ${data.signals.length} signals` : ""}`}
        title={<>The engines <span className="text-zinc-500">learn from you.</span></>}
        description="Every accept, reject, override, and dismiss across the three AGI engines is feedback. The learning-loop responder clusters those decisions by keyword and surfaces engine-improvement signals: missing inputs, mis-calibrated thresholds, over-rejection patterns. This is the platform's self-improvement queue."
        helps="Read each signal as a TODO for the engine. The platform team uses these to tune rules, add input features, and improve calibration."
        connectFirst="Reads from existing AdvisorRecommendation + PolicyProposal + IncidentTriage. Becomes more useful as more decisions accumulate."
        engineers={["AI Operations", "Platform team", "Release Captain"]}
        requiresApproval="Read-only. Improvements are applied to engine code by the platform team."
        actions={[
          { label: "Release advisor",   href: "/dashboard/release-advisor" },
          { label: "Policy proposals",  href: "/dashboard/policy-proposals" },
          { label: "Incident triage",   href: "/dashboard/incident-triage" },
        ]}
        safetyNote="Pure clustering · engine-version pinned · safe-degraded across all three source tables"
      />

      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.06] text-[12px] font-semibold text-violet-200 hover:bg-violet-500/[0.12] disabled:opacity-50 disabled:cursor-wait transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing…" : "Refresh signals"}
        </button>
      </div>

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={LightBulbIcon} label="Signals" value={String(data.signals.length)} tone={data.signals.length > 0 ? "amber" : "emerald"} />
          <Stat icon={CpuChipIcon} label="Decisions analyzed" value={String(data.totalDecisionsAnalyzed)} tone="zinc" />
          <Stat icon={ExclamationTriangleIcon} label="Rejection clusters" value={String(data.summary.signalsByKind.rejection_cluster ?? 0)} tone={(data.summary.signalsByKind.rejection_cluster ?? 0) > 0 ? "rose" : "zinc"} />
          <Stat icon={ExclamationTriangleIcon} label="Override clusters" value={String(data.summary.signalsByKind.override_cluster ?? 0)} tone={(data.summary.signalsByKind.override_cluster ?? 0) > 0 ? "amber" : "zinc"} />
          <Stat icon={ExclamationTriangleIcon} label="High rejection" value={String(data.summary.signalsByKind.high_rejection_rate ?? 0)} tone={(data.summary.signalsByKind.high_rejection_rate ?? 0) > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">Loading signals…</div>}
      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{networkError}</div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">Sign in required.</div>
      )}

      {data && data.signals.length === 0 && (
        <div className="rounded-2xl border border-emerald-500/[0.18] bg-emerald-500/[0.04] p-8 text-center">
          <p className="text-[14px] font-semibold text-emerald-100 mb-2">All clear — no engine-improvement signals.</p>
          <p className="text-[12.5px] text-zinc-400">
            {data.totalDecisionsAnalyzed === 0
              ? "No operator decisions analyzed yet. Decisions accumulate as you accept/reject recommendations."
              : `Analyzed ${data.totalDecisionsAnalyzed} decision${data.totalDecisionsAnalyzed === 1 ? "" : "s"} — engines are calibrated correctly for this org.`}
          </p>
        </div>
      )}

      {data && data.signals.length > 0 && (
        <div className="space-y-3 mb-8">
          {data.signals.map((s, i) => (
            <div key={i} className="rounded-2xl border border-violet-500/[0.18] bg-violet-500/[0.025] p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${strengthClass(s.strength)}`}>
                  strength {s.strength}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-300">
                  {KIND_LABEL[s.kind]}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.02] text-zinc-300">
                  {ENGINE_LABEL[s.engine]}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">target: {s.targetKind}</span>
                {s.keyword && (
                  <span className="text-[10px] font-mono text-violet-300">keyword: "{s.keyword}"</span>
                )}
                <span className="text-[10px] font-mono text-zinc-500 ml-auto">occurrences: {s.occurrences}</span>
              </div>
              <p className="text-[13.5px] font-semibold text-white mb-1">{s.title}</p>
              <p className="text-[12.5px] text-zinc-300 mb-3">{s.rationale}</p>
              <div className="rounded-lg border border-emerald-500/[0.18] bg-emerald-500/[0.025] p-2.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 mb-1">Suggested action</p>
                <p className="text-[12px] text-zinc-200">{s.suggestedAction}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <p className="text-[10px] font-mono text-zinc-600 text-right">engine: {data.engineVersion}</p>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof CpuChipIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <Icon className="h-4 w-4 opacity-80" />
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
