"use client";

/**
 * /dashboard/workflow-translator — operator types intent, gets a
 * reviewable workflow draft. Draft is NEVER applied automatically.
 */

import { useCallback, useState } from "react";
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

  const run = useCallback(() => {
    setBusy(true); setError(null); setResp(null);
    fetch("/api/workflows/translate", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent }),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: TranslateResp; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setResp(j.data);
        else setError(j.error?.userMessage ?? "Translation failed.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setBusy(false));
  }, [intent]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <SparklesIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              Workflow translator · approval_only_no_execution
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Plain English. <span className="text-gradient">Reviewable workflow.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Type what should happen. The translator drafts a structured workflow with allowed triggers and stage-only
          actions. Axiom never auto-applies a workflow — your review is the deciding step.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 max-w-3xl mb-6">
        <textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={4}
          placeholder="e.g. when an S3 bucket gets public ACL, page security and stage a remediation runbook"
          maxLength={2000}
          className="w-full rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] font-mono text-zinc-200 focus:border-indigo-400/60 focus:outline-none mb-3"
        />
        <button
          onClick={run}
          disabled={busy || intent.trim().length === 0}
          className="inline-flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <PlayIcon className="h-3.5 w-3.5" />
          {busy ? "Drafting…" : "Translate"}
        </button>
        {error && <p role="alert" aria-live="assertive" className="mt-3 text-[11px] font-mono text-rose-300">{error}</p>}
      </div>

      {resp && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 max-w-3xl">
          <div className="flex items-center gap-2 mb-3 text-[10px] font-mono text-zinc-500">
            <span>provider: <span className="text-indigo-300">{resp.provider ?? "(none)"}</span></span>
            <span>model: <span className="text-zinc-300">{resp.model ?? "(none)"}</span></span>
            <span>{resp.latencyMs}ms</span>
            <span>aiUsed: <span className={resp.aiUsed ? "text-emerald-300" : "text-amber-300"}>{String(resp.aiUsed)}</span></span>
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
                <p className="font-mono text-indigo-300">{resp.draft.trigger.kind} · {resp.draft.trigger.selector}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Actions</p>
                <ul className="space-y-1">
                  {resp.draft.actions.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 font-mono text-zinc-300">
                      <span className="text-indigo-300 w-44 truncate">{a.kind}</span>
                      <span>{a.label}</span>
                      {a.reason && <span className="text-zinc-500">— {a.reason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[10px] font-mono text-zinc-500 pt-2 border-t border-white/[0.04]">
                approval_only_no_execution · drafts are never auto-applied.
              </p>
            </div>
          ) : (
            <div className="text-[12px] text-zinc-400">
              No draft produced. <span className="font-mono text-rose-300">reason: {resp.rejectionReason ?? "unknown"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
