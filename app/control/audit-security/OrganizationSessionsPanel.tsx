"use client";

import { useCallback, useEffect, useState } from "react";

type Session = {
  id: string;
  userId: string;
  deviceLabel: string;
  platform: string;
  desktopVersion: string | null;
  issuedAt: string;
  expiresAt: string;
  lastSeenAt: string;
};

export function OrganizationSessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/control/audit-security/sessions", { cache: "no-store", credentials: "include" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body?.data?.sessions)) throw new Error("load_failed");
      setSessions(body.data.sessions);
    } catch {
      setError("Active device sessions could not be verified.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function revoke(sessionId: string) {
    setRevoking(sessionId);
    setError(null);
    try {
      const response = await fetch(`/api/control/audit-security/sessions?id=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("revoke_failed");
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch {
      setError("The session was not revoked. Refresh its status and try again.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <section className="border-t border-white/[0.08] py-8" aria-labelledby="organization-sessions-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="organization-sessions-heading" className="text-base font-medium">Active desktop sessions</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Organization administrators can revoke a paired workstation immediately. Device fingerprints and bearer tokens are never displayed.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04]">Refresh</button>
      </div>
      {loading && <p className="mt-5 text-sm text-zinc-500">Verifying sessions…</p>}
      {error && <p role="status" className="mt-5 text-sm text-rose-300">{error}</p>}
      {!loading && !error && sessions.length === 0 && <p className="mt-5 text-sm text-zinc-500">No active desktop sessions were found for this organization.</p>}
      {!loading && sessions.length > 0 && (
        <ul className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{session.deviceLabel}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{session.platform}{session.desktopVersion ? ` · Axiom ${session.desktopVersion}` : ""} · user {session.userId} · last seen {new Date(session.lastSeenAt).toLocaleString()}</p>
              </div>
              <button type="button" disabled={revoking === session.id} onClick={() => void revoke(session.id)} className="min-h-9 shrink-0 self-start rounded-lg border border-rose-300/20 px-3 text-xs font-medium text-rose-200 hover:bg-rose-300/[0.08] disabled:opacity-60 sm:self-auto">
                {revoking === session.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
