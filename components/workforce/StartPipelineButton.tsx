"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BoltIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface Props {
  pipelineId: string;
  label?: string;
}

type State = { kind: "idle" } | { kind: "starting" } | { kind: "error"; message: string };

export function StartPipelineButton({ pipelineId, label = "Run pipeline" }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function start() {
    if (state.kind === "starting") return;
    setState({ kind: "starting" });
    try {
      const res = await fetch(`/api/workforce/pipelines/${pipelineId}/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json() as { ok?: boolean; runId?: string; reason?: string };
      if (!res.ok || !json.ok || !json.runId) {
        setState({ kind: "error", message: json.reason ?? `HTTP ${res.status}` });
        return;
      }
      router.push(`/dashboard/workforce/pipelines/runs/${json.runId}`);
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={start}
        disabled={state.kind === "starting"}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/40 hover:bg-violet-500/25 transition disabled:opacity-50"
      >
        {state.kind === "starting" ? (
          <>
            <ArrowPathIcon className="h-3 w-3 animate-spin" />
            Starting…
          </>
        ) : (
          <>
            <BoltIcon className="h-3 w-3" />
            {label}
          </>
        )}
      </button>
      {state.kind === "error" && (
        <span className="text-[10.5px] font-mono text-rose-300">{state.message}</span>
      )}
    </div>
  );
}
