import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

interface IncidentView {
  id: string;
  releaseId: string;
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  status: "open" | "mitigated" | "resolved" | "wont_fix" | "unknown";
  title: string;
  summary: string | null;
  reportedAtIso: string;
  externalUrl: string | null;
}

interface ListData {
  generatedAt: string;
  incidents: IncidentView[];
  summary: { total: number; open: number; mitigated: number; resolved: number; wontFix: number; openCritical: number };
}

type ListBody =
  | { ok: true; data: ListData }
  | { ok: false; error: string; hint?: string };

const SEVERITY_CLASS: Record<IncidentView["severity"], string> = {
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  high:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  critical: "bg-rose-500/25 text-rose-200 border-rose-500/40",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const STATUS_CLASS: Record<IncidentView["status"], string> = {
  open:      "bg-rose-500/15 text-rose-300 border-rose-500/25",
  mitigated: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  resolved:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  wont_fix:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:   "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function DeploymentIncidentsView() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/deployment-incident-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Deployment incidents</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Post-deploy regressions pinned to a release. Pairs with manual fixes to close the reconciliation loop.
        </p>
      </div>

      <ReportPanel onReported={loadList} />

      {data && (
        <div className="grid grid-cols-5 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="Open" value={String(data.summary.open)} tone={data.summary.open > 0 ? "rose" : "zinc"} />
          <Stat label="Open critical" value={String(data.summary.openCritical)} tone={data.summary.openCritical > 0 ? "rose" : "zinc"} />
          <Stat label="Mitigated" value={String(data.summary.mitigated)} tone={data.summary.mitigated > 0 ? "amber" : "zinc"} />
          <Stat label="Resolved" value={String(data.summary.resolved)} tone="emerald" />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading incidents…</div>}

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
        data.incidents.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No incidents yet. Use the panel above when a release causes a regression.
          </div>
        ) : (
          <div className="space-y-2">
            {data.incidents.map((i) => <IncidentCard key={i.id} incident={i} onChanged={loadList} />)}
          </div>
        )
      )}
    </ViewShell>
  );
}

function IncidentCard({ incident, onChanged }: { incident: IncidentView; onChanged: () => void }) {
  const [busy, setBusy] = useState<"mitigate" | "resolve" | "reopen" | "wont_fix" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function transition(action: "mitigate" | "resolve" | "reopen" | "wont_fix") {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/deployment-incident-transition", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId: incident.id, action }),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.hint ?? j.error); setBusy(null); }
      else onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
      setBusy(null);
    }
  }

  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEVERITY_CLASS[incident.severity]}`}>
          {incident.severity}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[incident.status]}`}>
          {incident.status}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">release: {incident.releaseId}</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">
          reported {new Date(incident.reportedAtIso).toLocaleString()}
        </span>
      </div>
      <p className="text-sm font-semibold text-white">{incident.title}</p>
      {incident.summary && <p className="text-[12.5px] text-zinc-300 mt-1">{incident.summary}</p>}
      <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
        {incident.status === "open" && (
          <>
            <button type="button" onClick={() => transition("mitigate")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/[0.10] text-amber-200 hover:bg-amber-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
              {busy === "mitigate" ? "…" : "Mitigate"}
            </button>
            <button type="button" onClick={() => transition("resolve")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:bg-emerald-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
              {busy === "resolve" ? "…" : "Resolve"}
            </button>
            <button type="button" onClick={() => transition("wont_fix")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-zinc-600/40 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-50 disabled:cursor-wait">
              {busy === "wont_fix" ? "…" : "Won't fix"}
            </button>
          </>
        )}
        {incident.status === "mitigated" && (
          <>
            <button type="button" onClick={() => transition("resolve")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:bg-emerald-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
              {busy === "resolve" ? "…" : "Resolve"}
            </button>
            <button type="button" onClick={() => transition("reopen")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-rose-500/30 bg-rose-500/[0.10] text-rose-200 hover:bg-rose-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
              {busy === "reopen" ? "…" : "Re-open"}
            </button>
          </>
        )}
        {err && <span className="text-rose-300">✗ {err}</span>}
      </div>
    </div>
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

// ─────────────────────────────────────────────────────────────────
// Report panel.
// ─────────────────────────────────────────────────────────────────

type ReportState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; title: string }
  | { kind: "error"; message: string };

function ReportPanel({ onReported }: { onReported: () => void }) {
  const [state, setState] = useState<ReportState>({ kind: "closed" });
  const [releaseId, setReleaseId] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("high");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  function reset() {
    setReleaseId(""); setSeverity("high"); setTitle(""); setSummary(""); setExternalUrl("");
    setState({ kind: "closed" });
  }

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/deployment-incident-report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId, severity, title,
          ...(summary ? { summary } : {}),
          ...(externalUrl ? { externalUrl } : {}),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", title });
        onReported();
        setTimeout(reset, 1200);
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
          className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/[0.08] text-[12px] font-semibold text-rose-200 hover:bg-rose-500/[0.16] transition-colors"
        >
          + Report incident
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-rose-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-rose-100">Report deployment incident</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Field label="Release ID" value={releaseId} onChange={setReleaseId} placeholder="rel_..." disabled={busy} />
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Severity</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
            disabled={busy}
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 disabled:opacity-50"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <Field label="External URL" value={externalUrl} onChange={setExternalUrl} placeholder="https://linear.app/..." disabled={busy} />
      </div>
      <div className="mb-2">
        <Field label="Title" value={title} onChange={setTitle} placeholder="Checkout 500 spike" disabled={busy} />
      </div>
      <label className="block">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Summary (optional)</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder="Symptoms · blast radius · current mitigation."
          disabled={busy}
          className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !releaseId || !title.trim()}
          className="px-3 py-1.5 rounded-md border border-rose-500/40 bg-rose-500/[0.14] text-[12px] font-semibold text-rose-100 hover:bg-rose-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Report"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">✓ reported · {state.title}</span>
        )}
        {state.kind === "error" && (
          <span className="text-[11px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }: {
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
        className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/40 focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}
