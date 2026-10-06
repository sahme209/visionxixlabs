"use client";

import { useState } from "react";

/**
 * Non-destructive pause/resume for Slack/Teams — the complement to
 * IntegrationDisconnectButton. Keeps the stored credential, unlike
 * disconnect, so resuming does not require re-consenting with the provider.
 */
export function IntegrationPauseButton({ provider, label, suspended }: { provider: "slack" | "teams"; label: string; suspended: boolean }) {
  const [state, setState] = useState<"idle" | "working" | "unavailable">("idle");

  async function transition() {
    setState("working");
    try {
      const response = await fetch(`/api/account/integrations/${provider}/pause`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: suspended ? "resume" : "suspend" }),
      });
      if (!response.ok) throw new Error("pause_unavailable");
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
        {state === "working" ? "Updating…" : suspended ? `Resume ${label}` : `Pause ${label}`}
      </button>
      {state === "unavailable" && <p role="status" className="mt-2 text-xs leading-5 text-zinc-500">The connection was not changed. Try again from this workspace.</p>}
    </div>
  );
}
