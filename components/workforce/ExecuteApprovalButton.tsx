"use client";

/**
 * Execute-now button for an approved snapshot — Phase 376.
 *
 * Posts to /api/workforce/approvals/[id]/execute. Short-circuits when
 * the snapshot is already executed or in a non-runnable state — the
 * server is still the source of truth, but we avoid the doomed click.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BoltIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Props {
  approvalId: string;
  /** Snapshot status — must be "approved" to run. */
  snapshotStatus: string;
  /** Execution status — must be "not_started". */
  executionStatus: string;
}

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; message: string };

export function ExecuteApprovalButton({ approvalId, snapshotStatus, executionStatus }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  if (snapshotStatus !== "approved") {
    return (
      <span className="text-[10.5px] font-mono text-zinc-500">
        Approval must be approved before executing.
      </span>
    );
  }
  if (executionStatus === "executed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-emerald-300">
        <CheckCircleIcon className="h-3 w-3" />
        Executed.
      </span>
    );
  }
  if (executionStatus === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-rose-300">
        <ExclamationTriangleIcon className="h-3 w-3" />
        Execution failed — manual reset required.
      </span>
    );
  }
  if (executionStatus === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-zinc-300">
        <ArrowPathIcon className="h-3 w-3 animate-spin" />
        Execution in flight…
      </span>
    );
  }

  async function execute() {
    if (state.kind === "running") return;
    setState({ kind: "running" });
    try {
      const res = await fetch(`/api/workforce/approvals/${approvalId}/execute`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json() as { ok?: boolean; reason?: string; detail?: string; error?: string };
      if (!res.ok || !json.ok) {
        setState({ kind: "error", message: json.detail ?? json.error ?? json.reason ?? `HTTP ${res.status}` });
        return;
      }
      setState({ kind: "idle" });
      router.refresh();
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={execute}
        disabled={state.kind === "running"}
        className="inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-white/15 text-zinc-100 border border-white/40 hover:bg-white/25 transition disabled:opacity-50"
      >
        {state.kind === "running" ? (
          <>
            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
            Executing…
          </>
        ) : (
          <>
            <BoltIcon className="h-3.5 w-3.5" />
            Execute now
          </>
        )}
      </button>
      {state.kind === "error" && (
        <span className="text-[10.5px] font-mono text-rose-300">{state.message}</span>
      )}
      <span className="text-[10.5px] text-zinc-500">
        Runs the engineer's executor. Default is dry-run until the real apply path is wired.
      </span>
    </div>
  );
}
