"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Approve / reject one pending agent request. The server re-checks admin role, expiry and separation of duties. */
export function AgentGatewayDecision({ organizationId, requestId }: { organizationId: string; requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [note, setNote] = useState(""); const [error, setError] = useState<string | null>(null);
  async function decide(decision: "approve" | "reject") {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/agent-gateway/requests/${encodeURIComponent(requestId)}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, decision, note: note || undefined }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) setError(body.error === "self_approval_forbidden" ? "You minted this agent's key, so another admin must decide." : `Could not ${decision} (${body.error ?? res.status}).`);
      else router.refresh();
    } finally { setBusy(false); }
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`note-${requestId}`}>Decision note</label>
      <input id={`note-${requestId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={1000} className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm" />
      <button type="button" disabled={busy} onClick={() => void decide("approve")} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-950 disabled:opacity-50">Approve</button>
      <button type="button" disabled={busy} onClick={() => void decide("reject")} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50">Reject</button>
      {error && <p role="alert" className="w-full text-xs text-rose-300">{error}</p>}
    </div>
  );
}
