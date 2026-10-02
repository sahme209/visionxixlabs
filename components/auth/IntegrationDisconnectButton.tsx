"use client";

import { useState } from "react";

export function IntegrationDisconnectButton({ provider, label }: { provider: "slack" | "teams"; label: string }) {
  const [state, setState] = useState<"idle" | "disconnecting" | "unavailable">("idle");

  async function disconnect() {
    setState("disconnecting");
    try {
      const response = await fetch(`/api/account/integrations/${provider}/disconnect`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("disconnect_unavailable");
      window.location.reload();
    } catch {
      setState("unavailable");
    }
  }

  return (
    <div className="mt-5">
      <button type="button" onClick={() => void disconnect()} disabled={state === "disconnecting"} className="inline-flex min-h-10 items-center rounded-xl border border-rose-300/20 bg-rose-300/[0.05] px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-300/[0.1] disabled:opacity-60">
        {state === "disconnecting" ? "Disconnecting…" : `Disconnect ${label}`}
      </button>
      {state === "unavailable" && <p role="status" className="mt-3 text-xs leading-5 text-zinc-500">The connection was not changed. Try again from this workspace.</p>}
    </div>
  );
}
