/**
 * Bridge for the tray menu's per-run quick-jump.
 *
 * The Rust tray handler emits `tray://pending-selected` with the runId
 * when the user clicks a row inside the "Pending approvals" submenu.
 * App.tsx already routes the same click's `menu://action` event to
 * switch to the Approvals view; this hook captures the runId so the
 * ApprovalsView can scroll/highlight the matching table row.
 *
 * The selection is exposed as a tiny module-level store with a React
 * subscription so any view can read it without prop-drilling through
 * App.tsx.
 */

import { useEffect, useSyncExternalStore } from "react";
import { listen } from "@tauri-apps/api/event";

type Listener = () => void;
const listeners = new Set<Listener>();
let selectedRunId: string | null = null;
let bootstrapped = false;

function set(runId: string | null) {
  if (selectedRunId === runId) return;
  selectedRunId = runId;
  for (const l of listeners) l();
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function snapshot(): string | null {
  return selectedRunId;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Boot the global tray-selection listener exactly once. Safe to call
 * from multiple components — the second call is a no-op.
 */
export function useTrayPendingSelectionBootstrap(): void {
  useEffect(() => {
    if (bootstrapped || !isTauri()) return;
    bootstrapped = true;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const fn = await listen<string>("tray://pending-selected", (event) => {
          if (typeof event.payload === "string" && event.payload.length > 0) {
            set(event.payload);
          }
        });
        if (cancelled) fn(); else unlisten = fn;
      } catch {
        /* no Tauri event API — no-op */
      }
    })();
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);
}

/** Subscribe to the latest tray-selected runId (null when none). */
export function useTrayPendingSelection(): string | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Consumer clears the selection once it's been honored (e.g. row scrolled). */
export function clearTrayPendingSelection(): void {
  set(null);
}
