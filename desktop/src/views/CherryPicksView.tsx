import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 461 — desktop sibling for /dashboard/cherry-picks.
 *
 * Read-only inbox of cherry-pick exceptions. Approve/deny flows land
 * in a follow-on phase alongside their web counterparts.
 */

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
  requested:  "bg-white/15 text-zinc-300 border-white/25",
  approved:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  denied:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  superseded: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
  unknown:    "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",
};

export function CherryPicksView() {
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

  useEffect(() => { loadList(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cherry-pick exceptions</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Out-of-train fixes with rationale + approver decision.
          </p>
        </div>
      </div>

      <NewCherryPickPanel onCreated={loadList} />

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading exceptions…</div>}

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
        <div className="glass-card p-4 text-sm text-zinc-300 border border-white/20">Sign in required.</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Requested" value={String(data.summary.byStatus.requested)} tone={data.summary.byStatus.requested > 0 ? "amber" : "zinc"} />
            <Stat label="Approved"  value={String(data.summary.byStatus.approved)}  tone={data.summary.byStatus.approved > 0 ? "emerald" : "zinc"} />
            <Stat label="Denied"    value={String(data.summary.byStatus.denied)}    tone={data.summary.byStatus.denied > 0 ? "rose" : "zinc"} />
            <Stat label="Total"     value={String(data.summary.total)} />
          </div>

          {data.exceptions.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No cherry-pick exceptions on file.
            </div>
          ) : (
            <div className="space-y-2">
              {data.exceptions.map((e) => (
                <div key={e.id} className="glass-card p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[e.status]}`}>
                        {e.status}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">
                        {e.releaseTag ?? "(untagged)"} · {e.repositoryDisplayName ?? "(unknown repo)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                        {e.approvedCount} approved
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                        {e.excludedCount} excluded
                      </span>
                      {e.hasFinalCommitValidation && (
                        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          final ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[12px] text-zinc-300 mb-1.5 whitespace-pre-wrap">{e.rationale}</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 flex-wrap">
                    <span>requested by {e.requestedByUserId} · {new Date(e.requestedAtIso).toLocaleString()}</span>
                    {e.decidedAtIso && (
                      <span>· decided by {e.decidedByUserId} · {new Date(e.decidedAtIso).toLocaleString()}</span>
                    )}
                  </div>
                  {e.decisionReason && (
                    <p className="text-[11px] text-zinc-400 mt-1.5 italic">"{e.decisionReason}"</p>
                  )}
                  {e.status === "requested" && <DecideControls exceptionId={e.id} onDecided={loadList} />}
                  {e.status === "approved" && (
                    <ValidateControls
                      exceptionId={e.id}
                      currentlyValidated={e.hasFinalCommitValidation}
                      onChanged={loadList}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
  );
}

type DecideState =
  | { kind: "idle" }
  | { kind: "denying" }
  | { kind: "submitting"; which: "approve" | "deny" }
  | { kind: "ok"; which: "approve" | "deny" }
  | { kind: "error"; message: string };

function DecideControls({ exceptionId, onDecided }: { exceptionId: string; onDecided: () => void }) {
  const [state, setState] = useState<DecideState>({ kind: "idle" });
  const [reason, setReason] = useState("");

  async function decide(which: "approve" | "deny", reasonText?: string) {
    setState({ kind: "submitting", which });
    try {
      const res = await fetch("/api/dashboard/cherry-pick-decide", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exceptionId, decision: which, ...(reasonText ? { reason: reasonText } : {}) }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", which });
        setTimeout(onDecided, 600);
      } else {
        setState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  if (state.kind === "denying") {
    const reasonValid = reason.trim().length >= 10;
    return (
      <div className="mt-2 pt-2 border-t border-white/[0.04]">
        <span className="block text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Deny reason ({reason.trim().length}/10 min)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this exception being denied?"
          rows={2}
          className="w-full rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/40 focus:outline-none"
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            disabled={!reasonValid}
            onClick={() => decide("deny", reason.trim())}
            className="px-2 py-1 rounded border border-rose-500/40 bg-rose-500/[0.10] text-[10px] font-semibold text-rose-200 hover:bg-rose-500/[0.18] disabled:opacity-50 transition-colors"
          >
            Confirm deny
          </button>
          <button
            type="button"
            onClick={() => { setReason(""); setState({ kind: "idle" }); }}
            className="px-2 py-1 rounded border border-zinc-700/40 bg-zinc-800/40 text-[10px] text-zinc-300 hover:bg-zinc-800/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
      <button
        type="button"
        disabled={busy}
        onClick={() => decide("approve")}
        className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.15] disabled:opacity-50 transition-colors"
      >
        {state.kind === "submitting" && state.which === "approve" ? "…" : "Approve"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setState({ kind: "denying" })}
        className="px-2 py-1 rounded border border-rose-500/30 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/[0.12] disabled:opacity-50 transition-colors"
      >
        Deny…
      </button>
      {state.kind === "ok" && <span className="text-emerald-300">✓ {state.which === "approve" ? "approved" : "denied"}</span>}
      {state.kind === "error" && <span className="text-rose-300">✗ {state.message}</span>}
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
    try {
      const res = await fetch("/api/dashboard/cherry-pick-create", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId, repositoryId, rationale,
          approvedPrIds: approvedPrs.split(/[\s,]+/).filter(Boolean),
          excludedPrIds: excludedPrs.split(/[\s,]+/).filter(Boolean),
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
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.06] text-[11.5px] font-semibold text-violet-200 hover:bg-violet-500/[0.12] transition-colors"
        >
          + Request cherry-pick exception
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">New cherry-pick exception</p>
        <button type="button" onClick={reset} className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>
          cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Field label="Release ID" value={releaseId} onChange={setReleaseId} placeholder="rel_..." disabled={busy} />
        <Field label="Repository ID" value={repositoryId} onChange={setRepositoryId} placeholder="repo_..." disabled={busy} />
      </div>
      <Field
        label={`Rationale (${rationale.trim().length}/20 min)`}
        value={rationale} onChange={setRationale}
        placeholder="Explain why this scope change is needed."
        multiline disabled={busy}
      />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Field label="Approved PR IDs" value={approvedPrs} onChange={setApprovedPrs} placeholder="pr_abc, pr_def" disabled={busy} />
        <Field label="Excluded PR IDs (optional)" value={excludedPrs} onChange={setExcludedPrs} placeholder="pr_xyz" disabled={busy} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[11.5px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Submit request"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">✓ created · {state.id}</span>
        )}
        {state.kind === "error" && (
          <span className="text-[11px] font-mono text-rose-300">✗ {state.message}</span>
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
      <span className="block text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-0.5">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className="w-full rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      )}
    </label>
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

type ValidateState =
  | { kind: "idle" }
  | { kind: "submitting"; targetState: boolean }
  | { kind: "ok"; nowValidated: boolean }
  | { kind: "error"; message: string };

function ValidateControls({
  exceptionId,
  currentlyValidated,
  onChanged,
}: {
  exceptionId: string;
  currentlyValidated: boolean;
  onChanged: () => void;
}) {
  const [state, setState] = useState<ValidateState>({ kind: "idle" });

  async function flip(validated: boolean) {
    setState({ kind: "submitting", targetState: validated });
    try {
      const res = await fetch("/api/dashboard/cherry-pick-validate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exceptionId, validated }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", nowValidated: j.data.hasFinalCommitValidation });
        setTimeout(onChanged, 500);
      } else {
        setState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
      <span className="text-zinc-500 uppercase tracking-[0.18em] text-[9px]">Final-commit validation</span>
      {currentlyValidated ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => flip(false)}
          className="px-2 py-1 rounded border border-zinc-500/40 bg-zinc-500/[0.08] text-zinc-200 hover:bg-zinc-500/[0.15] disabled:opacity-50 transition-colors"
        >
          {busy && state.kind === "submitting" && !state.targetState ? "…" : "Clear validation"}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => flip(true)}
          className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.15] disabled:opacity-50 transition-colors"
        >
          {busy && state.kind === "submitting" && state.targetState ? "…" : "Confirm final commits"}
        </button>
      )}
      {state.kind === "ok" && (
        <span className="text-emerald-300">✓ now {state.nowValidated ? "validated" : "unvalidated"}</span>
      )}
      {state.kind === "error" && <span className="text-rose-300">✗ {state.message}</span>}
    </div>
  );
}
