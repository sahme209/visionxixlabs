import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

interface FixView {
  id: string;
  releaseId: string | null;
  summary: string;
  status: "pending" | "reconciled" | "wont_fix" | "unknown";
  environmentTier: "prod" | "staging" | "dev" | "other" | "unknown";
  fixedAtIso: string;
  loggedByUserId: string;
  reconciledByUserId: string | null;
  reconciledAtIso: string | null;
  reconciliationRef: string | null;
}

interface ListData {
  generatedAt: string;
  fixes: FixView[];
  summary: { total: number; pending: number; reconciled: number; wontFix: number; pendingProd: number };
}

type ListBody =
  | { ok: true; data: ListData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<FixView["status"], string> = {
  pending:    "bg-white/15 text-zinc-300 border-white/25",
  reconciled: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  wont_fix:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

const TIER_CLASS: Record<FixView["environmentTier"], string> = {
  prod:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  staging: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  dev:     "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  other:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function ManualFixesView() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/manual-fix-list", { credentials: "include" })
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
        <h1 className="text-xl font-bold tracking-tight">Manual fixes</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Out-of-band patches logged + reconciled. Feeds the readiness evaluator's hasManualProdFixes signal.
        </p>
      </div>

      <LogManualFixPanel onLogged={loadList} />

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading manual fixes…</div>}

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
          <div className="grid grid-cols-5 gap-2">
            <Stat label="Total" value={String(data.summary.total)} />
            <Stat label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
            <Stat label="Pending prod" value={String(data.summary.pendingProd)} tone={data.summary.pendingProd > 0 ? "rose" : "zinc"} />
            <Stat label="Reconciled" value={String(data.summary.reconciled)} tone="emerald" />
            <Stat label="Won't fix" value={String(data.summary.wontFix)} />
          </div>

          {data.fixes.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No manual fixes logged. Use the panel above when an engineer patches an environment by hand.
            </div>
          ) : (
            <div className="space-y-2">
              {data.fixes.map((f) => (
                <FixRow key={f.id} fix={f} onReconciled={loadList} />
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
  );
}

function FixRow({ fix, onReconciled }: { fix: FixView; onReconciled: () => void }) {
  const [busy, setBusy] = useState<"reconciled" | "wont_fix" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ref, setRef] = useState("");

  async function reconcile(outcome: "reconciled" | "wont_fix") {
    setBusy(outcome);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/manual-fix-reconcile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixId: fix.id, outcome,
          ...(ref ? { reconciliationRef: ref } : {}),
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.hint ?? j.error);
        setBusy(null);
      } else {
        onReconciled();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
      setBusy(null);
    }
  }

  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[fix.status]}`}>
          {fix.status}
        </span>
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${TIER_CLASS[fix.environmentTier]}`}>
          {fix.environmentTier}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          fixed {new Date(fix.fixedAtIso).toLocaleString()}
        </span>
      </div>
      <p className="text-sm text-white">{fix.summary}</p>
      {fix.releaseId && (
        <p className="text-[10.5px] font-mono text-zinc-500 mt-1">release: {fix.releaseId}</p>
      )}
      {fix.reconciliationRef && (
        <p className="text-[10.5px] font-mono text-emerald-300 mt-1">↳ reconciled via {fix.reconciliationRef}</p>
      )}
      {fix.status === "pending" && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="ref (PR # / commit) — optional"
            disabled={busy !== null}
            className="flex-1 min-w-[160px] rounded border border-zinc-700/40 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => reconcile("reconciled")}
            disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:bg-emerald-500/[0.18] disabled:opacity-50 disabled:cursor-wait"
          >
            {busy === "reconciled" ? "…" : "Reconcile"}
          </button>
          <button
            type="button"
            onClick={() => reconcile("wont_fix")}
            disabled={busy !== null}
            className="px-2 py-1 rounded border border-zinc-600/40 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 disabled:opacity-50 disabled:cursor-wait"
          >
            {busy === "wont_fix" ? "…" : "Won't fix"}
          </button>
          {err && <span className="text-rose-300">✗ {err}</span>}
        </div>
      )}
    </div>
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

// ─────────────────────────────────────────────────────────────────
// Log panel.
// ─────────────────────────────────────────────────────────────────

type LogState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

function LogManualFixPanel({ onLogged }: { onLogged: () => void }) {
  const [state, setState] = useState<LogState>({ kind: "closed" });
  const [summary, setSummary] = useState("");
  const [tier, setTier] = useState<"prod" | "staging" | "dev" | "other">("prod");
  const [fixedAt, setFixedAt] = useState(() => isoNowLocal());
  const [releaseId, setReleaseId] = useState("");

  function reset() {
    setSummary(""); setTier("prod"); setFixedAt(isoNowLocal()); setReleaseId("");
    setState({ kind: "closed" });
  }

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const fixedAtIso = new Date(fixedAt).toISOString();
      const res = await fetch("/api/dashboard/manual-fix-log", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary, environmentTier: tier, fixedAtIso,
          ...(releaseId ? { releaseId } : {}),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok" });
        onLogged();
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
          className="px-3 py-1.5 rounded-lg border border-white/30 bg-white/[0.08] text-[12px] font-semibold text-zinc-200 hover:bg-white/[0.16] transition-colors"
        >
          + Log manual fix
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-white/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-100">Log a manual fix</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <label className="block mb-2">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">What was changed</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Restarted redis on web-prod-1 + bumped maxmemory"
          disabled={busy}
          rows={2}
          className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-white/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Environment</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as typeof tier)}
            disabled={busy}
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 disabled:opacity-50"
          >
            <option value="prod">prod</option>
            <option value="staging">staging</option>
            <option value="dev">dev</option>
            <option value="other">other</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">When fixed</span>
          <input
            type="datetime-local"
            value={fixedAt}
            onChange={(e) => setFixedAt(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Release (optional)</span>
          <input
            type="text"
            value={releaseId}
            onChange={(e) => setReleaseId(e.target.value)}
            disabled={busy}
            placeholder="rel_..."
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-white/40 focus:outline-none disabled:opacity-50"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !summary.trim()}
          className="px-3 py-1.5 rounded-md border border-white/40 bg-white/[0.14] text-[12px] font-semibold text-zinc-100 hover:bg-white/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Log fix"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">✓ logged · pending reconciliation</span>
        )}
        {state.kind === "error" && (
          <span className="text-[11px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

function isoNowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
