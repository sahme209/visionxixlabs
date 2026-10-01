"use client";

import { useState } from "react";
import Link from "next/link";

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
      if (!response.ok) throw new Error(body.message || body.error || "Pairing failed.");
      setState("done");
      window.setTimeout(() => window.location.assign("axiom-agent://auth/complete"), 450);
    } catch (cause) {
      setState("idle");
      setError(cause instanceof Error ? cause.message : "Pairing failed.");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-emerald-100">
        <p className="font-semibold">Axiom Agent is authorized</p>
        <p className="mt-1 text-sm text-emerald-200/75">The installed app will verify and consume this approval once. You may close this tab after Axiom Agent opens.</p>
        <a href="axiom-agent://auth/complete" className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-100">
          Open Axiom Agent
        </a>
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
      <div className="grid grid-cols-2 gap-3">
        <Link href="/" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/[0.08]">Cancel</Link>
        <button
          type="button"
          onClick={approve}
          disabled={state === "loading"}
          className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:opacity-50"
        >
          {state === "loading" ? "Connecting…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
