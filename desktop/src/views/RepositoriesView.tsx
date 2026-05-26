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
  weak:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  none:   "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

function workflowToneFor(r: ListRow): string {
  if (!r.lastWorkflow) return "bg-zinc-700/40 text-zinc-300 border-zinc-700/40";
  if (r.lastWorkflow.state !== "completed") return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  if (r.lastWorkflow.conclusion === "success") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  return "bg-rose-500/15 text-rose-300 border-rose-500/25";
}

export function RepositoriesView() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/repository-list", { credentials: "include" })
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
        <h1 className="text-xl font-bold tracking-tight">Repositories</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          GitHub / GitLab / Azure DevOps inventory. Drives branch validation + release-tag diffs.
        </p>
      </div>

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading repositories…</div>}

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
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ViewShell>
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
