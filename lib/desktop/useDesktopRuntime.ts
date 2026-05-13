"use client";

/**
 * useDesktopRuntime — React hook that exposes desktop runtime status to UI.
 *
 * Returns a stable shape that the same component can use to render either:
 *   - "Open in desktop app" affordances when the Tauri shell is detected
 *   - "Download Axiom Agent" affordances when running in the web
 *
 * Web builds get the WEB_RUNTIME_STUB. Tauri builds get the real runtime
 * exposed via window.__AXIOM_DESKTOP_RUNTIME__ (to be set by the shell).
 */

import { useEffect, useState } from "react";
import { isDesktopRuntime, WEB_RUNTIME_STUB, type DesktopRuntime, type DesktopRuntimeStatus } from "./desktopRuntime";

interface UseDesktopRuntimeResult {
  /** True when running inside the Tauri shell. */
  isDesktop: boolean;
  /** True while we're checking for the runtime (first paint). */
  loading: boolean;
  /** Runtime status object. Stub-shaped if web. */
  status: DesktopRuntimeStatus;
  /** Full runtime (stub on web). */
  runtime: DesktopRuntime;
}

declare global {
  interface Window {
    __AXIOM_DESKTOP_RUNTIME__?: DesktopRuntime;
  }
}

export function useDesktopRuntime(): UseDesktopRuntimeResult {
  // SSR-safe initial state — assume web on the server, refine on client mount.
  const [isDesktop, setIsDesktop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runtime, setRuntime] = useState<DesktopRuntime>(WEB_RUNTIME_STUB);

  useEffect(() => {
    const detected = isDesktopRuntime();
    setIsDesktop(detected);
    if (detected && typeof window !== "undefined" && window.__AXIOM_DESKTOP_RUNTIME__) {
      setRuntime(window.__AXIOM_DESKTOP_RUNTIME__);
    }
    setLoading(false);
  }, []);

  return {
    isDesktop,
    loading,
    status: runtime.status,
    runtime,
  };
}
