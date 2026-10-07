"use client";

import { useEffect, useRef, useState } from "react";

type Provider = "github" | "slack" | "teams" | "linear";

const CONSENT_HOSTS: Record<Provider, readonly string[]> = {
  github: ["github.com"],
  slack: ["slack.com"],
  teams: ["login.microsoftonline.com"],
  linear: ["linear.app"],
};

function trustedConsentDestination(provider: Provider, value: string): string | null {
  try {
    const destination = new URL(value);
    if (destination.protocol !== "https:" || !CONSENT_HOSTS[provider].includes(destination.hostname)) return null;
    return destination.toString();
  } catch {
    return null;
  }
}

export function IntegrationConnectionAction({
  provider,
  label,
  connected,
  suspended = false,
  setupAvailable,
  installationRowId,
}: {
  provider: Provider;
  label: string;
  connected: boolean;
  suspended?: boolean;
  setupAvailable: boolean;
  installationRowId?: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  async function connect() {
    setWorking("connect");
    setError(null);
    try {
      const endpoint = provider === "github"
        ? "/api/dashboard/github-installation-start"
        : `/api/account/integrations/${provider}/start`;
      const response = await fetch(endpoint, { method: "POST", credentials: "include" });
      const body = await response.json().catch(() => null) as {
        ok?: boolean;
        data?: { installUrl?: string; consentUrl?: string };
      } | null;
      const destination = provider === "github" ? body?.data?.installUrl : body?.data?.consentUrl;
      const trustedDestination = destination ? trustedConsentDestination(provider, destination) : null;
      if (!response.ok || !body?.ok || !trustedDestination) throw new Error("connection_unavailable");
      window.location.assign(trustedDestination);
    } catch {
      setWorking(null);
      setError(`${label} connection is unavailable for this workspace right now.`);
    }
  }

  async function transition(action: "suspend" | "resume" | "disconnect") {
    setWorking(action);
    setError(null);
    try {
      const isGithub = provider === "github";
      const endpoint = isGithub
        ? "/api/dashboard/github-installation-transition"
        : action === "disconnect"
          ? `/api/account/integrations/${provider}/disconnect`
          : `/api/account/integrations/${provider}/pause`;
      const body = isGithub
        ? { installationRowId, action: action === "disconnect" ? "revoke" : action === "resume" ? "reactivate" : "suspend" }
        : action === "disconnect" ? undefined : { action };
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error("transition_unavailable");
      window.location.reload();
    } catch {
      setWorking(null);
      setConfirmDisconnect(false);
      setError(`${label} was not changed. Try again.`);
    }
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={!setupAvailable || working !== null}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 text-xs font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-zinc-600"
        >
          {working === "connect" ? "Connecting…" : setupAvailable ? "Connect ↗" : "Setup required"}
        </button>
        {error && <p role="status" className="max-w-56 text-right text-[10px] leading-4 text-rose-300">{error}</p>}
      </div>
    );
  }

  return (
    <div ref={menu} className="relative flex flex-col items-end gap-1.5">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        disabled={working !== null}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.025] px-3.5 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.07] disabled:opacity-50"
      >
        {working ? "Updating…" : "Manage"}
        <span aria-hidden className={`text-[9px] text-zinc-500 transition ${menuOpen ? "rotate-180" : ""}`}>▼</span>
      </button>
      {menuOpen && (
        <div role="menu" className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-white/[0.1] bg-[#191a1c] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          <button type="button" role="menuitem" onClick={() => void connect()} className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white">Reconnect</button>
          <button type="button" role="menuitem" onClick={() => void transition(suspended ? "resume" : "suspend")} className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white">{suspended ? "Resume" : "Pause"}</button>
          <div className="my-1 border-t border-white/[0.07]" />
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setConfirmDisconnect(true); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-400/[0.08]">Disconnect</button>
        </div>
      )}
      {error && <p role="status" className="max-w-56 text-right text-[10px] leading-4 text-rose-300">{error}</p>}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`${provider}-disconnect-title`}>
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#17181a] p-5 shadow-2xl">
            <h2 id={`${provider}-disconnect-title`} className="text-base font-semibold text-white">Disconnect {label}?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Axiom will stop using this connection. Existing deployment and audit records remain intact.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDisconnect(false)} className="rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-white">Cancel</button>
              <button type="button" onClick={() => void transition("disconnect")} disabled={working !== null} className="rounded-lg bg-rose-400 px-3 py-2 text-xs font-semibold text-rose-950 disabled:opacity-50">{working === "disconnect" ? "Disconnecting…" : "Disconnect"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
