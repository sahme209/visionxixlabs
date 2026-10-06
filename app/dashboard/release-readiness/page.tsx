"use client";

/**
 * /dashboard/release-readiness — Phase 481.
 * Latest readiness snapshot per release across the org.
 * (The existing /dashboard/readiness page is a different
 *  product-launch readiness rollup — kept distinct.)
 */

import { useEffect, useState } from "react";
import {
  ChartBarIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Risk = "low" | "medium" | "high" | "critical" | "unknown";

interface Row {
  releaseId: string;
  applicationId: string;
  releaseTag: string | null;
  status: string;
  hasSnapshot: boolean;
  overallScore: number | null;
  riskLevel: Risk | null;
  evaluatedAtIso: string | null;
  blockerCount: number;
  topBlockerMessage: string | null;
}

interface DigestData {
  generatedAt: string;
  releases: Row[];
  summary: {
    total: number;
    evaluated: number;
    byRisk: Record<Risk, number>;
    averageScore: number | null;
  };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const RISK_CLASS: Record<Risk, string> = {
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  medium:   "bg-white/15 text-zinc-300 border-white/25",
  high:     "bg-orange-500/15 text-orange-300 border-orange-500/25",
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

export default function ReleaseReadinessPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/readiness-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · readiness${data ? ` · ${data.summary.evaluated}/${data.summary.total} evaluated` : ""}`}
        title={<>Eight dimensions. <span className="text-zinc-500">One score per release.</span></>}
        description="The Phase 480 evaluator scores each release across branch governance, change compliance, artifact + secret traceability, rollback readiness, comms, drift risk, and manual reconciliation."
        helps="See which releases are clean vs at risk — and which top blocker is dragging each score."
        connectFirst="Hit 'Re-evaluate readiness' on a release's branch-validation page to populate this list."
        engineers={["Release Captain", "Compliance", "Engineering Manager"]}
        requiresApproval="Readiness is informational — no approval required to view."
        actions={[
          { label: "Releases", href: "/dashboard/releases" },
          { label: "Policy violations", href: "/dashboard/policy-violations" },
        ]}
        safetyNote="Read-only · audit trail in ReleaseReadinessSnapshot · evaluator pure-function deterministic"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading readiness snapshots…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-zinc-300" />
            <p className="text-[12px] font-semibold text-zinc-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={ChartBarIcon}             label="Average score" value={data.summary.averageScore === null ? "—" : `${data.summary.averageScore}/100`} tone={(data.summary.averageScore ?? 0) >= 80 ? "emerald" : (data.summary.averageScore ?? 0) >= 60 ? "amber" : "rose"} />
            <Stat icon={ShieldCheckIcon}          label="Low risk"      value={String(data.summary.byRisk.low)}      tone={data.summary.byRisk.low > 0 ? "emerald" : "zinc"} />
            <Stat icon={ExclamationTriangleIcon}  label="High + critical" value={String(data.summary.byRisk.high + data.summary.byRisk.critical)} tone={(data.summary.byRisk.high + data.summary.byRisk.critical) > 0 ? "rose" : "zinc"} />
            <Stat icon={QuestionMarkCircleIcon}   label="Unevaluated"   value={String(data.summary.total - data.summary.evaluated)} tone="zinc" />
          </div>

          {data.releases.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No releases tracked yet. Connect a Git provider + run a sync to populate this view.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.releases.map((r) => (
                <div key={r.releaseId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white truncate">{r.releaseTag ?? "(untagged)"}</p>
                      <span className="text-[10px] font-mono text-zinc-500">{r.applicationId}</span>
                      <span className="text-[10px] font-mono text-zinc-500">· {r.status}</span>
                    </div>
                    {r.hasSnapshot && r.riskLevel ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${RISK_CLASS[r.riskLevel]}`}>
                          {r.riskLevel}
                        </span>
                        <span className="text-[12px] font-mono text-white">{r.overallScore}/100</span>
                        {r.blockerCount > 0 && (
                          <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                            {r.blockerCount} blocker{r.blockerCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">no snapshot yet</span>
                    )}
                  </div>
                  {r.topBlockerMessage && (
                    <p className="text-[11.5px] text-zinc-400 italic">→ {r.topBlockerMessage}</p>
                  )}
                  {r.evaluatedAtIso && (
                    <p className="text-[10px] font-mono text-zinc-500 mt-1">
                      Evaluated {new Date(r.evaluatedAtIso).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ChartBarIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
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
