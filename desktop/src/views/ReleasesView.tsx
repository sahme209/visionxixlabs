import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";
import type { View } from "../App";
import { OnboardingChecklist } from "../components/OnboardingChecklist";

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
  amber:   "bg-zinc-400",
  rose:    "bg-rose-400",
  blue:    "bg-blue-400",
  zinc:    "bg-zinc-600",
};

const RISK_CLASS: Record<RiskBadge, string> = {
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  medium:   "bg-white/15 text-zinc-300 border-white/25",
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

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/release-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

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

      <OnboardingChecklist onNavigate={onNavigate} />
      <HealthSummaryTile onNavigate={onNavigate} />
      <NewReleasePanel onCreated={loadList} />

      {loading && (
        <div className="glass-card p-4 text-sm text-zinc-400">Loading releases…</div>
      )}

      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-white/30">
          <p className="text-sm font-semibold text-zinc-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-zinc-300 border border-white/20">
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
                        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${r.evidencePack.signed ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-white/10 text-zinc-300 border-white/20"}`}>
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
    amber:   "border-white/20 text-zinc-200",
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

interface HealthSummaryData {
  generatedAt: string;
  releases: { total: number; draft: number; ready: number; deploying: number; deployed: number };
  policy: { blockingOpen: number };
  drift: { criticalOpen: number };
  cherryPicks: { requested: number };
  changeTickets: { inFlight: number };
  readiness: { evaluated: number; averageScore: number | null };
  platformHealthScore: number;
}

type HealthRespBody = { ok: true; data: HealthSummaryData } | { ok: false; error: string; hint?: string };

function HealthSummaryTile({ onNavigate }: { onNavigate?: (v: View) => void }) {
  const [resp, setResp] = useState<HealthRespBody | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/releaseops-health", { credentials: "include" })
      .then((r) => r.json())
      .then((j: HealthRespBody) => { if (!cancelled) setResp(j); })
      .catch(() => { /* surface optional */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="glass-card p-3 text-[11px] text-zinc-500">Loading platform health…</div>;
  if (!resp?.ok) return null;

  const d = resp.data;
  const scoreColor =
    d.platformHealthScore >= 80 ? "text-emerald-300" :
    d.platformHealthScore >= 60 ? "text-zinc-300" :
    d.platformHealthScore >= 40 ? "text-orange-300" : "text-rose-300";

  return (
    <div className="glass-card p-4 border border-violet-500/[0.18]">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">Platform health</p>
          <p className="text-[22px] font-bold">
            <span className={scoreColor}>{d.platformHealthScore}</span>
            <span className="text-[12px] text-zinc-500">/100</span>
          </p>
        </div>
        <p className="text-[9px] font-mono text-zinc-500">
          {d.readiness.evaluated} scored · avg {d.readiness.averageScore ?? "—"}
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2 text-[10px] font-mono">
        <SummaryStat label="Blocking" value={d.policy.blockingOpen} tone={d.policy.blockingOpen > 0 ? "rose" : "zinc"} onClick={() => onNavigate?.("policy-violations")} />
        <SummaryStat label="Crit drift" value={d.drift.criticalOpen} tone={d.drift.criticalOpen > 0 ? "rose" : "zinc"} onClick={() => onNavigate?.("drift")} />
        <SummaryStat label="CP reqs" value={d.cherryPicks.requested} tone={d.cherryPicks.requested > 0 ? "amber" : "zinc"} onClick={() => onNavigate?.("cherry-picks")} />
        <SummaryStat label="Tickets" value={d.changeTickets.inFlight} tone="zinc" onClick={() => onNavigate?.("change-tickets")} />
        <SummaryStat label="Deploying" value={d.releases.deploying} tone={d.releases.deploying > 0 ? "emerald" : "zinc"} onClick={() => onNavigate?.("release-freeze")} />
      </div>
    </div>
  );
}

function SummaryStat({
  label, value, tone, onClick,
}: {
  label: string; value: number; tone: "emerald" | "amber" | "rose" | "zinc"; onClick?: () => void;
}) {
  const t = {
    emerald: "text-emerald-300",
    amber:   "text-zinc-300",
    rose:    "text-rose-300",
    zinc:    "text-zinc-300",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 p-2 hover:border-violet-500/30 transition-colors text-left"
    >
      <p className="text-[8px] font-mono uppercase tracking-wider opacity-70 mb-0.5">{label}</p>
      <p className={`text-[16px] font-bold ${t}`}>{value}</p>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Phase 498 — new-release panel (desktop sibling).
// ─────────────────────────────────────────────────────────────────

interface ApplicationOption { id: string; name: string; slug: string }

type NewReleaseState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; releaseTag: string; created: boolean }
  | { kind: "error"; message: string };

function NewReleasePanel({ onCreated }: { onCreated: () => void }) {
  const [state, setState] = useState<NewReleaseState>({ kind: "closed" });
  const [apps, setApps] = useState<ApplicationOption[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [releaseTag, setReleaseTag] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (state.kind !== "open" && state.kind !== "submitting") return;
    if (apps.length > 0 || appsLoading) return;
    setAppsLoading(true);
    fetch("/api/dashboard/application-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && Array.isArray(j.data.applications)) {
          setApps(j.data.applications.map((a: { id: string; name: string; slug: string }) => ({ id: a.id, name: a.name, slug: a.slug })));
          if (j.data.applications[0] && !applicationId) setApplicationId(j.data.applications[0].id);
        }
      })
      .finally(() => setAppsLoading(false));
  }, [state.kind, apps.length, appsLoading, applicationId]);

  function reset() {
    setApplicationId(""); setReleaseTag(""); setCommitSha(""); setWindowStart(""); setWindowEnd(""); setSummary("");
    setState({ kind: "closed" });
  }

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const body: Record<string, unknown> = { applicationId, releaseTag };
      if (commitSha) body.commitSha = commitSha;
      if (windowStart) body.plannedWindowStartIso = new Date(windowStart).toISOString();
      if (windowEnd) body.plannedWindowEndIso = new Date(windowEnd).toISOString();
      if (summary) body.summary = summary;

      const res = await fetch("/api/dashboard/release-create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", releaseTag: j.data.releaseTag, created: j.data.created });
        onCreated();
        setTimeout(reset, 1500);
      } else {
        setState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  if (state.kind === "closed") {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] text-[12px] font-semibold text-violet-200 hover:bg-violet-500/[0.16] transition-colors"
        >
          + New release
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">New release</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Application</span>
          <select
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            disabled={busy || appsLoading}
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 disabled:opacity-50"
          >
            {appsLoading ? (
              <option value="">loading…</option>
            ) : apps.length === 0 ? (
              <option value="">no applications registered</option>
            ) : (
              apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)
            )}
          </select>
        </label>
        <ReleaseField label="Release tag" value={releaseTag} onChange={setReleaseTag} placeholder="v1.2.3" disabled={busy} />
        <ReleaseField label="Commit SHA" value={commitSha} onChange={setCommitSha} placeholder="abc1234…" disabled={busy} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Planned start</span>
          <input
            type="datetime-local"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Planned end</span>
          <input
            type="datetime-local"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 disabled:opacity-50"
          />
        </label>
        <ReleaseField label="Summary" value={summary} onChange={setSummary} placeholder="Patch tuesday hotfix" disabled={busy} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !applicationId || !releaseTag}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Create draft"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">
            ✓ {state.created ? "created" : "already existed"} · {state.releaseTag}
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-[11px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

function ReleaseField({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}
