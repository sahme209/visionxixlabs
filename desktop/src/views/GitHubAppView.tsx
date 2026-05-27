import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

interface InstallationView {
  id: string;
  githubInstallationId: string;
  accountLogin: string;
  accountType: "User" | "Organization" | "unknown";
  repositorySelection: "all" | "selected" | "unknown";
  status: "active" | "suspended" | "revoked" | "unknown";
  installedAtIso: string;
}

interface StatusData {
  generatedAt: string;
  installed: boolean;
  active: InstallationView | null;
  history: InstallationView[];
  installUrl: string;
}

type StatusBody =
  | { ok: true; data: StatusData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<InstallationView["status"], string> = {
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  suspended: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  revoked:   "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:   "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function GitHubAppView() {
  const [resp, setResp] = useState<StatusBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadStatus() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/github-installation-status", { credentials: "include" })
      .then((r) => r.json())
      .then((j: StatusBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadStatus(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">GitHub App</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          One-click install. After install, the platform auto-onboards repos + branch protection + webhooks.
        </p>
      </div>

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading installation status…</div>}

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
          {data.installUrl ? (
            <div className="glass-card p-4 border border-violet-500/20">
              <p className="text-sm font-semibold text-violet-100 mb-2">
                {data.installed ? "Re-install or extend repository selection" : "Install Axiom on your GitHub org"}
              </p>
              <a
                href={data.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-violet-500/40 bg-violet-500/[0.14] text-[13px] font-semibold text-violet-100 hover:bg-violet-500/[0.22] transition-colors"
              >
                Continue to GitHub →
              </a>
            </div>
          ) : (
            <div className="glass-card p-4 border border-amber-500/30">
              <p className="text-sm font-semibold text-amber-300 mb-1">Install URL not configured</p>
              <p className="text-xs text-zinc-400">Set GITHUB_APP_SLUG in the deploy env to enable the one-click install.</p>
            </div>
          )}

          {data.installed && data.active && (
            <div className="glass-card p-4 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[data.active.status]}`}>
                  {data.active.status}
                </span>
                <p className="text-sm font-semibold text-emerald-100">{data.active.accountLogin}</p>
                <span className="text-[10px] font-mono text-zinc-500">type: {data.active.accountType}</span>
                <span className="text-[10px] font-mono text-zinc-500">scope: {data.active.repositorySelection}</span>
                <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                  installed {new Date(data.active.installedAtIso).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-500">installation_id: {data.active.githubInstallationId}</p>
            </div>
          )}

          {data.history.length > 0 && (
            <>
              <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">History</h3>
              <div className="space-y-1.5">
                {data.history.map((h) => (
                  <div key={h.id} className="glass-card p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[h.status]}`}>
                        {h.status}
                      </span>
                      <span className="text-[12px] text-white">{h.accountLogin}</span>
                      <span className="text-[10px] font-mono text-zinc-500">id {h.githubInstallationId}</span>
                      <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                        installed {new Date(h.installedAtIso).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </ViewShell>
  );
}
