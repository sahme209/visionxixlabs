"use client";

import { useState } from "react";

export function GitHubDisconnectButton({ installationRowId }: { installationRowId: string }) {
  const [state, setState] = useState<"idle" | "disconnecting" | "unavailable">("idle");

  async function disconnect() {
    setState("disconnecting");
    try {
      const response = await fetch("/api/dashboard/github-installation-transition", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationRowId, action: "revoke" }),
      });
      if (!response.ok) throw new Error("disconnect_unavailable");
      window.location.reload();
    } catch {
      setState("unavailable");
    }
  }

  return (
    <div className="mt-5">
      <button type="button" onClick={() => void disconnect()} disabled={state === "disconnecting"} className="inline-flex min-h-10 items-center rounded-xl border border-rose-300/20 bg-rose-300/[0.05] px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-300/[0.1] disabled:opacity-60">
        {state === "disconnecting" ? "Disconnecting…" : "Stop using GitHub in Axiom"}
      </button>
      <p className="mt-3 text-xs leading-5 text-zinc-500">This revokes Axiom’s local installation record. You can also remove the GitHub App from GitHub when you no longer need it.</p>
      {state === "unavailable" && <p role="status" className="mt-2 text-xs leading-5 text-zinc-500">The installation was not changed. Try again from this workspace.</p>}
    </div>
  );
}
