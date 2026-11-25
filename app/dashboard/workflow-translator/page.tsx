"use client";

/**
 * /dashboard/workflow-translator — operator types intent, gets a
 * reviewable workflow draft. Draft is NEVER applied automatically.
 */

import { useCallback, useRef, useState } from "react";
import { SparklesIcon, PlayIcon } from "@heroicons/react/24/outline";

type TriggerKind = "telemetry_signal" | "cloud_inventory_change" | "schedule" | "manual";
type ActionKind = "notify_outbound" | "stage_runbook" | "stage_policy_proposal" | "open_approval_packet" | "log_audit_only";

interface Draft {
  name: string;
  description: string;
  trigger: { kind: TriggerKind; selector: string };
  actions: Array<{ kind: ActionKind; label: string; reason?: string }>;
}
interface TranslateResp {
  draft: Draft | null;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  rejectionReason?: string;
}

export default function WorkflowTranslatorPage() {
  const [intent, setIntent] = useState("");
  const [resp, setResp] = useState<TranslateResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeRequest = useRef(false);
  const request = useRef<{ intent: string; key: string } | null>(null);

  const run = useCallback(async () => {
    if (activeRequest.current || !intent.trim()) return;
    const attempt = request.current?.intent === intent ? request.current : { intent, key: crypto.randomUUID() };
    request.current = attempt;
    activeRequest.current = true;
    setBusy(true); setError(null); setResp(null);
    try {
      const response = await fetch("/api/workflows/translate", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": attempt.key },
        body: JSON.stringify({ intent }),
      });
      const result: { ok?: boolean; data?: TranslateResp; error?: { userMessage?: string } } = await response.json();
      if (result.ok && result.data) {
        setResp(result.data);
        if (result.data.draft) request.current = null;
      } else {
        setError(result.error?.userMessage ?? "Translation failed.");
      }
    } catch {
      setError("The request outcome could not be confirmed. Retry with the same intent to check the same request.");
    } finally {
      activeRequest.current = false;
      setBusy(false);
    }
  }, [intent]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/5 bg-linear-to-br from-white/2.5 via-white/1.5 to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/6 bg-white/2 px-2.5 py-1">
            <SparklesIcon className="h-3.5 w-3.5 text-zinc-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
              Workflow translator · approval_only_no_execution
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Plain English. <span className="text-gradient">Reviewable workflow.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Type what should happen. The translator drafts a structured workflow with allowed triggers and stage-only
          actions. Drafting uses your workspace AI credits and budget. You review the draft before any separate workflow action.
        </p>
      </div>

      <div className="rounded-2xl border border-white/6 bg-white/2 p-5 max-w-3xl mb-6">
        <textarea
          aria-label="Describe the workflow you want"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={4}
          placeholder="e.g. when an S3 bucket gets public ACL, page security and stage a remediation runbook"
          maxLength={2000}
          className="w-full rounded-md border border-white/8 bg-black/30 px-3 py-2 text-[12px] font-mono text-zinc-200 focus:border-zinc-400/60 focus:outline-hidden mb-3"
        />
        <button
          onClick={run}
          disabled={busy || intent.trim().length === 0}
          className="inline-flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-950 border border-zinc-100 hover:bg-white disabled:opacity-50"
        >
          <PlayIcon className="h-3.5 w-3.5" />
          {busy ? "Drafting…" : "Translate"}
        </button>
        {error && <p role="alert" aria-live="assertive" className="mt-3 text-[11px] font-mono text-rose-300">{error}</p>}
      </div>

      {resp && (
        <div className="rounded-2xl border border-white/6 bg-white/2 p-5 max-w-3xl">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono text-zinc-500">
            <span>provider: <span className="text-zinc-300">{resp.provider ?? "(none)"}</span></span>
            <span>model: <span className="text-zinc-300">{resp.model ?? "(none)"}</span></span>
            <span>{resp.latencyMs}ms</span>
            <span>aiUsed: <span className={resp.aiUsed ? "text-emerald-300" : "text-zinc-300"}>{String(resp.aiUsed)}</span></span>
          </div>
          {resp.draft ? (
            <div className="space-y-3 text-[12px]">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Name</p>
                <p className="text-zinc-200 font-medium">{resp.draft.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Description</p>
                <p className="text-zinc-300 leading-snug">{resp.draft.description}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Trigger</p>
                <p className="font-mono text-zinc-300">{resp.draft.trigger.kind} · {resp.draft.trigger.selector}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Actions</p>
                <ul className="space-y-1">
                  {resp.draft.actions.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 font-mono text-zinc-300">
                      <span className="text-zinc-300 w-44 truncate">{a.kind}</span>
                      <span>{a.label}</span>
                      {a.reason && <span className="text-zinc-500">— {a.reason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[10px] font-mono text-zinc-500 pt-2 border-t border-white/4">
                approval_only_no_execution · drafts are never auto-applied.
              </p>
            </div>
          ) : (
            <div className="text-[12px] text-zinc-400">
              <p role="status">{rejectionText(resp.rejectionReason)}</p>
              {(resp.rejectionReason === "ai_workspace_budget_exceeded" || resp.rejectionReason === "ai_credit_pool_exhausted") &&
                <a href="/control/usage-billing" className="mt-2 inline-block text-zinc-200 underline">Review Usage &amp; billing</a>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function rejectionText(reason: string | undefined) {
  switch (reason) {
    case "ai_workspace_budget_exceeded": return "The workspace AI budget cannot cover this request.";
    case "ai_credit_pool_exhausted": return "The workspace has insufficient prepaid AI credits.";
    case "request_already_reserved":
    case "idempotency_key_conflict": return "This request was already accepted or is still being reconciled. No second draft was started.";
    default: return "No workflow draft is available for this request.";
  }
}
