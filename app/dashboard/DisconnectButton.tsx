"use client";

/**
 * Inline disconnect control for the dashboard's Connected accounts
 * list. Quiet by default, confirms before posting so a stray click
 * doesn't take the user's automation offline. Calls the parent's
 * onComplete after a successful disconnect so the stats row + the
 * connected-accounts list refresh in place.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DisconnectButton({
  provider,
  onComplete,
}: {
  provider: "aws" | "azure" | "gcp";
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "confirming" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPhase("working");
    setError(null);
    try {
      const res = await fetch(`/api/connectors/${provider}/disconnect`, { method: "POST" });
      const data: { ok?: boolean; error?: string; hint?: string } = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.hint ?? data.error ?? "Disconnect failed.");
        setPhase("error");
        return;
      }
      router.refresh();
      onComplete?.();
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  if (phase === "confirming") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-zinc-500">disconnect?</span>
        <button
          onClick={run}
          className="text-[10px] font-mono uppercase tracking-wider text-rose-300 hover:text-rose-200 transition-colors"
        >
          confirm
        </button>
        <button
          onClick={() => setPhase("idle")}
          className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          cancel
        </button>
      </div>
    );
  }
  if (phase === "working") {
    return <span className="text-[10px] font-mono text-zinc-500">disconnecting…</span>;
  }
  if (phase === "error") {
    return (
      <button
        onClick={() => { setPhase("idle"); setError(null); }}
        className="text-[10px] font-mono text-rose-300 hover:text-rose-200 transition-colors"
        title={error ?? undefined}
      >
        retry
      </button>
    );
  }
  return (
    <button
      onClick={() => setPhase("confirming")}
      className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200 transition-colors"
    >
      disconnect
    </button>
  );
}
