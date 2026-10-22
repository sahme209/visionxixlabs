"use client";

import { useEffect, useRef, useState } from "react";

type Outcome = { status: "executed" | "rejected" | "failed" | "unconfirmed"; message: string };

export function ApprovalDecisionButtons({ proposalId, disabledReason, approveDisabledReason }: { proposalId: string; disabledReason?: string; approveDisabledReason?: string }) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { if (outcome) feedback.current?.focus(); }, [outcome]);

  async function decide(decision: "approve" | "reject") {
    if (pending !== null || outcome || disabledReason || (decision === "approve" && approveDisabledReason)) return;
    setPending(decision);
    try {
      const response = await fetch(`/api/control/agent/actions/${encodeURIComponent(proposalId)}/decision`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; status?: string; error?: string; errorMessage?: string } | null;
      const validStatus = decision === "reject" ? body?.status === "rejected" : body?.status === "executed" || body?.status === "failed";
      if (!response.ok || body?.ok !== true || !validStatus) throw new Error(body?.error ?? "decision_unconfirmed");
      if (body.status === "failed") {
        setOutcome({ status: "failed", message: body.errorMessage === "deployment_outcome_unknown"
          ? "Action approved; provider outcome is unconfirmed. Its reservation is retained. Review the provider result and audit before taking further action."
          : "Action approved, but execution failed. Review the action evidence before taking further action." });
      } else {
        setOutcome(body.status === "rejected"
          ? { status: "rejected", message: "Proposal rejected. No action was executed." }
          : { status: "executed", message: "Action approved and executed. Review the execution evidence for validation." });
      }
    } catch (cause) {
      const reasons: Record<string, string> = {
        workspace_agent_disabled: "The workspace Agent is disabled. Review its saved policy, then reload approvals.",
        agent_tool_not_allowed: "The current Agent policy does not allow this tool. Review its saved permissions, then reload approvals.",
        approver_role_required: "A current approver role is required. Reload approvals to verify access.",
        self_approval_forbidden: "A different authorized user must decide this proposal. Reload approvals to check its current state.",
        approval_expired: "This proposal has expired. Reload approvals to see current proposals.",
        proposal_integrity_failed: "The proposal could not pass its integrity check. Request a new proposal and reload approvals.",
      };
      const code = cause instanceof Error ? cause.message : "";
      setOutcome({ status: "unconfirmed", message: Object.prototype.hasOwnProperty.call(reasons, code) ? reasons[code] : "The decision was not confirmed. Reload approvals to check its current state before trying again." });
    } finally { setPending(null); }
  }

  if (disabledReason) return <p className="max-w-xs text-xs text-zinc-500">{disabledReason}</p>;
  if (outcome) return <div className="max-w-xs space-y-3 text-left">
    <div ref={feedback} tabIndex={-1} role={outcome.status === "failed" || outcome.status === "unconfirmed" ? "alert" : "status"} className={`text-xs leading-5 outline-none ${outcome.status === "failed" || outcome.status === "unconfirmed" ? "text-amber-200" : "text-zinc-300"}`}>{outcome.message}</div>
    <button type="button" onClick={() => window.location.reload()} className="h-8 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/5">Reload approvals</button>
  </div>;
  return <div className="text-right">
    <div className="flex gap-2">
      <button type="button" disabled={pending !== null} onClick={() => void decide("reject")} className="h-8 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/[0.05] disabled:opacity-50">{pending === "reject" ? "Rejecting…" : "Reject"}</button>
      <button type="button" disabled={pending !== null || Boolean(approveDisabledReason)} aria-describedby={approveDisabledReason ? `${proposalId}-approve-reason` : undefined} onClick={() => void decide("approve")} className="h-8 rounded-lg bg-[#f54e00] px-3 text-xs font-semibold text-white hover:bg-[#ff6424] disabled:opacity-50">{pending === "approve" ? "Approving…" : "Approve & execute"}</button>
    </div>
    {approveDisabledReason && <p id={`${proposalId}-approve-reason`} className="mt-2 max-w-xs text-xs text-zinc-500">{approveDisabledReason}</p>}
  </div>;
}
