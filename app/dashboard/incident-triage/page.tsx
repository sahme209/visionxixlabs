"use client";

/**
 * /dashboard/incident-triage — Phase 509.
 *
 * Autonomous Incident Triage cockpit. Operator pastes an incident id,
 * triage engine projects priority + owner + ETA + runbook + escalate
 * flag with rationale. Operator accepts, overrides priority, or
 * dismisses. Every decision audit-logged.
 */

import { useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  BoltIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Priority = "P0" | "P1" | "P2" | "P3" | "unknown";
type Decision = "pending" | "accepted" | "overridden" | "dismissed" | "unknown";

interface TriageView {
  id: string;
  incidentId: string;
  priority: Priority;
  suggestedOwnerTeam: string;
  estimatedTimeToMitigateMinutes: number;
  recommendedRunbook: string | null;
  autoEscalate: boolean;
  confidence: number;
  rationale: string;
  operatorDecision: Decision;
  decisionNote: string | null;
  overridePriority: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

interface ListData {
  generatedAt: string;
  triages: TriageView[];
  summary: { total: number; pending: number; accepted: number; overridden: number; dismissed: number; p0: number; p1: number; p2: number; p3: number };
}

type ListBody = { ok: true; data: ListData } | { ok: false; error: string; hint?: string };

const PRIORITY_CLASS: Record<Priority, string> = {
  P0:      "bg-rose-500/25 text-rose-200 border-rose-500/40",
  P1:      "bg-rose-500/15 text-rose-300 border-rose-500/25",
  P2:      "bg-amber-500/15 text-amber-300 border-amber-500/25",
  P3:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

const DECISION_CLASS: Record<Decision, string> = {
  pending:    "bg-violet-500/15 text-violet-300 border-violet-500/25",
  accepted:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  overridden: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  dismissed:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:    "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function IncidentTriagePage() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/incident-triage-list", { credentials: "include" })
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
        kicker={`AGI cockpit · incident triage${data ? ` · ${data.summary.pending} pending` : ""}`}
        title={<>Incidents <span className="text-zinc-500">triage themselves.</span></>}
        description="When an incident is reported, the triage engine reads incident + release + advisor signals + similar past incidents + business-impact hints and projects: priority (P0-P3), suggested owner team, mitigation ETA, recommended runbook, auto-escalate flag, and rationale. Operators accept, override priority, or dismiss."
        helps="Paste an incident id, hit Generate. The engine returns a triage in milliseconds — deterministic, replayable, version-pinned."
        connectFirst="Reads from existing DeploymentIncident + Release + AdvisorRecommendation + ReleaseFreezeSession. No extra connector."
        engineers={["On-call", "Incident commander", "SRE", "AI Operations"]}
        requiresApproval="Auto-escalate flag is advisory only — paging is the operator's choice."
        actions={[
          { label: "Open incidents", href: "/dashboard/deployment-incidents" },
          { label: "Open AGI cockpit", href: "/dashboard/agi-cockpit" },
        ]}
        safetyNote="Pure engine · per-incident supersede · audit-trailed · operator may override priority with reason"
      />

      <GeneratePanel onGenerated={loadList} />

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={ExclamationTriangleIcon} label="P0" value={String(data.summary.p0)} tone={data.summary.p0 > 0 ? "rose" : "zinc"} />
          <Stat icon={ShieldExclamationIcon} label="P1" value={String(data.summary.p1)} tone={data.summary.p1 > 0 ? "rose" : "zinc"} />
          <Stat icon={BoltIcon} label="P2" value={String(data.summary.p2)} tone={data.summary.p2 > 0 ? "amber" : "zinc"} />
          <Stat icon={CheckCircleIcon} label="P3" value={String(data.summary.p3)} tone="emerald" />
          <Stat icon={SparklesIcon} label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">Loading triages…</div>
      )}
      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">{networkError}</div>
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
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">Sign in required.</div>
      )}

      {data && (
        data.triages.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No triages yet. Paste an incident id above and hit Generate.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {data.triages.map((t) => <TriageCard key={t.id} triage={t} onChanged={loadList} />)}
          </div>
        )
      )}
    </div>
  );
}

function TriageCard({ triage, onChanged }: { triage: TriageView; onChanged: () => void }) {
  const [busy, setBusy] = useState<"accept" | "override" | "dismiss" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [overrideTo, setOverrideTo] = useState<"P0" | "P1" | "P2" | "P3">("P0");

  async function decide(action: "accept" | "override" | "dismiss") {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/incident-triage-decide", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triageId: triage.id, action,
          ...(note ? { note } : {}),
          ...(action === "override" ? { overridePriority: overrideTo } : {}),
        }),
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
    <div className="rounded-2xl border border-violet-500/[0.18] bg-violet-500/[0.025] p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${PRIORITY_CLASS[triage.priority]}`}>
          {triage.priority}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${DECISION_CLASS[triage.operatorDecision]}`}>
          {triage.operatorDecision}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">confidence {triage.confidence}%</span>
        {triage.autoEscalate && (
          <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/[0.08] text-rose-200">
            auto-escalate
          </span>
        )}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">
          generated {new Date(triage.generatedAtIso).toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Info label="Owner team" value={triage.suggestedOwnerTeam} />
        <Info label="ETA to mitigate" value={`${triage.estimatedTimeToMitigateMinutes}m`} icon={<ClockIcon className="h-3.5 w-3.5" />} />
        <Info label="Runbook" value={triage.recommendedRunbook ?? "—"} />
        <Info label="Incident" value={triage.incidentId} mono />
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5 mb-3">
        <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Rationale</p>
        <p className="text-[12px] text-zinc-200 leading-relaxed">{triage.rationale}</p>
      </div>
      {triage.overridePriority && (
        <p className="text-[11.5px] font-mono text-amber-300 mb-2">↳ operator overrode → {triage.overridePriority}</p>
      )}
      {triage.decisionNote && (
        <p className="text-[11.5px] font-mono text-zinc-400 mb-2 italic">↳ note: {triage.decisionNote}</p>
      )}
      {triage.operatorDecision === "pending" && (
        <div className="pt-3 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <select
            value={overrideTo}
            onChange={(e) => setOverrideTo(e.target.value as typeof overrideTo)}
            disabled={busy !== null}
            className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 disabled:opacity-50"
          >
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional note"
            disabled={busy !== null}
            className="flex-1 min-w-[180px] rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("accept")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "accept" ? "…" : "Accept"}
          </button>
          <button type="button" onClick={() => decide("override")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/[0.08] text-amber-200 hover:bg-amber-500/[0.16] disabled:opacity-50 disabled:cursor-wait">
            {busy === "override" ? "…" : `Override → ${overrideTo}`}
          </button>
          <button type="button" onClick={() => decide("dismiss")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-zinc-600/40 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-50 disabled:cursor-wait">
            {busy === "dismiss" ? "…" : "Dismiss"}
          </button>
          {err && <span className="text-rose-300">✗ {err}</span>}
        </div>
      )}
      <p className="text-[10px] font-mono text-zinc-600 mt-2">engine: {triage.engineVersion}</p>
    </div>
  );
}

function Info({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
      <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 flex items-center gap-1.5 ${mono ? "font-mono text-[11px] text-zinc-300" : "text-[13px] font-semibold text-white"}`}>
        {icon}
        <span>{value}</span>
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof ExclamationTriangleIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
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

type GenState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; priority: string }
  | { kind: "error"; message: string };

function GeneratePanel({ onGenerated }: { onGenerated: () => void }) {
  const [state, setState] = useState<GenState>({ kind: "closed" });
  const [incidentId, setIncidentId] = useState("");
  const [hint, setHint] = useState("");

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/incident-triage-generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          ...(hint ? { businessImpactHint: hint } : {}),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", priority: j.data.triage.priority });
        onGenerated();
        setTimeout(() => { setIncidentId(""); setHint(""); setState({ kind: "closed" }); }, 1800);
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
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.06] text-[12px] font-semibold text-violet-200 hover:bg-violet-500/[0.12] transition-colors inline-flex items-center gap-1.5"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          Generate triage
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-violet-500/[0.18] bg-violet-500/[0.03] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-violet-100">Generate incident triage</p>
        <button type="button" onClick={() => { setIncidentId(""); setHint(""); setState({ kind: "closed" }); }} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Incident ID</span>
          <input
            type="text"
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            placeholder="inc_..."
            disabled={busy}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Business impact hint (optional)</span>
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Paying customers cannot checkout — revenue impact"
            disabled={busy}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !incidentId}
          className="px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors inline-flex items-center gap-1.5"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          {busy ? "Generating…" : "Generate"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">
            ✓ triage generated · {state.priority}
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300 inline-flex items-center gap-1">
            <XCircleIcon className="h-3.5 w-3.5" /> {state.message}
          </span>
        )}
      </div>
    </div>
  );
}
