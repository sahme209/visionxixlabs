"use client";

import { useState } from "react";

export function SlackConsentButton() {
  const [state, setState] = useState<"idle" | "opening" | "unavailable">("idle");

  async function startConsent() {
    setState("opening");
    try {
      const response = await fetch("/api/account/integrations/slack/start", { method: "POST", credentials: "include" });
      const body = await response.json().catch(() => null) as { ok?: boolean; data?: { consentUrl?: string } } | null;
      if (!response.ok || !body?.ok || !body.data?.consentUrl) throw new Error("consent_unavailable");
      window.location.assign(body.data.consentUrl);
    } catch {
      setState("unavailable");
    }
  }

  return (
    <div className="mt-5">
      <button type="button" onClick={() => void startConsent()} disabled={state === "opening"} className="inline-flex min-h-10 items-center rounded-xl border border-violet-300/25 bg-violet-300/[0.08] px-4 text-sm font-medium text-violet-100 transition hover:bg-violet-300/[0.14] disabled:opacity-60">
        {state === "opening" ? "Opening Slack…" : "Connect Slack"}
      </button>
      {state === "unavailable" && <p role="status" className="mt-3 text-xs leading-5 text-zinc-500">Slack connection is not available for this workspace yet. No provider access was granted.</p>}
    </div>
  );
}
