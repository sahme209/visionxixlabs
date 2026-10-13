"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalDecisionButtons({ proposalId, disabledReason }: { proposalId: string; disabledReason?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setPending(decision); setError(null);
    try {
      const response = await fetch(`/api/control/agent/actions/${encodeURIComponent(proposalId)}/decision`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "decision_failed");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Decision failed");
    } finally { setPending(null); }
  }

  if (disabledReason) return <p className="max-w-xs text-xs text-zinc-600">{disabledReason}</p>;
  return <div className="text-right">
    <div className="flex gap-2">
      <button type="button" disabled={pending !== null} onClick={() => void decide("reject")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.05] disabled:opacity-50">{pending === "reject" ? "Rejecting…" : "Reject"}</button>
      <button type="button" disabled={pending !== null} onClick={() => void decide("approve")} className="rounded-lg bg-[#f54e00] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ff6424] disabled:opacity-50">{pending === "approve" ? "Approving…" : "Approve & execute"}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
  </div>;
}
