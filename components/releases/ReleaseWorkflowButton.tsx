"use client";

import { useRef, useState, type MouseEvent } from "react";

type ReceiptEvidence = { requestedOperation?: "service_restart" };
type State = { kind: "idle" | "sending" } | { kind: "accepted"; evidence?: ReceiptEvidence; partial: boolean } | { kind: "unknown" } | { kind: "error"; message: string };

/** Workflow acceptance is neither a new source-artifact release nor health proof. */
export function ReleaseWorkflowButton({ releaseId }: { releaseId: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const inFlight = useRef(false);
  async function dispatch(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault(); event.stopPropagation();
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/dashboard/release-deploy", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ releaseId }),
      });
      const body = await response.json();
      if (response.ok && body.ok === true) setState({ kind: "accepted", evidence: body.data?.evidence, partial: false });
      else if (body.error === "dispatched_but_lifecycle_transition_failed") setState({ kind: "accepted", evidence: body.evidence, partial: true });
      else if (body.error === "deployment_outcome_unknown" || body.error === "dispatch_failed") setState({ kind: "unknown" });
      else { inFlight.current = false; setState({ kind: "error", message: body.hint ?? body.error ?? "Workflow request failed." }); }
    } catch {
      // A lost response cannot establish whether the provider accepted a write.
      setState({ kind: "unknown" });
    }
  }
  if (state.kind === "accepted" || state.kind === "unknown") return (
    <span role="status" className="max-w-xs text-[10px] text-zinc-400">
      {state.kind === "unknown" ? "Workflow dispatch outcome unconfirmed. Review GitHub Actions before retrying." : <>
        {state.partial ? "Workflow dispatched; release record update unconfirmed." : "Workflow dispatch accepted."}
        {state.evidence?.requestedOperation === "service_restart" ? " Requested operation: ECS service restart." : " Requested operation unverified."}
      </>}
      {" Installed workflow behavior, source artifact release, application health and image rollback remain unverified."}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" onClick={dispatch} disabled={state.kind === "sending"} title="Dispatch the configured workflow. The bundled template requests a service restart; it does not release a new artifact." className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-orange-500/40 bg-orange-500/[0.12] text-orange-100 hover:bg-orange-500/[0.20] disabled:opacity-50 disabled:cursor-wait transition-colors">
        {state.kind === "sending" ? "dispatching…" : "Dispatch workflow"}
      </button>
      {state.kind === "error" && <span role="alert" className="text-[9.5px] font-mono text-rose-300">{state.message}</span>}
    </span>
  );
}
