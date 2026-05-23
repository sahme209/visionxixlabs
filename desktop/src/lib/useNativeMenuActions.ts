/**
 * Native menu → React state bridge.
 *
 * Listens for `menu://action` events emitted by `src-tauri/src/menu.rs`
 * and routes them to a setActiveView callback. Closed-union payload —
 * unknown actions are ignored. No-op outside Tauri.
 */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { View } from "../App";

type MenuAction =
  | "open_settings"
  | "view:start-here"
  | "view:dashboard"
  | "view:approvals"
  | "view:workflows"
  | "view:audit";

const VIEW_ROUTES: ReadonlyArray<{ action: MenuAction; view: View }> = [
  { action: "open_settings",    view: "settings"   },
  { action: "view:start-here",  view: "start-here" },
  { action: "view:dashboard",   view: "dashboard"  },
  { action: "view:approvals",   view: "approvals"  },
  { action: "view:workflows",   view: "workflows"  },
  { action: "view:audit",       view: "audit"      },
];

function isMenuAction(s: unknown): s is MenuAction {
  return typeof s === "string" && VIEW_ROUTES.some((r) => r.action === s);
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useNativeMenuActions(setActiveView: (v: View) => void): void {
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const fn = await listen<string>("menu://action", (event) => {
          const payload = event.payload;
          if (!isMenuAction(payload)) return;
          const route = VIEW_ROUTES.find((r) => r.action === payload);
          if (route) setActiveView(route.view);
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
