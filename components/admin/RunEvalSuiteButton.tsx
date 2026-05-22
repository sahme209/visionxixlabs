"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BoltIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

export function RunEvalSuiteButton({ dryRun = false }: { dryRun?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function fire() {
    if (state === "running") return;
    setState("running");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/eval-runs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dryRun }),
      });
      const json = await res.json() as { ok?: boolean; reason?: string };
      if (!res.ok || !json.ok) {
        setState("error");
        setMessage(json.reason ?? `HTTP ${res.status}`);
        return;
      }
      setState("idle");
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={fire}
        disabled={state === "running"}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-100 border border-violet-500/40 hover:bg-violet-500/30 transition disabled:opacity-50"
      >
        {state === "running" ? (
          <>
            <ArrowPathIcon className="h-3 w-3 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <BoltIcon className="h-3 w-3" />
            {dryRun ? "Dry-run eval suite" : "Run eval suite"}
          </>
        )}
      </button>
      {state === "error" && message && (
        <span className="text-[10.5px] font-mono text-rose-300">{message}</span>
      )}
    </div>
  );
}
