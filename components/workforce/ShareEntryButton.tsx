/**
 * ShareEntryButton — Phase 634.
 *
 * Generates a signed read-only URL for an AGI memory entry,
 * copies it to the clipboard, and shows the expiry timestamp inline
 * for 5 seconds. Used by operators to share a single engineer
 * output with someone outside their workspace.
 */

"use client";

import { useState } from "react";
import { LinkIcon, CheckIcon } from "@heroicons/react/24/outline";

interface ShareEntryButtonProps {
  targetKind: string;
  targetId: string;
  /** Default TTL in days. Operator can't override for now — link
   *  TTL is a workspace-level policy, not a per-link choice. */
  ttlDays?: number;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "copied"; url: string; expiresAt: string }
  | { kind: "error"; message: string };

export function ShareEntryButton({ targetKind, targetId, ttlDays = 14 }: ShareEntryButtonProps) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleShare() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/workforce/share-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetKind, targetId, ttlDays }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "request_failed");
        setState({ kind: "error", message: errText.slice(0, 120) });
        window.setTimeout(() => setState({ kind: "idle" }), 4_000);
        return;
      }
      const data = await res.json() as { url: string; expiresAt: string };
      // Copy to clipboard.
      try {
        await navigator.clipboard.writeText(data.url);
      } catch {
        // Clipboard API blocked — still surface the URL inline so the
        // operator can copy manually.
      }
      setState({ kind: "copied", url: data.url, expiresAt: data.expiresAt });
      window.setTimeout(() => setState({ kind: "idle" }), 8_000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      setState({ kind: "error", message: msg.slice(0, 120) });
      window.setTimeout(() => setState({ kind: "idle" }), 4_000);
    }
  }

  if (state.kind === "copied") {
    const exp = new Date(state.expiresAt);
    return (
      <div className="inline-flex flex-col items-end gap-1">
        <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border border-emerald-500/30 text-emerald-100 bg-emerald-500/10 inline-flex items-center gap-1.5">
          <CheckIcon className="h-3 w-3" />
          link copied · expires {exp.toISOString().slice(0, 10)}
        </span>
        <span className="text-[10px] font-mono text-zinc-500 max-w-[280px] truncate">{state.url}</span>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border border-rose-500/30 text-rose-200">
        share failed · {state.message}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={state.kind === "loading"}
      className="text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border border-emerald-500/30 text-emerald-200 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
      title="Generate a signed read-only URL anyone can open"
    >
      <LinkIcon className="h-3 w-3" />
      {state.kind === "loading" ? "minting…" : `share · ${ttlDays}d`}
    </button>
  );
}
