import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 485 — desktop sibling for /dashboard/drift.
 */

type Status = "open" | "acknowledged" | "suppressed" | "resolved" | "unknown";
type Severity = "low" | "medium" | "high" | "critical" | "unknown";

interface Row {
  id: string;
  resourceKind: string;
  resourceId: string;
  displayName: string;
  applicationId: string | null;
  environmentTier: string | null;
  severity: Severity;
  status: Status;
  summary: string;
  remediationKey: string | null;
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionReason: string | null;
  detectedAtIso: string;
  lastSeenAtIso: string;
}

interface DigestData {
  generatedAt: string;
  findings: Row[];
  summary: {
    total: number;
    byStatus: Record<Status, number>;
    bySeverity: Record<Severity, number>;
    openCritical: number;
  };
}

type RespBody = { ok: true; data: DigestData } | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<Status, string> = {
  open:         "bg-rose-500/15 text-rose-300 border-rose-500/25",
  acknowledged: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  suppressed:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  resolved:     "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:      "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  high:     "bg-orange-500/15 text-orange-300 border-orange-500/25",
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  low:      "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
};

export function DriftView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/drift-list", { credentials: "include" })
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
        <h1 className="text-xl font-bold tracking-tight">Drift</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Declared (IaC) vs observed (runtime) state — one row per drifted resource.
        </p>
      </div>

      <DemoDetectButton onCompleted={loadList} />

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading drift findings…</div>}

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
            <Stat label="Open · critical" value={String(data.summary.openCritical)} tone={data.summary.openCritical > 0 ? "rose" : "zinc"} />
            <Stat label="Open total"      value={String(data.summary.byStatus.open)} tone={data.summary.byStatus.open > 0 ? "amber" : "zinc"} />
            <Stat label="High + crit"     value={String(data.summary.bySeverity.high + data.summary.bySeverity.critical)} tone={(data.summary.bySeverity.high + data.summary.bySeverity.critical) > 0 ? "rose" : "zinc"} />
            <Stat label="Resolved"        value={String(data.summary.byStatus.resolved)} tone={data.summary.byStatus.resolved > 0 ? "emerald" : "zinc"} />
          </div>

          {data.findings.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No drift findings on file.
            </div>
          ) : (
            <div className="space-y-2">
              {data.findings.map((f) => (
                <div key={f.id} className="glass-card p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${SEVERITY_CLASS[f.severity]}`}>
                        {f.severity}
                      </span>
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CLASS[f.status]}`}>
                        {f.status}
                      </span>
                      <p className="text-[13px] font-semibold text-white truncate">{f.displayName}</p>
                      <span className="text-[10px] font-mono text-zinc-500">{f.resourceKind}</span>
                    </div>
                    {f.environmentTier && (
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40 shrink-0">
                        {f.environmentTier}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-zinc-300 mb-1.5 whitespace-pre-wrap">{f.summary}</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 flex-wrap">
                    <span>{f.resourceId.length > 50 ? `${f.resourceId.slice(0, 47)}…` : f.resourceId}</span>
                    {f.applicationId && <span>· {f.applicationId}</span>}
                    <span>· detected {new Date(f.detectedAtIso).toLocaleString()}</span>
                  </div>
                  {(f.status === "open" || f.status === "acknowledged") && (
                    <DecideControls findingId={f.id} currentStatus={f.status} onDecided={loadList} />
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

type DemoOutcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; upserted: number; autoResolved: number; bySeverity: Record<string, number> }
  | { kind: "error"; message: string };

const DEMO_PAYLOAD = {
  declared: [
    {
      resourceKind: "aws_resource",
      resourceId: "arn:aws:ec2:us-east-1:111:instance/i-prod-web",
      displayName: "prod-web-1",
      applicationId: "app_checkout",
      environmentTier: "prod",
      attributes: { instance_type: "t3.large", volume_type: "gp3", security_group_ids: ["sg-web", "sg-base"] },
      sensitiveAttributeKeys: ["security_group_ids"],
    },
    {
      resourceKind: "k8s_resource",
      resourceId: "deployment/checkout-api",
      displayName: "checkout-api",
      applicationId: "app_checkout",
      environmentTier: "prod",
      attributes: { replicas: 3, image_tag: "v2.4.0" },
    },
  ],
  observed: [
    {
      resourceKind: "aws_resource",
      resourceId: "arn:aws:ec2:us-east-1:111:instance/i-prod-web",
      displayName: "prod-web-1",
      attributes: { instance_type: "t3.large", volume_type: "gp3", security_group_ids: ["sg-web", "sg-base", "sg-shadow-allow-all"] },
    },
    {
      resourceKind: "k8s_resource",
      resourceId: "deployment/checkout-api",
      displayName: "checkout-api",
      attributes: { replicas: 5, image_tag: "v2.4.0-hotfix" },
    },
  ],
};

function DemoDetectButton({ onCompleted }: { onCompleted: () => void }) {
  const [outcome, setOutcome] = useState<DemoOutcome>({ kind: "idle" });

  async function trigger() {
    setOutcome({ kind: "running" });
    try {
      const res = await fetch("/api/dashboard/drift-evaluate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEMO_PAYLOAD),
      });
      const j = await res.json();
      if (j.ok) {
        setOutcome({
          kind: "ok",
          upserted: j.data.upserted,
          autoResolved: j.data.autoResolved,
          bySeverity: j.data.bySeverity,
        });
        onCompleted();
      } else {
        setOutcome({ kind: "error", message: j.hint ?? j.error });
      }
    } catch (e) {
      setOutcome({ kind: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  const busy = outcome.kind === "running";
  return (
    <div className="glass-card p-3 border border-violet-500/20 flex items-center gap-2 flex-wrap text-[11px] font-mono">
      <span className="text-violet-300/70 uppercase tracking-[0.18em] text-[9px]">Demo</span>
      <button
        type="button"
        disabled={busy}
        onClick={trigger}
        className="px-2.5 py-1 rounded border border-violet-500/40 bg-violet-500/[0.12] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
      >
        {busy ? "Detecting…" : "Run sample detection"}
      </button>
      {outcome.kind === "ok" && (
        <span className="text-emerald-300">
          ✓ {outcome.upserted} upserted · {outcome.autoResolved} auto-resolved
        </span>
      )}
      {outcome.kind === "error" && <span className="text-rose-300">✗ {outcome.message}</span>}
    </div>
  );
}

type DecideState =
  | { kind: "idle" }
  | { kind: "suppressing" }
  | { kind: "submitting"; which: "acknowledge" | "suppress" | "resolve" }
  | { kind: "ok"; which: "acknowledge" | "suppress" | "resolve" }
  | { kind: "error"; message: string };

function DecideControls({
  findingId,
  currentStatus,
  onDecided,
}: {
  findingId: string;
  currentStatus: "open" | "acknowledged";
  onDecided: () => void;
}) {
  const [state, setState] = useState<DecideState>({ kind: "idle" });
  const [reason, setReason] = useState("");

  async function decide(which: "acknowledge" | "suppress" | "resolve", reasonText?: string) {
    setState({ kind: "submitting", which });
    try {
      const res = await fetch("/api/dashboard/drift-decide", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingId, action: which, ...(reasonText ? { reason: reasonText } : {}) }),
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

  if (state.kind === "suppressing") {
    const valid = reason.trim().length >= 10;
    return (
      <div className="mt-2 pt-2 border-t border-white/[0.04]">
        <span className="block text-[9px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
          Suppression reason ({reason.trim().length}/10 min)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this drift intentional?"
          rows={2}
          className="w-full rounded-lg border border-zinc-700/40 bg-zinc-900/40 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none"
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            disabled={!valid}
            onClick={() => decide("suppress", reason.trim())}
            className="px-2 py-1 rounded border border-zinc-500/40 bg-zinc-500/[0.12] text-[10px] font-semibold text-zinc-100 hover:bg-zinc-500/[0.20] disabled:opacity-50 transition-colors"
          >
            Confirm suppress
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
      {currentStatus === "open" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("acknowledge")}
          className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/[0.08] text-amber-200 hover:bg-amber-500/[0.15] disabled:opacity-50 transition-colors"
        >
          {state.kind === "submitting" && state.which === "acknowledge" ? "…" : "Acknowledge"}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => setState({ kind: "suppressing" })}
        className="px-2 py-1 rounded border border-zinc-600/40 bg-zinc-600/[0.08] text-zinc-300 hover:bg-zinc-600/[0.15] disabled:opacity-50 transition-colors"
      >
        Suppress…
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => decide("resolve")}
        className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.15] disabled:opacity-50 transition-colors"
      >
        {state.kind === "submitting" && state.which === "resolve" ? "…" : "Mark resolved"}
      </button>
      {state.kind === "ok" && (
        <span className="text-emerald-300">✓ {state.which === "acknowledge" ? "acknowledged" : state.which === "suppress" ? "suppressed" : "resolved"}</span>
      )}
      {state.kind === "error" && <span className="text-rose-300">✗ {state.message}</span>}
    </div>
  );
}
