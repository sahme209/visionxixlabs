import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 460 — desktop sibling for the web branch-validation detail.
 *
 * On the web, branch validation is a per-release detail page
 * (/dashboard/releases/[id]/branch). On the desktop runtime, we show
 * the first release's branch validation by default. A future phase
 * lifts the release-picker into the desktop sidebar like /releases.
 */

interface ListRow { id: string; releaseTag: string | null; applicationId: string }
type ListResp = { ok: true; data: { releases: ListRow[] } } | { ok: false; error: string };

interface ViewRow { key: string; label: string; state: "pass" | "fail" | "not_applicable" | "unknown"; detail: string }
interface DetailData {
  generatedAt: string;
  releaseId: string;
  repositoryDisplayName: string;
  releaseTag: string | null;
  headPrNumber: number | null;
  checks: ViewRow[];
  summary: { total: number; passing: number; failing: number; notApplicable: number; unknown: number };
}

type DetailResp = { ok: true; data: DetailData } | { ok: false; error: string; hint?: string };

const STATE_TONE: Record<ViewRow["state"], string> = {
  pass: "text-emerald-300", fail: "text-rose-300",
  not_applicable: "text-zinc-500", unknown: "text-amber-300",
};

export function BranchValidationView() {
  const [releases, setReleases] = useState<ListRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResp | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load release list first; the desktop runtime doesn't have a /releases/[id]
  // router so we render a left-rail picker.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/release-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListResp) => {
        if (cancelled) return;
        if (j.ok) {
          setReleases(j.data.releases);
          if (j.data.releases.length > 0) setSelected(j.data.releases[0].id);
        } else setListError(j.error);
      })
      .catch((e) => { if (!cancelled) setListError(e instanceof Error ? e.message : "Network error."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    // The branch-detail endpoint needs a repositoryId. On desktop we don't
    // have a direct release → repository projection yet (Phase A+1 lands
    // it on the release row), so we skip the call and show a friendly
    // explainer.
    setLoadingDetail(true);
    fetch(`/api/dashboard/release-branch-detail/${encodeURIComponent(selected)}?repositoryId=`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: DetailResp) => { if (!cancelled) setDetail(j); })
      .catch((e) => { if (!cancelled) setDetail({ ok: false, error: e instanceof Error ? e.message : "Network error." }); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selected]);

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Branch validation</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          18 checks per release. Pass / fail / N/A / unknown.
        </p>
      </div>

      {listError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{listError}</div>
      )}

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
          {loadingDetail && <div className="glass-card p-4 text-sm text-zinc-400">Loading branch validation…</div>}
          {detail && !detail.ok && (
            <div className="glass-card p-4 border border-amber-500/30">
              <p className="text-sm font-semibold text-amber-300 mb-1">{detail.error}</p>
              {detail.hint && <p className="text-xs text-zinc-400">{detail.hint}</p>}
              {detail.error === "invalid_payload" && (
                <p className="text-xs text-zinc-400 mt-2">
                  Desktop branch-detail needs a release→repository projection that lands in a follow-on phase.
                  In the meantime, open this release on the web dashboard for the full check breakdown.
                </p>
              )}
            </div>
          )}
          {detail?.ok && (
            <>
              <EvidencePackButton releaseId={detail.data.releaseId} />
              <div className="grid grid-cols-4 gap-3">
                <Stat label="Passing"  value={String(detail.data.summary.passing)}        tone="emerald" />
                <Stat label="Failing"  value={String(detail.data.summary.failing)}        tone={detail.data.summary.failing > 0 ? "rose" : "zinc"} />
                <Stat label="N/A"      value={String(detail.data.summary.notApplicable)}  tone="zinc" />
                <Stat label="Unknown"  value={String(detail.data.summary.unknown)}        tone={detail.data.summary.unknown > 0 ? "amber" : "zinc"} />
              </div>
              <div className="space-y-2">
                {detail.data.checks.map((c) => (
                  <div key={c.key} className="glass-card p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white">{c.label}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{c.detail}</p>
                    </div>
                    <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${STATE_TONE[c.state]}`}>
                      {c.state.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
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

type EvidenceOutcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; contentHash: string; prCount: number; cherryPickCount: number; linkedTicketCount: number }
  | { kind: "error"; message: string };

function EvidencePackButton({ releaseId }: { releaseId: string }) {
  const [outcome, setOutcome] = useState<EvidenceOutcome>({ kind: "idle" });

  async function trigger() {
    setOutcome({ kind: "running" });
    try {
      const res = await fetch("/api/dashboard/release-evidence-generate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId }),
      });
      const j = await res.json();
      if (j.ok) {
        setOutcome({
          kind: "ok",
          contentHash: j.data.contentHash,
          prCount: j.data.summary.prCount,
          cherryPickCount: j.data.summary.cherryPickCount,
          linkedTicketCount: j.data.summary.linkedTicketCount,
        });
      } else {
        setOutcome({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setOutcome({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  const busy = outcome.kind === "running";
  const exportUrl = (fmt: "json" | "markdown") =>
    `/api/dashboard/release-evidence-export/${encodeURIComponent(releaseId)}?format=${fmt}`;
  return (
    <div className="glass-card p-3 border border-violet-500/20 flex items-center gap-2 flex-wrap text-[11px] font-mono">
      <span className="text-violet-300/70 uppercase tracking-[0.18em] text-[9px]">Evidence pack</span>
      <button
        type="button"
        disabled={busy}
        onClick={trigger}
        className="px-2.5 py-1 rounded border border-violet-500/40 bg-violet-500/[0.12] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        {busy ? "Generating…" : "Generate / refresh"}
      </button>
      <a
        href={exportUrl("markdown")}
        className="px-2.5 py-1 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-200 hover:border-violet-500/30 hover:text-violet-200 transition-colors"
        download
      >
        .md
      </a>
      <a
        href={exportUrl("json")}
        className="px-2.5 py-1 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-200 hover:border-violet-500/30 hover:text-violet-200 transition-colors"
        download
      >
        .json
      </a>
      {outcome.kind === "ok" && (
        <span className="text-emerald-300">
          ✓ {outcome.prCount} PRs · {outcome.cherryPickCount} cherry · {outcome.linkedTicketCount} tickets · sha {outcome.contentHash.slice(0, 12)}…
        </span>
      )}
      {outcome.kind === "error" && <span className="text-rose-300">✗ {outcome.message}</span>}
    </div>
  );
}
