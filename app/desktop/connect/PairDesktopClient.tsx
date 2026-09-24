"use client";

import { useState } from "react";

export function PairDesktopClient({ challenge, deviceLabel }: { challenge: string; deviceLabel: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

  async function approve() {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/desktop/pair/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Pairing failed.");
      setState("done");
    } catch (cause) {
      setState("idle");
      setError(cause instanceof Error ? cause.message : "Pairing failed.");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-emerald-100">
        <p className="font-semibold">Desktop connected</p>
        <p className="mt-1 text-sm text-emerald-200/75">Return to Axiom Agent. This browser tab can be closed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Device requesting access</p>
        <p className="mt-2 font-mono text-zinc-100">{deviceLabel}</p>
      </div>
      {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      <button
        type="button"
        onClick={approve}
        disabled={state === "loading"}
        className="w-full rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
      >
        {state === "loading" ? "Connecting…" : "Connect this desktop"}
      </button>
    </div>
  );
}
