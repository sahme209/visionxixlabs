import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

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

export function IncidentTriageView() {
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
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Incident triage</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Autonomous priority + owner + ETA + runbook for each incident. Operator in the loop.
        </p>
      </div>

      <GeneratePanel onGenerated={loadList} />

      {data && (
        <div className="grid grid-cols-5 gap-2">
          <Stat label="P0" value={String(data.summary.p0)} tone={data.summary.p0 > 0 ? "rose" : "zinc"} />
          <Stat label="P1" value={String(data.summary.p1)} tone={data.summary.p1 > 0 ? "rose" : "zinc"} />
          <Stat label="P2" value={String(data.summary.p2)} tone={data.summary.p2 > 0 ? "amber" : "zinc"} />
          <Stat label="P3" value={String(data.summary.p3)} tone="emerald" />
          <Stat label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading triages…</div>}
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
        data.triages.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No triages yet. Paste an incident id above and hit Generate.
          </div>
        ) : (
          <div className="space-y-2">
            {data.triages.map((t) => <TriageCard key={t.id} triage={t} onChanged={loadList} />)}
          </div>
        )
      )}
    </ViewShell>
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
    <div className="glass-card p-3 border border-violet-500/20">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${PRIORITY_CLASS[triage.priority]}`}>
          {triage.priority}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${DECISION_CLASS[triage.operatorDecision]}`}>
          {triage.operatorDecision}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">confidence {triage.confidence}%</span>
        {triage.autoEscalate && (
          <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/[0.10] text-rose-200">
            auto-escalate
          </span>
        )}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">
          {new Date(triage.generatedAtIso).toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <Info label="Owner" value={triage.suggestedOwnerTeam} />
        <Info label="ETA" value={`${triage.estimatedTimeToMitigateMinutes}m`} />
        <Info label="Runbook" value={triage.recommendedRunbook ?? "—"} />
        <Info label="Incident" value={triage.incidentId} mono />
      </div>
      <div className="rounded border border-zinc-700/30 bg-zinc-900/40 p-2 text-[11.5px] text-zinc-200">
        {triage.rationale}
      </div>
      <AiTriageRationaleCard triageId={triage.id} />
      {triage.overridePriority && (
        <p className="text-[11px] font-mono text-amber-300 mt-1">↳ overrode → {triage.overridePriority}</p>
      )}
      {triage.decisionNote && (
        <p className="text-[11px] font-mono text-zinc-400 mt-1 italic">↳ {triage.decisionNote}</p>
      )}
      {triage.operatorDecision === "pending" && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <select
            value={overrideTo}
            onChange={(e) => setOverrideTo(e.target.value as typeof overrideTo)}
            disabled={busy !== null}
            className="rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 disabled:opacity-50"
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
            placeholder="note"
            disabled={busy !== null}
            className="flex-1 min-w-[140px] rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => decide("accept")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:bg-emerald-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
            {busy === "accept" ? "…" : "Accept"}
          </button>
          <button type="button" onClick={() => decide("override")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/[0.10] text-amber-200 hover:bg-amber-500/[0.18] disabled:opacity-50 disabled:cursor-wait">
            {busy === "override" ? "…" : `Override → ${overrideTo}`}
          </button>
          <button type="button" onClick={() => decide("dismiss")} disabled={busy !== null}
            className="px-2 py-1 rounded border border-zinc-600/40 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-50 disabled:cursor-wait">
            {busy === "dismiss" ? "…" : "Dismiss"}
          </button>
          {err && <span className="text-rose-300">✗ {err}</span>}
        </div>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-zinc-700/30 bg-zinc-900/40 p-2">
      <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 ${mono ? "font-mono text-[11px] text-zinc-300" : "text-[12px] font-semibold text-white"}`}>{value}</p>
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
        setTimeout(() => { setIncidentId(""); setHint(""); setState({ kind: "closed" }); }, 1500);
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
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] transition-colors"
        >
          ✨ Generate triage
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">Generate incident triage</p>
        <button type="button" onClick={() => { setIncidentId(""); setHint(""); setState({ kind: "closed" }); }} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Incident ID</span>
          <input
            type="text"
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            placeholder="inc_..."
            disabled={busy}
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Business impact hint</span>
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Paying customers cannot pay"
            disabled={busy}
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !incidentId}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Generating…" : "Generate"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">✓ {state.priority}</span>
        )}
        {state.kind === "error" && (
          <span className="text-[11px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   AI rationale enrichment card — Phase 519 desktop (triage variant).
   ────────────────────────────────────────────────────────────── */

interface TriageEnrichmentView {
  targetKind: string;
  targetId: string;
  narrative: string;
  riskFactors: string[];
  nextActions: string[];
  outcome: string;
  errorMessage: string | null;
  modelHint: string | null;
  engineVersion: string;
  generatedAtIso: string;
}

type TriageEnrichBody = { ok: true; data: { enrichment: TriageEnrichmentView | null } } | { ok: false; error: string; hint?: string };

const TRIAGE_ENRICH_OUTCOME_CLASS: Record<string, string> = {
  ai_generated:    "bg-violet-500/15 text-violet-300 border-violet-500/25",
  fallback_rules:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  error:           "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

function AiTriageRationaleCard({ triageId }: { triageId: string }) {
  const [enrichment, setEnrichment] = useState<TriageEnrichmentView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/triage-rationale-read?triageId=${encodeURIComponent(triageId)}`, { credentials: "include" });
        const j: TriageEnrichBody = await res.json();
        if (cancelled) return;
        if (j.ok) setEnrichment(j.data.enrichment);
      } catch { /* fall through */ }
      finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [triageId]);

  async function generate() {
    setGenerating(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/triage-rationale-enrich", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triageId }),
      });
      const j: TriageEnrichBody = await res.json();
      if (j.ok) setEnrichment(j.data.enrichment);
      else setErr(j.hint ?? j.error);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setGenerating(false);
    }
  }

  if (!loaded) return null;

  if (!enrichment) {
    return (
      <div className="mt-2 rounded border border-violet-500/[0.20] bg-violet-500/[0.04] p-2">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-violet-200">⨯ AI rationale not yet generated</span>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="px-2 py-0.5 rounded border border-violet-500/40 bg-violet-500/[0.12] text-[10.5px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] disabled:opacity-50 disabled:cursor-wait"
          >
            {generating ? "Generating…" : "Generate why-this"}
          </button>
        </div>
        {err && <p className="mt-1 text-[10.5px] font-mono text-rose-300">✗ {err}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-violet-500/[0.20] bg-violet-500/[0.04] p-2.5">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/[0.10] text-violet-200">
          ✦ AI rationale
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${TRIAGE_ENRICH_OUTCOME_CLASS[enrichment.outcome] ?? TRIAGE_ENRICH_OUTCOME_CLASS.error}`}>
          {enrichment.outcome}
        </span>
        {enrichment.modelHint && (
          <span className="text-[10px] font-mono text-zinc-500">{enrichment.modelHint}</span>
        )}
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(enrichment.generatedAtIso).toLocaleString()}</span>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="text-[10.5px] font-mono text-violet-300 hover:text-violet-200 disabled:opacity-50 disabled:cursor-wait"
        >
          {generating ? "Regen…" : "Regen"}
        </button>
      </div>
      <p className="text-[12px] text-zinc-200 mb-2">{enrichment.narrative}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Risk factors</p>
          <ul className="space-y-0.5">
            {enrichment.riskFactors.map((r, i) => (
              <li key={i} className="text-[11px] text-zinc-300 flex gap-1.5"><span className="text-rose-400">•</span><span>{r}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Next actions</p>
          <ul className="space-y-0.5">
            {enrichment.nextActions.map((a, i) => (
              <li key={i} className="text-[11px] text-zinc-300 flex gap-1.5"><span className="text-emerald-400">→</span><span>{a}</span></li>
            ))}
          </ul>
        </div>
      </div>
      {enrichment.outcome !== "ai_generated" && enrichment.errorMessage && (
        <p className="mt-1.5 text-[10px] font-mono text-amber-300">↳ {enrichment.errorMessage}</p>
      )}
      {err && <p className="mt-1 text-[10.5px] font-mono text-rose-300">✗ {err}</p>}
    </div>
  );
}
