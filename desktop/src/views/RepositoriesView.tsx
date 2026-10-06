import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

interface ListRow {
  id: string;
  provider: "github" | "gitlab" | "azuredevops" | "other";
  displayName: string;
  remoteUrl: string;
  defaultBranch: string;
  protectionStrength: "strong" | "weak" | "none";
  flavorBadge: string | null;
  openPrCount: number;
  recentTagCount: number;
  lastWorkflow: {
    name: string;
    state: "queued" | "in_progress" | "completed";
    conclusion: string | null;
    startedAtIso: string | null;
  } | null;
}

interface DigestData {
  generatedAt: string;
  repositories: ListRow[];
  summary: { total: number; byProvider: Record<string, number>; weakProtection: number };
}

type RespBody =
  | { ok: true; data: DigestData }
  | { ok: false; error: string; hint?: string };

const PROVIDER_LABEL: Record<ListRow["provider"], string> = {
  github: "GitHub",
  gitlab: "GitLab",
  azuredevops: "Azure DevOps",
  other: "Other",
};

const PROTECTION_CLASS: Record<ListRow["protectionStrength"], string> = {
  strong: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  weak:   "bg-white/15 text-zinc-300 border-white/25",
  none:   "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

function workflowToneFor(r: ListRow): string {
  if (!r.lastWorkflow) return "bg-zinc-700/40 text-zinc-300 border-zinc-700/40";
  if (r.lastWorkflow.state !== "completed") return "bg-white/15 text-zinc-300 border-white/25";
  if (r.lastWorkflow.conclusion === "success") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  return "bg-rose-500/15 text-rose-300 border-rose-500/25";
}

export function RepositoriesView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/repository-list", { credentials: "include" })
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
        <h1 className="text-xl font-bold tracking-tight">Repositories</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          GitHub / GitLab / Azure DevOps inventory. Drives branch validation + release-tag diffs.
        </p>
      </div>

      <NewRepositoryPanel onCreated={loadList} />

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading repositories…</div>}

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
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Total" value={String(data.summary.total)} />
            <Stat label="Strong" value={String(data.summary.total - data.summary.weakProtection)} tone="emerald" />
            <Stat label="Weak/none" value={String(data.summary.weakProtection)} tone={data.summary.weakProtection > 0 ? "rose" : "zinc"} />
            <Stat label="Providers" value={String(Object.keys(data.summary.byProvider).length)} />
          </div>

          {data.repositories.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-zinc-400">
              No repositories tracked yet. Connect a Git provider to populate this list.
            </div>
          ) : (
            <div className="space-y-2">
              {data.repositories.map((r) => (
                <div key={r.id} className="glass-card p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300 border border-zinc-600/40 shrink-0">
                        {PROVIDER_LABEL[r.provider]}
                      </span>
                      <p className="text-sm font-semibold text-white truncate">{r.displayName}</p>
                      <span className="text-[10px] font-mono text-zinc-500">default: {r.defaultBranch}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${PROTECTION_CLASS[r.protectionStrength]}`}>
                        {r.protectionStrength} prot
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                        {r.openPrCount} PR
                      </span>
                      <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-300 border border-zinc-700/40">
                        {r.recentTagCount} tag
                      </span>
                      {r.lastWorkflow && (
                        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${workflowToneFor(r)}`}>
                          {r.lastWorkflow.state === "completed"
                            ? `${r.lastWorkflow.name} · ${r.lastWorkflow.conclusion ?? "done"}`
                            : `${r.lastWorkflow.name} · ${r.lastWorkflow.state}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {(r.provider === "github" || r.provider === "gitlab" || r.provider === "azuredevops") && <SyncControls repositoryId={r.id} />}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
  );
}

type SyncKind = "pull_requests" | "releases" | "workflow_runs";

type SyncOutcome =
  | { kind: "idle" }
  | { kind: "running"; which: SyncKind }
  | { kind: "ok"; which: SyncKind; fetched: number; upserted: number; skipped: number }
  | { kind: "error"; which: SyncKind; message: string };

function SyncControls({ repositoryId }: { repositoryId: string }) {
  const [outcome, setOutcome] = useState<SyncOutcome>({ kind: "idle" });

  async function trigger(which: SyncKind) {
    setOutcome({ kind: "running", which });
    try {
      const res = await fetch("/api/dashboard/repository-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId, kind: which }),
      });
      const json = await res.json();
      if (json.ok) {
        setOutcome({
          kind: "ok", which,
          fetched: json.data.fetched, upserted: json.data.upserted, skipped: json.data.skipped,
        });
      } else {
        setOutcome({ kind: "error", which, message: json.error });
      }
    } catch (e) {
      setOutcome({ kind: "error", which, message: e instanceof Error ? e.message : "network error" });
    }
  }

  const isRunning = outcome.kind === "running";
  return (
    <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2 flex-wrap text-[10px] font-mono">
      <span className="text-zinc-500 uppercase tracking-[0.18em]">Sync</span>
      {(["pull_requests", "releases", "workflow_runs"] as const).map((k) => (
        <button
          key={k}
          type="button"
          disabled={isRunning}
          onClick={() => trigger(k)}
          className="px-2 py-1 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-300 hover:border-violet-500/40 hover:text-violet-200 disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {outcome.kind === "running" && outcome.which === k
            ? "…"
            : k === "pull_requests" ? "PRs" : k === "releases" ? "Tags" : "Runs"}
        </button>
      ))}
      {outcome.kind === "ok" && (
        <span className="text-emerald-300">
          ✓ {outcome.fetched} fetched · {outcome.upserted} upserted
          {outcome.skipped > 0 && ` · ${outcome.skipped} skipped`}
        </span>
      )}
      {outcome.kind === "error" && (
        <span className="text-rose-300">✗ {outcome.message}</span>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
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
// Phase 494 — register a new repository (desktop sibling).
// ─────────────────────────────────────────────────────────────────

type NewRepoState =
  | { kind: "closed" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "ok"; created: boolean; displayName: string }
  | { kind: "error"; message: string };

function NewRepositoryPanel({ onCreated }: { onCreated: () => void }) {
  const [state, setState] = useState<NewRepoState>({ kind: "closed" });
  const [provider, setProvider] = useState<"github" | "gitlab" | "azuredevops" | "other">("github");
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [flavor, setFlavor] = useState("");

  function reset() {
    setProvider("github"); setOwner(""); setName(""); setUrl(""); setDefaultBranch(""); setFlavor("");
    setState({ kind: "closed" });
  }

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/dashboard/repository-create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider, remoteOwner: owner, remoteName: name,
          ...(url ? { remoteUrl: url } : {}),
          ...(defaultBranch ? { defaultBranch } : {}),
          ...(flavor ? { repoFlavor: flavor } : {}),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setState({ kind: "ok", created: j.data.created, displayName: j.data.displayName });
        onCreated();
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
          className="px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] text-[12px] font-semibold text-violet-200 hover:bg-violet-500/[0.16] transition-colors"
        >
          + Register repository
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-violet-100">New repository</p>
        <button type="button" onClick={reset} className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200" disabled={busy}>cancel</button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <label className="block">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as typeof provider)}
            disabled={busy}
            className="w-full rounded-md border border-zinc-700/40 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-zinc-100 disabled:opacity-50"
          >
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
            <option value="azuredevops">Azure DevOps</option>
            <option value="other">Other</option>
          </select>
        </label>
        <Field label="Owner / org" value={owner} onChange={setOwner} placeholder="acme" disabled={busy} />
        <Field label="Repo name"   value={name}  onChange={setName}  placeholder="checkout" disabled={busy} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Remote URL (optional)" value={url} onChange={setUrl} placeholder="auto-derived if blank" disabled={busy} />
        <Field label="Default branch"        value={defaultBranch} onChange={setDefaultBranch} placeholder="main" disabled={busy} />
        <Field label="Flavor tag"            value={flavor} onChange={setFlavor} placeholder="service · infra" disabled={busy} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !owner || !name}
          className="px-3 py-1.5 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[12px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {busy ? "Submitting…" : "Register"}
        </button>
        {state.kind === "ok" && (
          <span className="text-[11px] font-mono text-emerald-300">
            ✓ {state.created ? "created" : "already existed"} · {state.displayName}
          </span>
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
