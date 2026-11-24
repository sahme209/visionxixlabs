"use client";

import {useState} from "react";

type SyncKind = "pull_requests" | "releases" | "workflow_runs";

type SyncOutcome =
  | { kind: "idle" }
  | { kind: "running"; which: SyncKind }
  | { kind: "ok"; which: SyncKind; fetched: number; upserted: number; skipped: number }
  | { kind: "error"; which: SyncKind; message: string };

function syncFailureMessage(error: unknown, hint: unknown): string {
  switch (error) {
    case "github_app_connection_required":
      return "Connect the approved GitHub App from Integrations before syncing repository evidence.";
    case "github_read_validation_required":
      return "Open V19 and complete its read-only GitHub validation before syncing evidence.";
    case "github_read_validation_unavailable":
      return "GitHub validation is unavailable right now. No repository evidence was changed.";
    case "gitlab_read_connection_required":
      return "Refresh GitLab status and verify read access before syncing.";
    case "gitlab_evidence_unavailable":
      return "GitLab evidence is unavailable. Refresh the connection status before trying again.";
    case "gitlab_evidence_persistence_unconfirmed":
      return "V19 could not confirm the sync. Reload the repository evidence before trying again.";
    default:
      return typeof hint === "string" ? hint : typeof error === "string" ? error.replaceAll("_", " ") : "Sync could not be completed.";
  }
}

export function RepositorySyncControls({ repositoryId }: { repositoryId: string }) {
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
          kind: "ok",
          which,
          fetched: json.data.fetched,
          upserted: json.data.upserted,
          skipped: json.data.skipped,
        });
      } else {
        setOutcome({ kind: "error", which, message: syncFailureMessage(json.error, json.hint) });
      }
    } catch (e) {
      setOutcome({ kind: "error", which, message: e instanceof Error ? e.message : "network error" });
    }
  }

  const isRunning = outcome.kind === "running";
  return (
    <div className="mt-3 pt-3 border-t border-white/4 flex items-center gap-2 flex-wrap text-[10px] font-mono">
      <span className="text-zinc-500 uppercase tracking-[0.18em]">Sync from provider</span>
      {(["pull_requests", "releases", "workflow_runs"] as const).map((k) => (
        <button
          key={k}
          type="button"
          disabled={isRunning}
          onClick={() => trigger(k)}
          className="px-2 py-1 rounded-sm border border-white/8 bg-white/2 text-zinc-300 hover:border-white/15 hover:text-white disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {outcome.kind === "running" && outcome.which === k
            ? "syncing…"
            : k === "pull_requests" ? "PRs" : k === "releases" ? "Releases" : "Workflow runs"}
        </button>
      ))}
      {outcome.kind === "ok" && (
        <span role="status" className="text-emerald-300">
          ✓ {outcome.which.replace("_", " ")} · fetched {outcome.fetched} · upserted {outcome.upserted}
          {outcome.skipped > 0 && ` · skipped ${outcome.skipped}`}
        </span>
      )}
      {outcome.kind === "error" && (
        <span role="status" className="text-rose-300">✗ {outcome.which.replace("_", " ")} · {outcome.message}</span>
      )}
    </div>
  );
}
