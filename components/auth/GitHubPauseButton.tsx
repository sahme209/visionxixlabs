"use client";

/**
 * Non-destructive pause/resume for a GitHub installation — the
 * complement to GitHubDisconnectButton. Uses the same transition
 * endpoint with action "suspend" / "reactivate" instead of "revoke",
 * so Axiom's read of the installation stops without erasing the
 * installation record the way disconnect does.
 */

import { useState } from "react";

export function GitHubPauseButton({ installationRowId, suspended }: { installationRowId: string; suspended: boolean }) {
  const [state, setState] = useState<"idle" | "working" | "unavailable">("idle");

  async function transition() {
    setState("working");
    try {
      const response = await fetch("/api/dashboard/github-installation-transition", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationRowId, action: suspended ? "reactivate" : "suspend" }),
      });
      if (!response.ok) throw new Error("transition_unavailable");
      window.location.reload();
    } catch {
      setState("unavailable");
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void transition()}
        disabled={state === "working"}
        className="inline-flex min-h-10 items-center rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.06] disabled:opacity-60"
      >
        {state === "working" ? "Updating…" : suspended ? "Resume GitHub" : "Pause GitHub"}
      </button>
      {state === "unavailable" && <p role="status" className="mt-2 text-xs leading-5 text-zinc-500">The installation was not changed. Try again from this workspace.</p>}
    </div>
  );
}
