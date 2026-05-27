"use client";

/**
 * /dashboard/releases/[id] — Phase 482.
 * Per-release overview: metadata + readiness + cherry-picks +
 * policy violations + tickets + evidence pack, in one screen.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface ReleaseData {
  id: string;
  releaseTag: string | null;
  commitSha: string | null;
  status: string;
  scopeFinalizedAtIso: string | null;
  scopeFinalizedByUserId: string | null;
  plannedWindowStartIso: string | null;
  plannedWindowEndIso: string | null;
  actualDeployStartIso: string | null;
  actualDeployEndIso: string | null;
  rollbackReferenceReleaseId: string | null;
  summary: string | null;
  createdAtIso: string;
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

type RespBody = { ok: true; data: DetailData } | { ok: false; error: string; hint?: string };

const RISK_TONE: Record<string, string> = {
  low: "text-emerald-300", medium: "text-amber-300", high: "text-orange-300", critical: "text-rose-300",
};

export default function ReleaseOverviewPage() {
  const params = useParams();
  const search = useSearchParams();
  const releaseId = String(params.id);
  const repositoryId = search.get("repositoryId") ?? "";

  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `/api/dashboard/release-detail/${encodeURIComponent(releaseId)}${repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : ""}`;
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [releaseId, repositoryId]);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <div className="mb-4">
        <Link href="/dashboard/releases" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          All releases
        </Link>
      </div>

      {loading && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-[12px] text-zinc-400">Loading release overview…</div>}
      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">{networkError}</div>
      )}
      {!loading && errorBody && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5">
          <p className="text-[12px] font-semibold text-amber-200">{errorBody.error}</p>
          {errorBody.hint && <p className="text-[12.5px] text-zinc-300 mt-1">{errorBody.hint}</p>}
        </div>
      )}

      {data && (
        <>
          {/* Header */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  {data.repository?.displayName ?? data.release.applicationId}
                </p>
                <h1 className="text-[24px] font-bold tracking-tight text-white">
                  {data.release.releaseTag ?? "(untagged release)"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                  {data.release.status}
                </span>
                {data.release.commitSha && (
                  <span className="text-[10px] font-mono text-zinc-500">sha {data.release.commitSha.slice(0, 12)}…</span>
                )}
              </div>
            </div>
            {data.release.summary && (
              <p className="text-[12.5px] text-zinc-300 mt-2 italic">"{data.release.summary}"</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-[11px] font-mono text-zinc-400">
              {data.release.scopeFinalizedAtIso && (
                <Field label="Scope finalized" value={`${new Date(data.release.scopeFinalizedAtIso).toLocaleString()} · by ${data.release.scopeFinalizedByUserId ?? "system"}`} />
              )}
              {data.release.plannedWindowStartIso && (
                <Field label="Planned window" value={`${new Date(data.release.plannedWindowStartIso).toLocaleString()} → ${data.release.plannedWindowEndIso ? new Date(data.release.plannedWindowEndIso).toLocaleString() : "—"}`} />
              )}
              {data.release.actualDeployStartIso && (
                <Field label="Actual deploy" value={`${new Date(data.release.actualDeployStartIso).toLocaleString()} → ${data.release.actualDeployEndIso ? new Date(data.release.actualDeployEndIso).toLocaleString() : "—"}`} />
              )}
              {data.release.rollbackReferenceReleaseId && (
                <Field label="Rollback to" value={data.release.rollbackReferenceReleaseId} />
              )}
            </div>
            <LifecycleControls releaseId={releaseId} currentStatus={data.release.status} />

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Link href={`/dashboard/releases/${releaseId}/branch${repositoryId ? `?repositoryId=${repositoryId}` : ""}`} className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] text-[11.5px] font-semibold text-violet-200 hover:bg-violet-500/[0.15] transition-colors">
                Open branch validation →
              </Link>
              <Link href={`/api/dashboard/release-evidence-export/${releaseId}?format=markdown`} className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11.5px] font-mono text-zinc-200 hover:border-violet-500/30 transition-colors" download>
                Evidence pack .md
              </Link>
              <Link href={`/api/dashboard/release-evidence-export/${releaseId}?format=json`} className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11.5px] font-mono text-zinc-200 hover:border-violet-500/30 transition-colors" download>
                Evidence pack .json
              </Link>
            </div>
          </div>

          {/* 4-tile grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Tile title="Readiness">
              {data.readiness ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[28px] font-bold text-white">{data.readiness.overallScore}</span>
                    <span className="text-[14px] text-zinc-500">/100</span>
                    <span className={`text-[11px] font-mono uppercase tracking-wider ml-2 ${RISK_TONE[data.readiness.riskLevel] ?? "text-zinc-300"}`}>
                      {data.readiness.riskLevel} risk
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 mt-1">Evaluated {new Date(data.readiness.evaluatedAtIso).toLocaleString()}</p>
                  {data.readiness.topBlocker && (
                    <p className="text-[11.5px] text-zinc-400 italic mt-2">→ {data.readiness.topBlocker}</p>
                  )}
                  <p className="text-[10px] font-mono text-zinc-500 mt-1">{data.readiness.blockerCount} blocker{data.readiness.blockerCount === 1 ? "" : "s"}</p>
                </>
              ) : (
                <p className="text-[12px] text-zinc-500">No readiness snapshot yet. Hit "Re-evaluate readiness" on the branch validation page.</p>
              )}
            </Tile>

            <Tile title="Policy violations">
              <div className="flex items-baseline gap-3">
                <span className="text-[28px] font-bold text-white">{data.policyViolations.total}</span>
                {data.policyViolations.blockingOpen > 0 && (
                  <span className="text-[11px] font-mono uppercase tracking-wider text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/25">
                    {data.policyViolations.blockingOpen} blocking open
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-zinc-500 mt-1">
                {Object.entries(data.policyViolations.byStatus).map(([k, v]) => `${k}=${v}`).join(" · ") || "—"}
              </p>
              {data.policyViolations.recent.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {data.policyViolations.recent.map((v) => (
                    <li key={v.id} className="text-[11px] text-zinc-300">
                      <span className={`font-mono uppercase tracking-wider mr-1.5 ${v.severity === "blocker" ? "text-rose-300" : v.severity === "warning" ? "text-amber-300" : "text-zinc-400"}`}>{v.severity}</span>
                      {v.ruleLabel} — <span className="text-zinc-500">{v.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Tile>

            <Tile title="Cherry-picks">
              <div className="flex items-baseline gap-3">
                <span className="text-[28px] font-bold text-white">{data.cherryPicks.total}</span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {Object.entries(data.cherryPicks.byStatus).map(([k, v]) => `${k}=${v}`).join(" · ") || "—"}
                </span>
              </div>
              {data.cherryPicks.recent.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {data.cherryPicks.recent.map((c) => (
                    <li key={c.id} className="text-[11px] text-zinc-300">
                      <span className="font-mono uppercase tracking-wider text-zinc-400 mr-1.5">{c.status}</span>
                      {c.rationaleSnippet} <span className="text-zinc-500">· {c.approvedCount} PR</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11.5px] text-zinc-500 mt-2">No cherry-picks on file.</p>
              )}
            </Tile>

            <Tile title="Change tickets">
              <div className="flex items-baseline gap-3">
                <span className="text-[28px] font-bold text-white">{data.changeTickets.total}</span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {Object.entries(data.changeTickets.byProvider).map(([k, v]) => `${k}=${v}`).join(" · ") || "—"}
                </span>
              </div>
              {data.changeTickets.items.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {data.changeTickets.items.map((t) => (
                    <li key={t.id} className="text-[11px] text-zinc-300">
                      <span className="font-mono text-zinc-400 mr-1.5">{t.provider}:{t.externalKey}</span>
                      {t.title} <span className="text-zinc-500">· {t.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11.5px] text-zinc-500 mt-2">No tickets linked.</p>
              )}
            </Tile>
          </div>

          <ActivityTimeline releaseId={releaseId} />

          {/* Evidence pack footer */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-8">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Evidence pack</p>
                {data.evidencePack ? (
                  <p className="text-[12px] text-zinc-300 mt-1">
                    Generated {new Date(data.evidencePack.generatedAtIso).toLocaleString()}
                    {data.evidencePack.signedAtIso && <> · sealed {new Date(data.evidencePack.signedAtIso).toLocaleString()}</>}
                    {data.evidencePack.contentHash && <span className="font-mono text-zinc-500"> · sha {data.evidencePack.contentHash.slice(0, 16)}…</span>}
                  </p>
                ) : (
                  <p className="text-[12px] text-zinc-500 mt-1">No pack generated yet. Hit "Generate / refresh pack" on the branch validation page.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider opacity-60 mb-0.5">{label}</p>
      <p className="text-zinc-300">{value}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Phase 488 — Activity timeline.
   ────────────────────────────────────────────────────────────── */

interface TimelineEvent {
  kind: string;
  atIso: string;
  actorUserId: string | null;
  summary: string;
  tone: "info" | "success" | "warning" | "danger";
}

interface TimelineData {
  releaseId: string;
  releaseTag: string | null;
  events: TimelineEvent[];
  summary: { total: number; byKind: Record<string, number> };
}

type TimelineRespBody = { ok: true; data: TimelineData } | { ok: false; error: string; hint?: string };

const TONE_DOT: Record<TimelineEvent["tone"], string> = {
  info:    "bg-zinc-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger:  "bg-rose-400",
};

const TONE_BORDER: Record<TimelineEvent["tone"], string> = {
  info:    "border-zinc-500/40",
  success: "border-emerald-500/40",
  warning: "border-amber-500/40",
  danger:  "border-rose-500/40",
};

function ActivityTimeline({ releaseId }: { releaseId: string }) {
  const [resp, setResp] = useState<TimelineRespBody | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/release-activity/${encodeURIComponent(releaseId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: TimelineRespBody) => { if (!cancelled) setResp(j); })
      .catch(() => { /* swallow — surface is optional */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [releaseId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6 text-[12px] text-zinc-500">
        Loading activity…
      </div>
    );
  }

  if (!resp?.ok || resp.data.events.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Activity timeline</p>
        <span className="text-[10px] font-mono text-zinc-500">{resp.data.events.length} events</span>
      </div>
      <ol className="space-y-3">
        {resp.data.events.map((e, idx) => (
          <li key={idx} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span className={`w-2 h-2 rounded-full mt-1.5 ${TONE_DOT[e.tone]}`} />
              {idx < resp.data.events.length - 1 && (
                <span className={`flex-1 w-px mt-1 ${TONE_BORDER[e.tone]}`} />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-2">
              <p className="text-[12px] text-zinc-200">{e.summary}</p>
              <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
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

/* ──────────────────────────────────────────────────────────────────
   Phase 491 — Release lifecycle controls.
   draft → ready → deploying → deployed (rollback/fail off either of
   the last two). Buttons appear only for the legal transition from
   the current status.
   ────────────────────────────────────────────────────────────── */

type LifecycleAction = "finalize_scope" | "start_deploy" | "complete_deploy" | "mark_rolled_back" | "mark_failed";

type LifecycleState =
  | { kind: "idle" }
  | { kind: "submitting"; action: LifecycleAction }
  | { kind: "ok"; previousStatus: string; status: string; action: LifecycleAction }
  | { kind: "error"; message: string };

function LifecycleControls({ releaseId, currentStatus }: { releaseId: string; currentStatus: string }) {
  const [state, setState] = useState<LifecycleState>({ kind: "idle" });

  async function trigger(action: LifecycleAction) {
    setState({ kind: "submitting", action });
    try {
      const res = await fetch("/api/dashboard/release-lifecycle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId, action }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", previousStatus: j.data.previousStatus, status: j.data.status, action });
        setTimeout(() => window.location.reload(), 600);
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
    buttons.push({ action: "mark_rolled_back", label: "Mark rolled back", tone: "border-amber-500/40 bg-amber-500/[0.10] text-amber-200" });
    buttons.push({ action: "mark_failed",      label: "Mark failed",      tone: "border-rose-500/40 bg-rose-500/[0.08] text-rose-200" });
  }
  if (currentStatus === "deployed") {
    buttons.push({ action: "mark_rolled_back", label: "Mark rolled back", tone: "border-amber-500/40 bg-amber-500/[0.10] text-amber-200" });
  }

  if (buttons.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-[11px] font-mono text-zinc-500">
        Status <span className="text-zinc-300">{currentStatus}</span> is terminal — no further lifecycle actions.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex items-center gap-2 flex-wrap text-[11.5px] font-mono">
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Lifecycle</span>
      {buttons.map((b) => (
        <button
          key={b.action}
          type="button"
          disabled={busy}
          onClick={() => trigger(b.action)}
          className={`px-3 py-1.5 rounded-lg border font-semibold ${b.tone} hover:brightness-110 disabled:opacity-50 disabled:cursor-wait transition-all`}
        >
          {busy && state.kind === "submitting" && state.action === b.action ? "submitting…" : b.label}
        </button>
      ))}
      {state.kind === "ok" && (
        <span className="text-emerald-300 text-[11px]">
          ✓ {state.previousStatus} → {state.status}
        </span>
      )}
      {state.kind === "error" && (
        <span className="text-rose-300 text-[11px]">✗ {state.message}</span>
      )}
    </div>
  );
}
