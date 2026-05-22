"use client";

/**
 * Approve / Reject buttons for engineer-sourced approvals.
 *
 * Posts to /api/workforce/approvals/[id]/decide and refreshes the
 * server page on success so the row's status badge flips live.
 *
 * "Approved" is one click. "Rejected" requires a short reason captured
 * inline so the planner gets feedback (the reason is also written into
 * the audit row).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface Props {
  approvalId: string;
  /** Current status — buttons hide when already decided. */
  status: string;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "rejecting" }
  | { kind: "saving"; decision: "approved" | "rejected" }
  | { kind: "error"; message: string };

export function ApprovalDecisionButtons({ approvalId, status }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [reason, setReason] = useState("");

  if (status !== "pending") {
    return (
      <span className="text-[10px] font-mono text-zinc-500">
        decided · no action needed
      </span>
    );
  }

  async function decide(decision: "approved" | "rejected", reasonValue?: string) {
    setState({ kind: "saving", decision });
    try {
      const res = await fetch(`/api/workforce/approvals/${approvalId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ decision, reason: reasonValue }),
      });
      const json = (await res.json()) as { ok?: boolean; reason?: string; detail?: string };
      if (!res.ok || !json.ok) {
        setState({ kind: "error", message: json.detail ?? json.reason ?? `HTTP ${res.status}` });
        return;
      }
      setState({ kind: "idle" });
      router.refresh();
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  if (state.kind === "rejecting") {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you rejecting? (1 line)"
          autoFocus
          className="w-full rounded-md border border-rose-500/30 bg-rose-500/[0.05] px-2 py-1 text-[11px] text-rose-100 placeholder:text-rose-300/40 focus:outline-none focus:border-rose-500/60"
        />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => decide("rejected", reason || undefined)}
            disabled={reason.trim().length === 0}
            className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-md bg-rose-500/20 text-rose-100 border border-rose-500/40 hover:bg-rose-500/30 transition disabled:opacity-50"
          >
            <XCircleIcon className="h-3 w-3" /> Confirm reject
          </button>
          <button
            onClick={() => setState({ kind: "idle" })}
            className="text-[10.5px] text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => decide("approved")}
        disabled={state.kind === "saving"}
        className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-100 border border-emerald-500/40 hover:bg-emerald-500/25 transition disabled:opacity-50"
      >
        {state.kind === "saving" && state.decision === "approved" ? (
          <>
            <ArrowPathIcon className="h-3 w-3 animate-spin" />
            …
          </>
        ) : (
          <>
            <CheckCircleIcon className="h-3 w-3" />
            Approve
          </>
        )}
      </button>
      <button
        onClick={() => setState({ kind: "rejecting" })}
        disabled={state.kind === "saving"}
        className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition disabled:opacity-50"
      >
        <XCircleIcon className="h-3 w-3" />
        Reject
      </button>
      {state.kind === "error" && (
        <span className="text-[10px] text-rose-300" title={state.message}>error</span>
      )}
    </div>
  );
}
