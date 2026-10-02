"use client";

import { useEffect, useState } from "react";

type DesktopSession = {
  id: string;
  deviceLabel: string;
  platform: string;
  desktopVersion?: string;
  issuedAt: string;
  expiresAt: string;
  lastSeenAt: string;
  status: "active" | "revoked" | "expired";
};

type LoadState = "loading" | "ready" | "unavailable";

function readableDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

/** Browser companion view of paired desktop sessions. It deliberately never
 * renders the bearer token, device fingerprint, or any provider credential. */
export function DesktopSessionsPanel() {
  const [sessions, setSessions] = useState<DesktopSession[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/desktop/session", { cache: "no-store", credentials: "include" })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok || !Array.isArray(body?.data?.sessions)) {
          setState("unavailable");
          return;
        }
        setSessions(body.data.sessions);
        setState("ready");
      })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, []);

  async function revoke(sessionId: string) {
    setRevoking(sessionId);
    setError(null);
    try {
      const response = await fetch(`/api/desktop/session?id=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("revoke_failed");
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch {
      setError("Could not revoke that device. Try again from a signed-in browser session.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7" aria-labelledby="paired-devices-title">
      <p className="text-[10px] uppercase tracking-[0.18em] text-violet-300">Session security</p>
      <h2 id="paired-devices-title" className="mt-3 text-lg font-medium text-zinc-100">Paired Axiom Agent devices</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Review active desktop pairings for this workspace. Revoking a device immediately prevents its paired session from reaching Axiom&apos;s protected APIs.</p>

      {state === "loading" && <p className="mt-5 text-sm text-zinc-500">Loading paired devices…</p>}
      {state === "unavailable" && <p className="mt-5 text-sm leading-6 text-zinc-500">Paired-device status is temporarily unavailable. No device details are shown until the server can verify them.</p>}
      {state === "ready" && sessions.length === 0 && <p className="mt-5 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3 text-sm leading-6 text-zinc-500">No active Axiom Agent devices are paired to this workspace.</p>}
      {state === "ready" && sessions.length > 0 && <ul className="mt-5 overflow-hidden rounded-xl border border-white/[0.07]">
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-col gap-4 border-b border-white/[0.06] px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">{session.deviceLabel}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{session.platform}{session.desktopVersion ? ` · Axiom ${session.desktopVersion}` : ""} · last seen {readableDate(session.lastSeenAt)}</p>
            </div>
            <button type="button" onClick={() => void revoke(session.id)} disabled={revoking === session.id} className="min-h-9 self-start rounded-lg border border-rose-300/20 px-3 text-xs font-medium text-rose-200 transition hover:bg-rose-300/[0.08] disabled:opacity-60 sm:self-auto">
              {revoking === session.id ? "Revoking…" : "Revoke device"}
            </button>
          </li>
        ))}
      </ul>}
      {error && <p role="status" className="mt-4 text-sm leading-6 text-rose-300">{error}</p>}
    </section>
  );
}
