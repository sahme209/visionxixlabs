import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

interface SnapshotView {
  id: string;
  repositoryId: string;
  branchName: string;
  strength: "strong" | "weak" | "none" | "unknown";
  requiresPullRequest: boolean;
  requiredReviewCount: number;
  requiresStatusChecks: boolean;
  requiredStatusCheckContexts: string[];
  requiresSignedCommits: boolean;
  allowsForcePushes: boolean;
  source: string;
  fetchedAtIso: string;
}

interface ListData {
  generatedAt: string;
  snapshots: SnapshotView[];
  summary: { total: number; strong: number; weak: number; none: number };
}

type ListBody =
  | { ok: true; data: ListData }
  | { ok: false; error: string; hint?: string };

const STRENGTH_CLASS: Record<SnapshotView["strength"], string> = {
  strong:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  weak:    "bg-white/15 text-zinc-300 border-white/25",
  none:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown: "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function BranchProtectionView() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/branch-protection-list", { credentials: "include" })
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
        <h1 className="text-xl font-bold tracking-tight">Branch protection</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Per-branch protection snapshots projected from GitHub's API. Drives readiness branchGovernance score.
        </p>
      </div>

      <RefreshPanel onRefreshed={loadList} />

      {data && (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="Strong" value={String(data.summary.strong)} tone="emerald" />
          <Stat label="Weak" value={String(data.summary.weak)} tone={data.summary.weak > 0 ? "amber" : "zinc"} />
          <Stat label="None" value={String(data.summary.none)} tone={data.summary.none > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading snapshots…</div>}

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
        data.snapshots.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No protection snapshots yet. Use the panel above to register one.
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.snapshots.map((s) => (
              <div key={s.id} className="glass-card p-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STRENGTH_CLASS[s.strength]}`}>
                    {s.strength}
                  </span>
                  <span className="text-[12px] font-semibold text-white">{s.branchName}</span>
                  <span className="text-[10px] font-mono text-zinc-500">repo: {s.repositoryId}</span>
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                    {new Date(s.fetchedAtIso).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  <Flag label="PR required" on={s.requiresPullRequest} extra={s.requiredReviewCount > 0 ? `· ${s.requiredReviewCount}` : null} />
                  <Flag label="Status checks" on={s.requiresStatusChecks} extra={s.requiredStatusCheckContexts.length > 0 ? `· ${s.requiredStatusCheckContexts.length}` : null} />
                  <Flag label="Signed commits" on={s.requiresSignedCommits} />
                  <Flag label="Force-push" on={s.allowsForcePushes} tone={s.allowsForcePushes ? "rose" : "zinc"} />
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </ViewShell>
  );
}

function Flag({ label, on, extra, tone }: {
  label: string; on: boolean; extra?: string | null; tone?: "rose" | "zinc";
}) {
  const onCls = tone === "rose"
    ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  const offCls = "bg-zinc-700/40 text-zinc-400 border-zinc-700/40";
  return (
    <span className={`px-1.5 py-0.5 rounded border ${on ? onCls : offCls}`}>
      {label}{on && extra ? ` ${extra}` : ""}{on ? "" : " off"}
    </span>
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
// Paste-in JSON refresh panel.
// ─────────────────────────────────────────────────────────────────

type RefreshState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; strength: string; branchName: string }
  | { kind: "error"; message: string };

function RefreshPanel({ onRefreshed }: { onRefreshed: () => void }) {
  const [state, setState] = useState<RefreshState>({ kind: "closed" });
  const [repositoryId, setRepositoryId] = useState("");
  const [branchName, setBranchName] = useState("main");
  const [payload, setPayload] = useState("");

  function reset() {
    setRepositoryId(""); setBranchName("main"); setPayload("");
    setState({ kind: "closed" });
  }

  async function submit() {
    let parsed: unknown;
    try { parsed = payload.trim() ? JSON.parse(payload) : {}; }
    catch (e) {
      setState({ kind: "error", message: e instanceof Error ? `payload JSON: ${e.message}` : "payload JSON invalid" });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/branch-protection-refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId, branchName, payload: parsed, source: "manual" }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", strength: j.data.strength, branchName: j.data.branchName });
        onRefreshed();
        setTimeout(reset, 1500);
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
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] text-[12px] font-semibold text-violet-200 hover:bg-violet-500/[0.16] transition-colors"
        >
          + Refresh snapshot
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">Refresh branch protection</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Field label="Repository ID" value={repositoryId} onChange={setRepositoryId} placeholder="repo_..." disabled={busy} />
        <Field label="Branch" value={branchName} onChange={setBranchName} placeholder="main" disabled={busy} />
      </div>
      <label className="block">
        <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">GitHub branch-protection JSON</span>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={6}
          placeholder='{"required_pull_request_reviews": {...}, "required_status_checks": {...}, ...}'
          disabled={busy}
          className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[11px] font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !repositoryId || !branchName}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Refresh"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">✓ {state.branchName} · {state.strength}</span>
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
        className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}
