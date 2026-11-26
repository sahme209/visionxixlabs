"use client";
import { useCallback, useEffect, useState } from "react";
import type { PolicyDiff } from "@/lib/releaseops/policyAsCode";
import type { PolicyBacktest } from "@/lib/releaseops/policyBacktest";
type DiffWithBacktest = PolicyDiff & { backtest?: PolicyBacktest | null };

/** Export policy rules for Git, preview a proposed file, and request it as a change that a different admin must approve. */
export function PolicyAsCodePanel() {
  const [text, setText] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "diff"; diff: DiffWithBacktest } | { kind: "error"; messages: string[] }>({ kind: "idle" });
  const [requestState, setRequestState] = useState<{ kind: "idle" | "busy" | "sent" } | { kind: "error"; message: string }>({ kind: "idle" });
  const [refresh, setRefresh] = useState(0);
  async function requestChange() {
    setRequestState({ kind: "busy" });
    try {
      const res = await fetch("/api/control/policy/requests", { method: "POST", body: text, headers: { "Content-Type": "application/json" } });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) { setRequestState({ kind: "sent" }); setRefresh((n) => n + 1); return; }
      setRequestState({ kind: "error", message: body?.error === "policy_unchanged" ? "This file matches the current rules; there is nothing to request." : "The request could not be created. Try again." });
    } catch { setRequestState({ kind: "error", message: "The request could not be reached. Try again." }); }
  }
  async function compare() {
    setState({ kind: "busy" }); setRequestState({ kind: "idle" });
    try {
      const res = await fetch("/api/control/policy/diff", { method: "POST", body: text, headers: { "Content-Type": "application/json" } });
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: DiffWithBacktest; issues?: string[]; error?: string } | null;
      if (res.ok && body?.ok && body.data) setState({ kind: "diff", diff: body.data });
      else setState({ kind: "error", messages: body?.issues ?? [body?.error === "workspace_admin_required" ? "Only workspace owners and admins can compare policy files." : "The file could not be compared. Try again."] });
    } catch { setState({ kind: "error", messages: ["The comparison could not be reached. Try again."] }); }
  }
  const d = state.kind === "diff" ? state.diff : null;
  return (
    <section aria-labelledby="policy-as-code-heading" className="border-t border-white/8 py-7">
      <h2 id="policy-as-code-heading" className="text-base font-medium">Policy as code</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Download this workspace’s policy rules as a file to review and version in Git. Paste a changed file to preview its effect, then request it as a change. A different owner or admin approves it before it applies; previewing never changes a rule.</p>
      <a href="/api/control/policy/export" className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200 hover:bg-white/5">Download policy file</a>
      <label className="mt-5 block text-xs text-zinc-400" htmlFor="policy-file-text">Proposed policy file (JSON)</label>
      <textarea id="policy-file-text" value={text} onChange={(e) => setText(e.target.value)} rows={6} spellCheck={false}
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-zinc-200" placeholder='{"kind":"v19.policy","version":1,"rules":[…]}' />
      <button type="button" onClick={() => void compare()} disabled={!text.trim() || state.kind === "busy"} className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">
        {state.kind === "busy" ? "Comparing…" : "Preview changes"}
      </button>
      <div aria-live="polite" className="mt-4 text-sm">
        {state.kind === "error" && <ul className="list-disc pl-5 text-amber-300">{state.messages.map((m) => <li key={m}>{m}</li>)}</ul>}
        {d && <div className="space-y-3 text-zinc-300">
          <p>{d.added.length} added · {d.changed.length} changed · {d.removed.length} removed · {d.unchanged} unchanged</p>
          {d.loosening.length > 0 && <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3"><p className="font-medium text-amber-200">Loosens governance</p><ul className="mt-1 list-disc pl-5 text-amber-100/90">{d.loosening.map((l) => <li key={l}>{l}</li>)}</ul></div>}
          {d.changed.length > 0 && <ul className="space-y-1 font-mono text-xs">{d.changed.map((c) => <li key={c.key}>{c.key}: {c.fields.map((f) => `${f.field} ${JSON.stringify(f.from)} → ${JSON.stringify(f.to)}`).join(", ")}</li>)}</ul>}
          {d.added.length > 0 && <p className="text-xs">Added: {d.added.map((r) => r.key).join(", ")}</p>}
          {d.removed.length > 0 && <p className="text-xs">Removed: {d.removed.join(", ")}</p>}
          {d.backtest === null ? <p className="text-xs text-zinc-400">Past releases could not be read, so no backtest is shown.</p>
            : d.backtest && <div className="rounded-lg border border-white/10 p-3 text-xs">
              <p className="font-medium text-zinc-200">Backtest · releases with recorded violations in the last 90 days</p>
              <p className="mt-1 text-zinc-300">{d.backtest.releases === 0 ? "No recorded violations in the last 90 days, so there is nothing to replay." : `Of ${d.backtest.releases} releases, ${d.backtest.blockedNow} were blocked under the current rules; ${d.backtest.blockedProposed} would be under this file.`}</p>
              {d.backtest.newlyBlocked.length > 0 && <p className="mt-1 text-amber-200">Would now be blocked: {d.backtest.newlyBlocked.length} {d.backtest.newlyBlocked.length === 1 ? "release" : "releases"}.</p>}
              {d.backtest.newlyUnblocked.length > 0 && <p className="mt-1 text-amber-200">Would no longer be blocked: {d.backtest.newlyUnblocked.length} {d.backtest.newlyUnblocked.length === 1 ? "release" : "releases"}.</p>}
              {d.backtest.byRule.length > 0 && <ul className="mt-1 font-mono text-zinc-400">{d.backtest.byRule.map((r) => <li key={r.key}>{r.key}: {r.blockedNow} → {r.blockedProposed} blocked</li>)}</ul>}
              {d.backtest.rulesWithoutHistory.length > 0 && <p className="mt-1 text-zinc-400">New rules have no history yet, so their effect is unknown: {d.backtest.rulesWithoutHistory.join(", ")}.</p>}
            </div>}
          <p className="text-xs text-zinc-400">This is a preview. To apply it, request the change; a different owner or admin must approve it.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={requestState.kind === "busy" || requestState.kind === "sent"} onClick={() => void requestChange()} className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200 disabled:opacity-50">{requestState.kind === "busy" ? "Requesting…" : requestState.kind === "sent" ? "Change requested" : "Request this change"}</button>
            {requestState.kind === "error" && <span className="text-xs text-amber-300">{requestState.message}</span>}
          </div>
        </div>}
      </div>
      <PolicyChangeRequests refresh={refresh} />
    </section>
  );
}

interface ChangeRequest { id: string; loosens: boolean; status: string; proposedByUserId: string; createdAt: string; diffJson: { added: Array<{ key: string }>; removed: string[]; changed: Array<{ key: string }>; loosening: string[] } }

function PolicyChangeRequests({ refresh }: { refresh: number }) {
  const [data, setData] = useState<{ viewerUserId: string; requests: ChangeRequest[] } | null | "unavailable">(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const res = await fetch("/api/control/policy/requests", { cache: "no-store" }); const body = await res.json(); setData(res.ok && body.ok ? body.data : "unavailable"); }
    catch { setData("unavailable"); }
  }, []);
  useEffect(() => { void load(); }, [load, refresh]);
  async function decide(id: string, decision: "approve" | "reject") {
    setMessage(null);
    try {
      const res = await fetch(`/api/control/policy/requests/${encodeURIComponent(id)}/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string; data?: { result: string } } | null;
      setMessage(body?.ok ? (body.data?.result === "applied" ? "Applied. The policy rules now match the reviewed file." : "Rejected. Nothing changed.")
        : body?.error === "policy_changed_since_request" ? "The rules changed after this request was made, so it was marked stale and nothing was applied. Request the change again."
        : body?.error === "independent_reviewer_required" ? "A different owner or admin must decide your own request."
        : "The decision could not be recorded. Try again.");
    } catch { setMessage("The decision could not be reached. Try again."); }
    await load();
  }
  if (data === null || data === "unavailable" || data.requests.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-zinc-200">Change requests</h3>
      <ul className="mt-2 divide-y divide-white/[0.07] rounded-xl border border-white/8 text-sm">
        {data.requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
            <div>
              <p className="text-zinc-200">{r.diffJson.added.length} added · {r.diffJson.changed.length} changed · {r.diffJson.removed.length} removed{r.loosens && <span className="ml-2 text-amber-300">loosens governance</span>}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {r.status}{r.proposedByUserId === data.viewerUserId ? " · requested by you" : ""}</p>
              {r.status === "pending" && <details className="mt-1 text-xs text-zinc-300"><summary className="cursor-pointer text-zinc-400">What changes</summary>
                <ul className="mt-1 space-y-0.5 font-mono">
                  {r.diffJson.added.map((a) => <li key={`a-${a.key}`}>adds {a.key}</li>)}
                  {r.diffJson.changed.map((c) => <li key={`c-${c.key}`}>changes {c.key}</li>)}
                  {r.diffJson.removed.map((k) => <li key={`r-${k}`}>disables {k}</li>)}
                  {r.diffJson.loosening.map((l) => <li key={`l-${l}`} className="text-amber-300">{l}</li>)}
                </ul></details>}
            </div>
            {r.status === "pending" && r.proposedByUserId !== data.viewerUserId && <div className="flex gap-2">
              <button type="button" onClick={() => void decide(r.id, "approve")} className="inline-flex min-h-8 items-center rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-950">Approve and apply</button>
              <button type="button" onClick={() => void decide(r.id, "reject")} className="inline-flex min-h-8 items-center rounded-lg border border-white/12 px-3 text-xs text-zinc-200">Reject</button>
            </div>}
          </li>))}
      </ul>
      <p aria-live="polite" className="mt-2 text-xs text-zinc-300">{message}</p>
    </div>);
}
