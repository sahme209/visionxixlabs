"use client";

/**
 * /dashboard/deployment-incidents — Phase 501.
 *
 * Per-release deployment incidents. State machine: open → mitigated
 * → resolved | wont_fix. Pairs with /dashboard/manual-fixes (the
 * "cause" side) to close the post-deploy reconciliation loop.
 */

import { useEffect, useState } from "react";
import {
  BoltSlashIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface IncidentView {
  id: string;
  releaseId: string;
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  status: "open" | "mitigated" | "resolved" | "wont_fix" | "unknown";
  title: string;
  summary: string | null;
  reportedByUserId: string;
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
  medium:   "bg-white/15 text-zinc-300 border-white/25",
  high:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  critical: "bg-rose-500/25 text-rose-200 border-rose-500/40",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const STATUS_CLASS: Record<IncidentView["status"], string> = {
  open:      "bg-rose-500/15 text-rose-300 border-rose-500/25",
  mitigated: "bg-white/15 text-zinc-300 border-white/25",
  resolved:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  wont_fix:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:   "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function DeploymentIncidentsPage() {
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
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · deployment incidents${data ? ` · ${data.summary.open} open` : ""}`}
        title={<>Every regression. <span className="text-zinc-500">Pinned to a release.</span></>}
        description="Post-deploy spikes attributed to a specific release. Closed-union state machine: open → mitigated → resolved | wont_fix. Pairs with /dashboard/manual-fixes (the cause-side trail) to close the reconciliation loop."
        helps="When a release ships and something goes wrong in prod, file the incident here. Mitigate when the bleeding stops, resolve when the root cause is fixed."
        connectFirst="No connector needed — operator-driven. Future phases auto-detect from connector signals."
        engineers={["SRE", "Release Captain", "On-call"]}
        requiresApproval="Resolved + wont_fix are terminal — to re-open, reopen from mitigated state instead."
        actions={[
          { label: "Releases",      href: "/dashboard/releases" },
          { label: "Manual fixes",  href: "/dashboard/manual-fixes" },
          { label: "Release audit", href: "/dashboard/release-audit" },
        ]}
        safetyNote="Per-org isolation · open critical surfaces a red counter · resolved/wont_fix are terminal"
      />

      <ReportPanel onReported={loadList} />

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={BoltSlashIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={ExclamationTriangleIcon} label="Open" value={String(data.summary.open)} tone={data.summary.open > 0 ? "rose" : "zinc"} />
          <Stat icon={ExclamationTriangleIcon} label="Open critical" value={String(data.summary.openCritical)} tone={data.summary.openCritical > 0 ? "rose" : "zinc"} />
          <Stat icon={ShieldCheckIcon} label="Mitigated" value={String(data.summary.mitigated)} tone={data.summary.mitigated > 0 ? "amber" : "zinc"} />
          <Stat icon={CheckCircleIcon} label="Resolved" value={String(data.summary.resolved)} tone="emerald" />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading incidents…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-zinc-300" />
            <p className="text-[12px] font-semibold text-zinc-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        data.incidents.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No incidents yet. Use the panel above when a release causes a regression.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {data.incidents.map((i) => <IncidentCard key={i.id} incident={i} onChanged={loadList} />)}
          </div>
        )
      )}
    </div>
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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
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
      <p className="text-[13px] font-semibold text-white">{incident.title}</p>
      {incident.summary && <p className="text-[12.5px] text-zinc-300 mt-1">{incident.summary}</p>}
      {incident.externalUrl && (
        <p className="text-[10.5px] font-mono text-zinc-500 mt-1">
          ↳ <a href={incident.externalUrl} target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:underline">{incident.externalUrl}</a>
        </p>
      )}
      <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
        {incident.status === "open" && (
          <>
            <button type="button" onClick={() => transition("mitigate")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-white/30 bg-white/[0.08] text-zinc-200 hover:bg-white/[0.16] disabled:opacity-50 disabled:cursor-wait">
              {busy === "mitigate" ? "…" : "Mitigate"}
            </button>
            <button type="button" onClick={() => transition("resolve")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
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
              className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
              {busy === "resolve" ? "…" : "Resolve"}
            </button>
            <button type="button" onClick={() => transition("reopen")} disabled={busy !== null}
              className="px-2 py-1 rounded border border-rose-500/30 bg-rose-500/[0.08] text-rose-200 hover:bg-rose-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
              {busy === "reopen" ? "…" : "Re-open"}
            </button>
          </>
        )}
        {err && <span className="text-rose-300">✗ {err}</span>}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof BoltSlashIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
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
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] text-[12px] font-semibold text-rose-200 hover:bg-rose-500/[0.12] transition-colors"
        >
          + Report incident
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.03] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-rose-100">Report deployment incident</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <IncidentField label="Release ID" value={releaseId} onChange={setReleaseId} placeholder="rel_..." disabled={busy} />
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Severity</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
            disabled={busy}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 disabled:opacity-50"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <IncidentField label="External URL (optional)" value={externalUrl} onChange={setExternalUrl} placeholder="https://linear.app/..." disabled={busy} />
      </div>
      <div className="mb-3">
        <IncidentField label="Title" value={title} onChange={setTitle} placeholder="Checkout 500 spike on /pay" disabled={busy} />
      </div>
      <label className="block">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Summary (optional)</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder="One-paragraph context — symptoms, blast radius, current mitigation if any."
          disabled={busy}
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !releaseId || !title.trim()}
          className="px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/[0.12] text-[12px] font-semibold text-rose-100 hover:bg-rose-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Report"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">✓ reported · {state.title}</span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

function IncidentField({ label, value, onChange, placeholder, disabled }: {
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
        className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500/40 focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}
