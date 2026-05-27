import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";
import type { View } from "../App";

/**
 * Phase 447 — desktop sibling for the web /dashboard/releases page.
 * Phase 489 — wire each row to the release-overview view with a
 * pre-selected releaseId via the `releaseops:select-release` event.
 */

type SidebarTone = "emerald" | "amber" | "rose" | "blue" | "zinc";
type RiskBadge = "low" | "medium" | "high" | "critical" | "unscored";

interface ReleaseListRow {
  id: string;
  applicationId: string;
  releaseTag: string | null;
  commitSha: string | null;
  status: string;
  statusLabel: string;
  sidebarTone: SidebarTone;
  targetEnvironmentId: string | null;
  createdAt: string;
  scopeFinalizedAt: string | null;
  latestReadiness: {
    overallScore: number;
    riskLevel: RiskBadge;
    blockerCount: number;
    evaluatedAtIso: string;
    evaluationSource: string;
  } | null;
  evidencePack: { generatedAtIso: string; signed: boolean } | null;
}

interface DigestData {
  generatedAt: string;
  releases: ReleaseListRow[];
  summary: {
    total: number;
    draft: number; ready: number; deploying: number;
    deployed: number; rolled_back: number; failed: number;
    withEvidence: number; signedEvidence: number;
  };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const DOT_CLASS: Record<SidebarTone, string> = {
  emerald: "bg-emerald-400",
  amber:   "bg-amber-400",
  rose:    "bg-rose-400",
  blue:    "bg-blue-400",
  zinc:    "bg-zinc-600",
};

const RISK_CLASS: Record<RiskBadge, string> = {
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  high:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  critical: "bg-rose-500/25 text-rose-200 border-rose-500/40",
  unscored: "bg-zinc-800/60 text-zinc-300 border-zinc-700/40",
};

function ageStr(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ReleasesView({ onNavigate }: { onNavigate?: (v: View) => void } = {}) {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function openOverview(releaseId: string) {
    // Hand off the selected release to ReleaseOverviewView two ways:
    //  - global window var, picked up on initial mount of the overview
    //  - dispatched event, picked up if the overview is already mounted
    (window as unknown as { __releaseopsSelectedReleaseId?: string }).__releaseopsSelectedReleaseId = releaseId;
    window.dispatchEvent(new CustomEvent("releaseops:select-release", { detail: { releaseId } }));
    onNavigate?.("release-overview");
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/release-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;
  const now = new Date();

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Releases</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Per-release status, readiness, evidence. Every transition is audited.
        </p>
      </div>

      {loading && (
        <div className="glass-card p-4 text-sm text-zinc-400">Loading releases…</div>
      )}

      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-amber-500/30">
          <p className="text-sm font-semibold text-amber-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-amber-300 border border-amber-500/20">
          Sign in required to view releases.
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Total"            value={String(data.summary.total)} />
            <Stat label="Ready"            value={String(data.summary.ready)}     tone={data.summary.ready > 0 ? "amber" : "zinc"} />
            <Stat label="Deployed"         value={String(data.summary.deployed)}  tone="emerald" />
            <Stat label="Signed evidence" value={`${data.summary.signedEvidence}/${data.summary.withEvidence || 0}`} tone={data.summary.signedEvidence === data.summary.withEvidence && data.summary.withEvidence > 0 ? "emerald" : "zinc"} />
          </div>

          {data.releases.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No releases yet. The Phase 442 pipeline creates draft releases as deploys are initiated.
            </div>
          ) : (
            <div className="space-y-2">
              {data.releases.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openOverview(r.id)}
                  className="block w-full text-left glass-card p-3 hover:border-violet-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[r.sidebarTone]}`} />
                      <p className="text-sm font-semibold text-white truncate">
                        {r.releaseTag ?? "(no tag)"} <span className="text-zinc-500 font-normal">· {r.applicationId}</span>
                      </p>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40 shrink-0">
                        {r.statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.latestReadiness && (
                        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${RISK_CLASS[r.latestReadiness.riskLevel]}`}>
                          {r.latestReadiness.overallScore}/100 · {r.latestReadiness.riskLevel}
                        </span>
                      )}
                      {r.latestReadiness && r.latestReadiness.blockerCount > 0 && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25">
                          {r.latestReadiness.blockerCount} blocker{r.latestReadiness.blockerCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {r.evidencePack && (
                        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${r.evidencePack.signed ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-amber-500/10 text-amber-300 border-amber-500/20"}`}>
                          evidence {r.evidencePack.signed ? "signed" : "draft"}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-violet-300/70">overview →</span>
                    </div>
                  </div>
                  {r.commitSha && (
                    <p className="mt-1.5 text-[10.5px] font-mono text-zinc-500">
                      commit {r.commitSha.slice(0, 12)} · created {ageStr(r.createdAt, now)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    amber:   "border-amber-500/20 text-amber-200",
    rose:    "border-rose-500/20 text-rose-200",
    zinc:    "border-zinc-700/40 text-zinc-200",
  }[tone];
  return (
    <div className={`glass-card p-3 border ${cls}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
