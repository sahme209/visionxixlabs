import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 483 — desktop sibling for the web /dashboard/releases/[id]
 * overview. Left-rail release picker, right-pane summary across
 * readiness · cherry-picks · violations · tickets · evidence pack.
 */

interface ListRow { id: string; releaseTag: string | null; applicationId: string }
type ListResp = { ok: true; data: { releases: ListRow[] } } | { ok: false; error: string };

interface ReleaseData {
  id: string;
  releaseTag: string | null;
  commitSha: string | null;
  status: string;
  summary: string | null;
  scopeFinalizedAtIso: string | null;
  rollbackReferenceReleaseId: string | null;
  applicationId: string;
}
interface RepositoryData { id: string; displayName: string; provider: string }
interface ReadinessData { overallScore: number; riskLevel: string; evaluatedAtIso: string; blockerCount: number; topBlocker: string | null }
interface CherryPickRecent { id: string; status: string; rationaleSnippet: string; approvedCount: number; requestedAtIso: string }
interface ViolationRecent { id: string; ruleLabel: string; severity: string; status: string; blocking: boolean; message: string }
interface TicketItem { id: string; provider: string; externalKey: string; title: string; status: string }
interface EvidencePackData { id: string; generatedAtIso: string; signedAtIso: string | null; contentHash: string | null }

interface DetailData {
  release: ReleaseData;
  repository: RepositoryData | null;
  readiness: ReadinessData | null;
  cherryPicks: { total: number; byStatus: Record<string, number>; recent: CherryPickRecent[] };
  policyViolations: { total: number; blockingOpen: number; byStatus: Record<string, number>; recent: ViolationRecent[] };
  changeTickets: { total: number; byProvider: Record<string, number>; items: TicketItem[] };
  evidencePack: EvidencePackData | null;
}

type DetailResp = { ok: true; data: DetailData } | { ok: false; error: string; hint?: string };

const RISK_TONE: Record<string, string> = {
  low: "text-emerald-300", medium: "text-zinc-300", high: "text-orange-300", critical: "text-rose-300",
};

export function ReleaseOverviewView() {
  const [releases, setReleases] = useState<ListRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResp | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Check if a release was pre-selected via the global event-based
    // hand-off (Phase 489 — ReleasesView dispatches when a row is
    // clicked).
    const handoff = (window as unknown as { __releaseopsSelectedReleaseId?: string }).__releaseopsSelectedReleaseId;
    if (handoff) {
      setSelected(handoff);
      delete (window as unknown as { __releaseopsSelectedReleaseId?: string }).__releaseopsSelectedReleaseId;
    }
    fetch("/api/dashboard/release-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListResp) => {
        if (cancelled) return;
        if (j.ok) {
          setReleases(j.data.releases);
          // Only auto-select first if no hand-off was already applied.
          if (!handoff && j.data.releases.length > 0) setSelected(j.data.releases[0].id);
        } else setListError(j.error);
      })
      .catch((e) => { if (!cancelled) setListError(e instanceof Error ? e.message : "Network error."); });

    // Listen for further select-release dispatches while the view is mounted.
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ releaseId?: string }>;
      if (e.detail?.releaseId) setSelected(e.detail.releaseId);
    };
    window.addEventListener("releaseops:select-release", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("releaseops:select-release", handler);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingDetail(true);
    fetch(`/api/dashboard/release-detail/${encodeURIComponent(selected)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: DetailResp) => { if (!cancelled) setDetail(j); })
      .catch((e) => { if (!cancelled) setDetail({ ok: false, error: e instanceof Error ? e.message : "Network error." }); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selected]);

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Release overview</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          One screen per release — readiness, cherry-picks, violations, tickets, evidence.
        </p>
      </div>

      {listError && <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{listError}</div>}

      <div className="flex gap-4 min-h-0 flex-1">
        <aside className="w-64 shrink-0 space-y-1 overflow-y-auto">
          {releases.length === 0 ? (
            <p className="text-xs text-zinc-500 px-3 py-2">No releases yet.</p>
          ) : (
            releases.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={`w-full text-left rounded-lg px-3 py-2 transition-colors flex flex-col gap-0.5 ${
                  selected === r.id
                    ? "bg-violet-500/15 text-violet-100 border border-violet-500/30"
                    : "bg-zinc-800/40 hover:bg-zinc-800/60 text-zinc-300 border border-zinc-700/40"
                }`}
              >
                <span className="text-[12px] font-medium truncate">{r.releaseTag ?? "(no tag)"}</span>
                <span className="text-[10px] font-mono text-zinc-500 truncate">{r.applicationId}</span>
              </button>
            ))
          )}
        </aside>

        <div className="flex-1 min-w-0 overflow-y-auto space-y-3">
          {loadingDetail && <div className="glass-card p-4 text-sm text-zinc-400">Loading overview…</div>}

          {detail && !detail.ok && (
            <div className="glass-card p-4 border border-white/30">
              <p className="text-sm font-semibold text-zinc-300 mb-1">{detail.error}</p>
              {detail.hint && <p className="text-xs text-zinc-400">{detail.hint}</p>}
            </div>
          )}

          {detail?.ok && (
            <>
              {/* Header card */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">
                      {detail.data.repository?.displayName ?? detail.data.release.applicationId}
                    </p>
                    <h2 className="text-[18px] font-bold tracking-tight text-white">
                      {detail.data.release.releaseTag ?? "(untagged release)"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                      {detail.data.release.status}
                    </span>
                    {detail.data.release.commitSha && (
                      <span className="text-[9px] font-mono text-zinc-500">sha {detail.data.release.commitSha.slice(0, 10)}…</span>
                    )}
                  </div>
                </div>
                {detail.data.release.summary && (
                  <p className="text-[11.5px] text-zinc-300 italic">"{detail.data.release.summary}"</p>
                )}
                {detail.data.release.scopeFinalizedAtIso && (
                  <p className="text-[10px] font-mono text-zinc-500 mt-2">
                    Scope finalized {new Date(detail.data.release.scopeFinalizedAtIso).toLocaleString()}
                    {detail.data.release.rollbackReferenceReleaseId && (
                      <> · rollback to <span className="text-zinc-400">{detail.data.release.rollbackReferenceReleaseId}</span></>
                    )}
                  </p>
                )}
                <LifecycleControls releaseId={detail.data.release.id} currentStatus={detail.data.release.status} />
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <a
                    href={`/api/dashboard/release-evidence-export/${encodeURIComponent(detail.data.release.id)}?format=markdown`}
                    className="px-2 py-1 rounded border border-zinc-700/40 bg-zinc-800/40 text-[10px] font-mono text-zinc-200 hover:border-violet-500/30 hover:text-violet-200 transition-colors"
                    download
                  >
                    Pack .md
                  </a>
                  <a
                    href={`/api/dashboard/release-evidence-export/${encodeURIComponent(detail.data.release.id)}?format=json`}
                    className="px-2 py-1 rounded border border-zinc-700/40 bg-zinc-800/40 text-[10px] font-mono text-zinc-200 hover:border-violet-500/30 hover:text-violet-200 transition-colors"
                    download
                  >
                    Pack .json
                  </a>
                </div>
              </div>

              {/* 2x2 tile grid */}
              <div className="grid grid-cols-2 gap-3">
                <Tile title="Readiness">
                  {detail.data.readiness ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[22px] font-bold text-white">{detail.data.readiness.overallScore}</span>
                        <span className="text-[11px] text-zinc-500">/100</span>
                        <span className={`text-[10px] font-mono uppercase tracking-wider ml-1 ${RISK_TONE[detail.data.readiness.riskLevel] ?? "text-zinc-300"}`}>
                          {detail.data.readiness.riskLevel}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-zinc-500 mt-1">Evaluated {new Date(detail.data.readiness.evaluatedAtIso).toLocaleString()}</p>
                      {detail.data.readiness.topBlocker && (
                        <p className="text-[11px] text-zinc-400 italic mt-1.5">→ {detail.data.readiness.topBlocker}</p>
                      )}
                      <p className="text-[9px] font-mono text-zinc-500 mt-1">{detail.data.readiness.blockerCount} blocker{detail.data.readiness.blockerCount === 1 ? "" : "s"}</p>
                    </>
                  ) : (
                    <p className="text-[11px] text-zinc-500">No snapshot yet.</p>
                  )}
                </Tile>

                <Tile title="Policy violations">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-bold text-white">{detail.data.policyViolations.total}</span>
                    {detail.data.policyViolations.blockingOpen > 0 && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-rose-300 bg-rose-500/15 px-1 py-0.5 rounded border border-rose-500/25">
                        {detail.data.policyViolations.blockingOpen} blocking open
                      </span>
                    )}
                  </div>
                  {detail.data.policyViolations.recent.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {detail.data.policyViolations.recent.map((v) => (
                        <li key={v.id} className="text-[10.5px] text-zinc-300">
                          <span className={`font-mono uppercase tracking-wider mr-1 ${v.severity === "blocker" ? "text-rose-300" : v.severity === "warning" ? "text-zinc-300" : "text-zinc-400"}`}>
                            {v.severity}
                          </span>
                          {v.ruleLabel}
                        </li>
                      ))}
                    </ul>
                  )}
                </Tile>

                <Tile title="Cherry-picks">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-bold text-white">{detail.data.cherryPicks.total}</span>
                    <span className="text-[9px] font-mono text-zinc-500">
                      {Object.entries(detail.data.cherryPicks.byStatus).map(([k, v]) => `${k}=${v}`).join(" · ") || "—"}
                    </span>
                  </div>
                  {detail.data.cherryPicks.recent.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {detail.data.cherryPicks.recent.map((c) => (
                        <li key={c.id} className="text-[10.5px] text-zinc-300">
                          <span className="font-mono uppercase tracking-wider text-zinc-400 mr-1">{c.status}</span>
                          {c.rationaleSnippet}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-zinc-500 mt-1.5">No cherry-picks.</p>
                  )}
                </Tile>

                <Tile title="Change tickets">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-bold text-white">{detail.data.changeTickets.total}</span>
                    <span className="text-[9px] font-mono text-zinc-500">
                      {Object.entries(detail.data.changeTickets.byProvider).map(([k, v]) => `${k}=${v}`).join(" · ") || "—"}
                    </span>
                  </div>
                  {detail.data.changeTickets.items.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {detail.data.changeTickets.items.slice(0, 3).map((t) => (
                        <li key={t.id} className="text-[10.5px] text-zinc-300">
                          <span className="font-mono text-zinc-400 mr-1">{t.provider}:{t.externalKey}</span>
                          {t.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-zinc-500 mt-1.5">No tickets linked.</p>
                  )}
                </Tile>
              </div>

              <ActivityTimeline releaseId={detail.data.release.id} />

              {/* Evidence pack footer */}
              <div className="glass-card p-3">
                <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Evidence pack</p>
                {detail.data.evidencePack ? (
                  <p className="text-[11px] text-zinc-300">
                    Generated {new Date(detail.data.evidencePack.generatedAtIso).toLocaleString()}
                    {detail.data.evidencePack.signedAtIso && <> · sealed</>}
                    {detail.data.evidencePack.contentHash && <span className="font-mono text-zinc-500"> · sha {detail.data.evidencePack.contentHash.slice(0, 14)}…</span>}
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500">No pack generated yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ViewShell>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-3">
      <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">{title}</p>
      {children}
    </div>
  );
}

interface TimelineEvent {
  kind: string;
  atIso: string;
  actorUserId: string | null;
  summary: string;
  tone: "info" | "success" | "warning" | "danger";
}

interface TimelineData {
  releaseId: string;
  events: TimelineEvent[];
}

type TimelineRespBody = { ok: true; data: TimelineData } | { ok: false; error: string; hint?: string };

const TONE_DOT: Record<TimelineEvent["tone"], string> = {
  info:    "bg-zinc-400",
  success: "bg-emerald-400",
  warning: "bg-zinc-400",
  danger:  "bg-rose-400",
};

function ActivityTimeline({ releaseId }: { releaseId: string }) {
  const [resp, setResp] = useState<TimelineRespBody | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/release-activity/${encodeURIComponent(releaseId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: TimelineRespBody) => { if (!cancelled) setResp(j); })
      .catch(() => { /* swallow */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [releaseId]);

  if (loading) return <div className="glass-card p-3 text-[11px] text-zinc-500">Loading activity…</div>;
  if (!resp?.ok || resp.data.events.length === 0) return null;

  return (
    <div className="glass-card p-3">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">Activity timeline</p>
        <span className="text-[9px] font-mono text-zinc-500">{resp.data.events.length} events</span>
      </div>
      <ol className="space-y-2">
        {resp.data.events.map((e, idx) => (
          <li key={idx} className="flex gap-2">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TONE_DOT[e.tone]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-zinc-200">{e.summary}</p>
              <p className="text-[9px] font-mono text-zinc-500 mt-0.5">
                {new Date(e.atIso).toLocaleString()}
                {e.actorUserId && <span> · {e.actorUserId}</span>}
                <span className="text-zinc-600"> · {e.kind}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

type LifecycleAction = "finalize_scope" | "start_deploy" | "complete_deploy" | "mark_rolled_back" | "mark_failed";

type LifecycleState =
  | { kind: "idle" }
  | { kind: "submitting"; action: LifecycleAction }
  | { kind: "ok"; previousStatus: string; status: string }
  | { kind: "error"; message: string };

function LifecycleControls({ releaseId, currentStatus }: { releaseId: string; currentStatus: string }) {
  const [state, setState] = useState<LifecycleState>({ kind: "idle" });

  async function trigger(action: LifecycleAction) {
    setState({ kind: "submitting", action });
    try {
      const res = await fetch("/api/dashboard/release-lifecycle", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId, action }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", previousStatus: j.data.previousStatus, status: j.data.status });
        // Trigger overview reload by re-dispatching the select event.
        setTimeout(() => window.dispatchEvent(new CustomEvent("releaseops:select-release", { detail: { releaseId } })), 400);
      } else {
        setState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  const busy = state.kind === "submitting";
  const buttons: Array<{ action: LifecycleAction; label: string; tone: string }> = [];
  if (currentStatus === "draft") {
    buttons.push({ action: "finalize_scope", label: "Finalize scope", tone: "border-violet-500/40 bg-violet-500/[0.12] text-violet-100" });
  }
  if (currentStatus === "ready") {
    buttons.push({ action: "start_deploy", label: "Start deploy", tone: "border-emerald-500/40 bg-emerald-500/[0.12] text-emerald-100" });
    buttons.push({ action: "mark_failed",  label: "Mark failed",  tone: "border-rose-500/40 bg-rose-500/[0.08] text-rose-200" });
  }
  if (currentStatus === "deploying") {
    buttons.push({ action: "complete_deploy",  label: "Complete deploy",  tone: "border-emerald-500/40 bg-emerald-500/[0.12] text-emerald-100" });
    buttons.push({ action: "mark_rolled_back", label: "Mark rolled back", tone: "border-white/40 bg-white/[0.10] text-zinc-200" });
    buttons.push({ action: "mark_failed",      label: "Mark failed",      tone: "border-rose-500/40 bg-rose-500/[0.08] text-rose-200" });
  }
  if (currentStatus === "deployed") {
    buttons.push({ action: "mark_rolled_back", label: "Mark rolled back", tone: "border-white/40 bg-white/[0.10] text-zinc-200" });
  }

  if (buttons.length === 0) {
    return (
      <div className="mt-2 text-[10px] font-mono text-zinc-500">
        Status <span className="text-zinc-300">{currentStatus}</span> is terminal.
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
      <span className="text-zinc-500 uppercase tracking-[0.18em] text-[9px]">Lifecycle</span>
      {buttons.map((b) => (
        <button
          key={b.action}
          type="button"
          disabled={busy}
          onClick={() => trigger(b.action)}
          className={`px-2.5 py-1 rounded border font-semibold ${b.tone} hover:brightness-110 disabled:opacity-50 disabled:cursor-wait transition-all`}
        >
          {busy && state.kind === "submitting" && state.action === b.action ? "…" : b.label}
        </button>
      ))}
      {state.kind === "ok" && (
        <span className="text-emerald-300">✓ {state.previousStatus} → {state.status}</span>
      )}
      {state.kind === "error" && <span className="text-rose-300">✗ {state.message}</span>}
    </div>
  );
}
