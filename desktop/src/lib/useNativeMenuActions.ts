/**
 * Native menu → React state bridge.
 *
 * Listens for `menu://action` events emitted by `src-tauri/src/menu.rs`
 * and routes them to a setActiveView callback. Closed-union payload —
 * unknown actions are ignored. No-op outside Tauri.
 */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { CustomerView } from "../App";

type MenuAction =
  | "open_settings"
  | "view:agent"
  | "view:deployment-requests"
  | "view:repository-workspace"
  | "view:docs";

const VIEW_ROUTES: ReadonlyArray<{ action: MenuAction; view: CustomerView }> = [
  { action: "open_settings", view: "settings" },
  { action: "view:agent", view: "agent" },
  { action: "view:deployment-requests", view: "deployment-requests" },
  { action: "view:repository-workspace", view: "repository-workspace" },
  { action: "view:docs", view: "docs" },
];

function isMenuAction(s: unknown): s is MenuAction {
  return typeof s === "string" && VIEW_ROUTES.some((r) => r.action === s);
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function customerViewForMenuAction(value: unknown): CustomerView | null {
  if (!isMenuAction(value)) return null;
  return VIEW_ROUTES.find((route) => route.action === value)?.view ?? null;
}

export function useNativeMenuActions(setActiveView: (v: CustomerView) => void): void {
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const fn = await listen<string>("menu://action", (event) => {
          const payload = event.payload;
          const view = customerViewForMenuAction(payload);
          if (view) setActiveView(view);
        });
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      } catch {
        /* event API not available — no-op */
      }
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [setActiveView]);
}
