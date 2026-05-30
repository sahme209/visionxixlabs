"use client";

/**
 * Bulk approve/reject island for /dashboard/approvals.
 *
 * Wraps the pending rows in a context that tracks selected ids and
 * renders a top action bar with 'Approve selected' / 'Reject selected'.
 * Each PendingRowSelect is a tiny client checkbox that updates the
 * shared state via React context.
 *
 * The page stays a server component for the data fetch; only the
 * interactive control surface is client-side.
 */

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";

interface BulkContext {
  selected: Set<string>;
  toggle: (id: string) => void;
}

const Ctx = createContext<BulkContext | null>(null);

export function BulkProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return <Ctx.Provider value={{ selected, toggle }}>{children}</Ctx.Provider>;
}

function useBulk(): BulkContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("BulkProvider missing");
  return v;
}

export function BulkRowCheckbox({ itemId }: { itemId: string }) {
  const { selected, toggle } = useBulk();
  return (
    <input
      type="checkbox"
      checked={selected.has(itemId)}
      onChange={() => toggle(itemId)}
      className="mt-1 w-3.5 h-3.5 accent-zinc-300 shrink-0"
      aria-label={`Select ${itemId}`}
    />
  );
}

export function BulkActionBar() {
  const { selected } = useBulk();
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject") {
    if (selected.size === 0) return;
    setPhase("working");
    setError(null);
    try {
      const res = await fetch("/api/approvals/bulk-decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: Array.from(selected), action }),
      });
      const data: { ok?: boolean; processed?: number; error?: string } = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Bulk action failed.");
        setPhase("error");
        return;
      }
      setPhase("done");
      router.refresh();
      // Clear selection after a successful run.
      setTimeout(() => setPhase("idle"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  if (selected.size === 0) return null;
  return (
    <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-[12px] text-zinc-300">
        {selected.size} selected
      </span>
      <button
        onClick={() => void run("approve")}
        disabled={phase === "working"}
        className="px-3 py-1 rounded-full text-[11px] font-medium border border-emerald-500/30 text-emerald-200 hover:border-emerald-500/50 disabled:opacity-50 transition-colors"
      >
        {phase === "working" ? "Approving…" : "Approve selected"}
      </button>
      <button
        onClick={() => void run("reject")}
        disabled={phase === "working"}
        className="px-3 py-1 rounded-full text-[11px] font-medium border border-white/[0.10] text-zinc-300 hover:text-white hover:border-white/[0.18] disabled:opacity-50 transition-colors"
      >
        Reject selected
      </button>
      {phase === "done" && <span className="text-[11px] text-emerald-300">Done.</span>}
      {phase === "error" && error && <span className="text-[11px] text-rose-300">{error}</span>}
    </div>
  );
}
