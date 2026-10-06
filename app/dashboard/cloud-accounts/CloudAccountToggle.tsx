"use client";

/**
 * Pause/resume switch for a single CloudAccount row.
 *
 * Server pages stay server components for the data fetch; this is the
 * one client-side interactive control per row (same split used by
 * app/dashboard/approvals/BulkActions.tsx). Hidden entirely for
 * non-admins — the PATCH route re-enforces the admin gate server-side,
 * this is just UI affordance.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CloudAccountToggle({
  cloudAccountId,
  enabled,
  isAdmin,
}: {
  cloudAccountId: string;
  enabled: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(enabled);

  if (!isAdmin) return null;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !checked;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/cloud-accounts/${cloudAccountId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data: { ok?: boolean; data?: { enabled: boolean } } = await res.json();
      if (!res.ok || !data.ok) {
        setError("Could not update this account.");
        return;
      }
      setChecked(next);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={checked ? "Pause this cloud account" : "Resume this cloud account"}
        onClick={toggle}
        disabled={busy}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-emerald-500/80" : "bg-white/[0.12]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
      {error && <span role="alert" className="text-[10px] text-rose-300">{error}</span>}
    </span>
  );
}
