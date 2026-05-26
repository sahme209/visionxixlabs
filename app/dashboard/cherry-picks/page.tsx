"use client";

/**
 * /dashboard/cherry-picks — Phase 461.
 * Inbox of cherry-pick exception requests: status, rationale,
 * approved/excluded PR counts, requester, decision.
 */

import { useEffect, useState } from "react";
import {
  ScissorsIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Status = "requested" | "approved" | "denied" | "superseded" | "unknown";

interface Row {
  id: string;
  releaseId: string;
  releaseTag: string | null;
  applicationId: string | null;
  repositoryId: string;
  repositoryDisplayName: string | null;
  status: Status;
  rationale: string;
  approvedCount: number;
  excludedCount: number;
  hasFinalCommitValidation: boolean;
  requestedByUserId: string;
  requestedAtIso: string;
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionReason: string | null;
}

interface DigestData {
  generatedAt: string;
  exceptions: Row[];
  summary: { total: number; byStatus: Record<Status, number> };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  requested:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  approved:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  denied:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  superseded: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
  unknown:    "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
};

export default function CherryPicksPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/cherry-pick-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadList();
  }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · cherry-pick exceptions${data ? ` · ${data.summary.total} on file` : ""}`}
        title={<>Out-of-train fixes. <span className="text-zinc-500">With paperwork.</span></>}
        description="When a release ships commits that aren't in the next-prod baseline, the operator must request an exception. Approvers see exactly which PRs were cherry-picked and why."
        helps="Open exceptions show pending approver work. Approved rows feed evidence packs."
        connectFirst="Cherry-pick exceptions are created from the release readiness pane when a non-FF diff is detected."
        engineers={["Release Captain", "Release Approvers", "Security"]}
        requiresApproval="Approving a cherry-pick is a 2-person rule: requester and approver must be different operators."
        actions={[
          { label: "Releases",   href: "/dashboard/releases" },
          { label: "Activity",   href: "/dashboard/activity" },
        ]}
        safetyNote="Per-org isolation · approved exceptions land in audit log + evidence pack"
      />

      <NewCherryPickPanel onCreated={loadList} />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading cherry-pick exceptions…
        </div>
      )}

      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
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
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={ClockIcon}              label="Requested"  value={String(data.summary.byStatus.requested)} tone={data.summary.byStatus.requested > 0 ? "amber" : "zinc"} />
            <Stat icon={CheckCircleIcon}        label="Approved"   value={String(data.summary.byStatus.approved)}  tone={data.summary.byStatus.approved > 0 ? "emerald" : "zinc"} />
            <Stat icon={XCircleIcon}            label="Denied"     value={String(data.summary.byStatus.denied)}    tone={data.summary.byStatus.denied > 0 ? "rose" : "zinc"} />
            <Stat icon={ScissorsIcon}           label="Total"      value={String(data.summary.total)}              tone="zinc" />
          </div>

          {data.exceptions.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No cherry-pick exceptions on file. Clean release trains are the goal.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.exceptions.map((e) => (
                <div key={e.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[e.status]}`}>
                        {e.status}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">
                        {e.releaseTag ?? "(untagged)"} <span className="text-zinc-500">·</span> {e.repositoryDisplayName ?? "(unknown repo)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                        {e.approvedCount} approved
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/[0.08]">
                        {e.excludedCount} excluded
                      </span>
                      {e.hasFinalCommitValidation && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          final commits ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[12px] text-zinc-300 mb-2 whitespace-pre-wrap">{e.rationale}</p>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                    <span>requested by {e.requestedByUserId} · {new Date(e.requestedAtIso).toLocaleString()}</span>
                    {e.decidedAtIso && (
                      <span>· decided by {e.decidedByUserId} · {new Date(e.decidedAtIso).toLocaleString()}</span>
                    )}
                  </div>
                  {e.decisionReason && (
                    <p className="text-[11.5px] text-zinc-400 mt-2 italic">"{e.decisionReason}"</p>
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

type SubmitState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; id: string }
  | { kind: "error"; message: string };

function NewCherryPickPanel({ onCreated }: { onCreated: () => void }) {
  const [state, setState] = useState<SubmitState>({ kind: "closed" });
  const [releaseId, setReleaseId] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [rationale, setRationale] = useState("");
  const [approvedPrs, setApprovedPrs] = useState("");
  const [excludedPrs, setExcludedPrs] = useState("");

  const open = state.kind !== "closed";
  function reset() {
    setReleaseId(""); setRepositoryId(""); setRationale(""); setApprovedPrs(""); setExcludedPrs("");
    setState({ kind: "closed" });
  }

  async function submit() {
    setState({ kind: "submitting" });
    const approved = approvedPrs.split(/[\s,]+/).filter(Boolean);
    const excluded = excludedPrs.split(/[\s,]+/).filter(Boolean);
    try {
      const res = await fetch("/api/dashboard/cherry-pick-create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId, repositoryId, rationale,
          approvedPrIds: approved, excludedPrIds: excluded,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", id: j.data.id });
        onCreated();
        setTimeout(reset, 1200);
      } else {
        setState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  if (!open) {
    return (
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.06] text-[12px] font-semibold text-violet-200 hover:bg-violet-500/[0.12] transition-colors"
        >
          + Request cherry-pick exception
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-violet-500/[0.18] bg-violet-500/[0.03] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100">New cherry-pick exception</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>
          cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Release ID" value={releaseId} onChange={setReleaseId} placeholder="rel_..." disabled={busy} />
        <Field label="Repository ID" value={repositoryId} onChange={setRepositoryId} placeholder="repo_..." disabled={busy} />
      </div>
      <Field
        label={`Rationale (${rationale.trim().length}/20 min)`}
        value={rationale}
        onChange={setRationale}
        placeholder="Explain why this scope change is needed — operator + approver both read this."
        multiline
        disabled={busy}
      />
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="Approved PR IDs (comma/space-separated)" value={approvedPrs} onChange={setApprovedPrs} placeholder="pr_abc, pr_def" disabled={busy} />
        <Field label="Excluded PR IDs (optional)" value={excludedPrs} onChange={setExcludedPrs} placeholder="pr_xyz" disabled={busy} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Submit request"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">✓ created · {state.id}</span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      )}
    </label>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ScissorsIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
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
