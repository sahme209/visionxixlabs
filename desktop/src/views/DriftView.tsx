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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/drift-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
