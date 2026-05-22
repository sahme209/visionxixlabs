"use client";

/**
 * Coding-task start form — Phase 379.
 *
 * Captures instruction + repo target + optional branch hint, posts
 * to /api/workforce/coding-tasks/start, and routes the operator to
 * the task detail page on success.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BoltIcon, ArrowPathIcon, CodeBracketIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export function CodingTaskForm() {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [repoRef, setRepoRef] = useState("");
  const [branchHint, setBranchHint] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/workforce/coding-tasks/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instruction,
          repoRef,
          branchHint: branchHint || null,
        }),
      });
      const json = await res.json() as { ok?: boolean; codingTaskId?: string | null; runId?: string; reason?: string; detail?: string };
      if (!res.ok || !json.ok) {
        setState({ kind: "error", message: json.detail ?? json.reason ?? `HTTP ${res.status}` });
        return;
      }
      if (json.codingTaskId) {
        router.push(`/dashboard/workforce/coding/${json.codingTaskId}`);
      } else if (json.runId) {
        router.push(`/dashboard/workforce/pipelines/runs/${json.runId}`);
      } else {
        router.push("/dashboard/workforce/coding");
      }
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  const submitting = state.kind === "submitting";

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Instruction — what do you want the AI engineer to do?">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          maxLength={4000}
          placeholder='e.g. "Add a /healthz endpoint that returns 200 with the build sha."'
          rows={4}
          className="form-textarea"
          disabled={submitting}
          required
          minLength={5}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Repository">
          <input
            type="text"
            value={repoRef}
            onChange={(e) => setRepoRef(e.target.value)}
            maxLength={200}
            placeholder="owner/repo"
            className="form-input"
            disabled={submitting}
            required
          />
        </Field>

        <Field label="Branch hint (optional)">
          <input
            type="text"
            value={branchHint}
            onChange={(e) => setBranchHint(e.target.value)}
            maxLength={200}
            placeholder="main"
            className="form-input"
            disabled={submitting}
          />
        </Field>
      </div>

      {state.kind === "error" && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-[12px] text-rose-200">
          <ExclamationTriangleIcon className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2 flex-wrap">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-100 border border-violet-500/40 hover:bg-violet-500/30 transition disabled:opacity-50 text-[13px] font-medium"
        >
          {submitting ? (
            <>
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              Staging…
            </>
          ) : (
            <>
              <BoltIcon className="h-3.5 w-3.5" />
              Run AI coding loop
            </>
          )}
        </button>
        <p className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
          <CodeBracketIcon className="h-3 w-3" />
          7-stage pipeline · pauses for two-step approval before PR opens.
        </p>
      </div>

      <style jsx>{`
        :global(.form-input),
        :global(.form-textarea) {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #e4e4e7;
          font-size: 12.5px;
          padding: 8px 10px;
          border-radius: 8px;
          outline: none;
        }
        :global(.form-input:focus),
        :global(.form-textarea:focus) {
          border-color: rgba(139, 92, 246, 0.5);
        }
        :global(.form-input:disabled),
        :global(.form-textarea:disabled) {
          opacity: 0.5;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
