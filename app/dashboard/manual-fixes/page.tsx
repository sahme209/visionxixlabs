"use client";

/**
 * /dashboard/manual-fixes — Phase 495.
 *
 * Captures out-of-band fixes engineers applied directly (typically to
 * prod) so the readiness evaluator's `hasManualProdFixes` signal has an
 * auditable trail. Operators log fixes, then reconcile each one once a
 * follow-up commit / PR captures the change back into source-of-truth.
 */

import { useEffect, useState } from "react";
import {
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

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
  pending:    "bg-amber-500/15 text-amber-300 border-amber-500/25",
  reconciled: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  wont_fix:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

const TIER_CLASS: Record<FixView["environmentTier"], string> = {
  prod:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  staging: "bg-violet-500/15 text-violet-300 border-white/[0.10]",
  dev:     "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  other:   "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  unknown: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function ManualFixesPage() {
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
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · manual fixes${data ? ` · ${data.summary.pending} pending` : ""}`}
        title={<>Every hand-edit. <span className="text-zinc-500">Tracked back to truth.</span></>}
        description="Log out-of-band fixes engineers apply directly to an environment, then reconcile each one once a PR / IaC commit captures the change back into source-of-truth. Feeds the readiness evaluator's hasManualProdFixes signal."
        helps="When a hotfix is patched by hand on prod, the system has to know about it before it can score readiness honestly. This page is the audit trail."
        connectFirst="No connector needed — these are operator-logged. Pair with the Releases tab to attach fixes to a specific release."
        engineers={["Release Captain", "DevOps", "SRE"]}
        requiresApproval="Reconciling closes the loop — typically done after the catch-up PR merges."
        actions={[
          { label: "Releases",          href: "/dashboard/releases" },
          { label: "Release readiness", href: "/dashboard/release-readiness" },
        ]}
        safetyNote="Per-org isolation · pending prod fixes count toward readiness blockers · reconcile with PR/commit ref"
      />

      <LogManualFixPanel onLogged={loadList} />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading manual fixes…
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
          <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat icon={WrenchScrewdriverIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
            <Stat icon={ExclamationTriangleIcon} label="Pending" value={String(data.summary.pending)} tone={data.summary.pending > 0 ? "amber" : "zinc"} />
            <Stat icon={ExclamationTriangleIcon} label="Pending in prod" value={String(data.summary.pendingProd)} tone={data.summary.pendingProd > 0 ? "rose" : "zinc"} />
            <Stat icon={CheckCircleIcon} label="Reconciled" value={String(data.summary.reconciled)} tone="emerald" />
            <Stat icon={NoSymbolIcon} label="Won't fix" value={String(data.summary.wontFix)} tone="zinc" />
          </div>

          {data.fixes.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No manual fixes logged. Log one above when an engineer patches an environment by hand.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {data.fixes.map((f) => (
                <FixRow key={f.id} fix={f} onReconciled={loadList} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
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
          <p className="text-[13px] text-white">{fix.summary}</p>
          {fix.releaseId && (
            <p className="text-[10.5px] font-mono text-zinc-500 mt-1">release: {fix.releaseId}</p>
          )}
          {fix.reconciliationRef && (
            <p className="text-[10.5px] font-mono text-emerald-300 mt-1">↳ reconciled via {fix.reconciliationRef}</p>
          )}
        </div>
      </div>
      {fix.status === "pending" && (
        <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[11px] font-mono">
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="reconciliation ref (PR #, commit) — optional"
            disabled={busy !== null}
            className="flex-1 min-w-[180px] rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => reconcile("reconciled")}
            disabled={busy !== null}
            className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.16] disabled:opacity-50 disabled:cursor-wait"
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

function Stat({ icon: Icon, label, value, tone }: { icon: typeof WrenchScrewdriverIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
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

/* ──────────────────────────────────────────────────────────────────
   Log panel.
   ────────────────────────────────────────────────────────────── */

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
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setState({ kind: "open" })}
          className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] text-[12px] font-semibold text-amber-200 hover:bg-amber-500/[0.12] transition-colors"
        >
          + Log manual fix
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="mb-6 rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.03] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-amber-100">Log a manual fix</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <label className="block mb-3">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">What was changed (and on which host / service)</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Restarted redis on web-prod-1 + bumped maxmemory to 4G"
          disabled={busy}
          rows={2}
          className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Environment</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as typeof tier)}
            disabled={busy}
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 disabled:opacity-50"
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
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Release ID (optional)</span>
          <input
            type="text"
            value={releaseId}
            onChange={(e) => setReleaseId(e.target.value)}
            disabled={busy}
            placeholder="rel_..."
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/40 focus:outline-none disabled:opacity-50"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !summary.trim()}
          className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/[0.12] text-[12px] font-semibold text-amber-100 hover:bg-amber-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Log fix"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11.5px] font-mono text-emerald-300">✓ logged · pending reconciliation</span>
        )}
        {state.kind === "error" && (
          <span className="text-[11.5px] font-mono text-rose-300">✗ {state.message}</span>
        )}
      </div>
    </div>
  );
}

function isoNowLocal(): string {
  // datetime-local input wants "YYYY-MM-DDTHH:MM" in *local* time.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
