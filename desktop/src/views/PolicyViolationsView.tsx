import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 477 — desktop sibling for /dashboard/policy-violations.
 */

type Status = "open" | "exception_pending" | "exception_granted" | "resolved" | "unknown";
type Severity = "advisory" | "warning" | "blocker" | "unknown";

interface Row {
  id: string;
  releaseId: string;
  ruleKey: string;
  ruleLabel: string;
  severity: Severity;
  blocking: boolean;
  exceptionAllowed: boolean;
  status: Status;
  message: string;
  remediation: string | null;
  detectedAtIso: string;
  exceptionGrantedByUserId: string | null;
  exceptionGrantedAtIso: string | null;
}

interface DigestData {
  generatedAt: string;
  violations: Row[];
  summary: {
    total: number;
    byStatus: Record<Status, number>;
    bySeverity: Record<Severity, number>;
    blockingOpen: number;
  };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  open:               "bg-rose-500/15 text-rose-300 border-rose-500/25",
  exception_pending:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  exception_granted:  "bg-violet-500/15 text-violet-300 border-violet-500/25",
  resolved:           "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:            "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

const SEVERITY_CLASS: Record<Severity, string> = {
  blocker:  "bg-rose-500/15 text-rose-300 border-rose-500/25",
  warning:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  advisory: "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

export function PolicyViolationsView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/policy-violation-list", { credentials: "include" })
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
      <div>
        <h1 className="text-xl font-bold tracking-tight">Policy violations</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Engine output. Blockers stop a release; warnings flag drift.
        </p>
      </div>

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading violations…</div>}

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
        <div className="glass-card p-4 text-sm text-amber-300 border border-amber-500/20">Sign in required.</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Blocking · open"   value={String(data.summary.blockingOpen)} tone={data.summary.blockingOpen > 0 ? "rose" : "zinc"} />
            <Stat label="Exception pending" value={String(data.summary.byStatus.exception_pending)} tone={data.summary.byStatus.exception_pending > 0 ? "amber" : "zinc"} />
            <Stat label="Exception granted" value={String(data.summary.byStatus.exception_granted)} tone={data.summary.byStatus.exception_granted > 0 ? "violet" : "zinc"} />
            <Stat label="Resolved"          value={String(data.summary.byStatus.resolved)} tone={data.summary.byStatus.resolved > 0 ? "emerald" : "zinc"} />
          </div>

          {data.violations.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No policy violations on file.
            </div>
          ) : (
            <div className="space-y-2">
              {data.violations.map((v) => (
                <div key={v.id} className="glass-card p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${SEVERITY_CLASS[v.severity]}`}>
                        {v.severity}
                      </span>
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[v.status]}`}>
                        {v.status.replace("_", " ")}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">{v.ruleLabel}</p>
                      <span className="text-[10px] font-mono text-zinc-500">{v.ruleKey}</span>
                    </div>
                    {v.blocking && (
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25 shrink-0">
                        blocking
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-zinc-300 mb-1.5 whitespace-pre-wrap">{v.message}</p>
                  {v.remediation && (
                    <p className="text-[11px] text-violet-300 italic mb-1.5">→ {v.remediation}</p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 flex-wrap">
                    <span>release {v.releaseId.slice(0, 12)}</span>
                    <span>· detected {new Date(v.detectedAtIso).toLocaleString()}</span>
                  </div>
                  {v.status === "open" && (
                    <DecideControls violationId={v.id} exceptionAllowed={v.exceptionAllowed} onDecided={loadList} />
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

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "violet" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    violet:  "border-violet-500/20 text-violet-200",
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

type DecideState =
  | { kind: "idle" }
  | { kind: "granting" }
  | { kind: "submitting"; which: "grant_exception" | "resolve" }
  | { kind: "ok"; which: "grant_exception" | "resolve" }
  | { kind: "error"; message: string };

function DecideControls({
  violationId,
  exceptionAllowed,
  onDecided,
}: {
  violationId: string;
  exceptionAllowed: boolean;
  onDecided: () => void;
}) {
  const [state, setState] = useState<DecideState>({ kind: "idle" });
  const [reason, setReason] = useState("");

  async function decide(which: "grant_exception" | "resolve", reasonText?: string) {
    setState({ kind: "submitting", which });
    try {
      const res = await fetch("/api/dashboard/policy-violation-decide", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ violationId, action: which, ...(reasonText ? { reason: reasonText } : {}) }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", which });
        setTimeout(onDecided, 500);
      } else {
        setState({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  if (state.kind === "granting") {
    const valid = reason.trim().length >= 10;
    return (
      <div className="mt-2 pt-2 border-t border-white/[0.04]">
        <span className="block text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
          Exception rationale ({reason.trim().length}/10 min)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this exception justified?"
          rows={2}
          className="w-full rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none"
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            disabled={!valid}
            onClick={() => decide("grant_exception", reason.trim())}
            className="px-2 py-1 rounded border border-violet-500/40 bg-violet-500/[0.12] text-[10px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 transition-colors"
          >
            Confirm exception
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
      {exceptionAllowed && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setState({ kind: "granting" })}
          className="px-2 py-1 rounded border border-violet-500/30 bg-violet-500/[0.06] text-violet-200 hover:bg-violet-500/[0.12] disabled:opacity-50 transition-colors"
        >
          Grant exception…
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => decide("resolve")}
        className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.15] disabled:opacity-50 transition-colors"
      >
        {busy && state.kind === "submitting" && state.which === "resolve" ? "…" : "Mark resolved"}
      </button>
      {state.kind === "ok" && (
        <span className="text-emerald-300">✓ {state.which === "grant_exception" ? "exception granted" : "resolved"}</span>
      )}
      {state.kind === "error" && <span className="text-rose-300">✗ {state.message}</span>}
    </div>
  );
}
