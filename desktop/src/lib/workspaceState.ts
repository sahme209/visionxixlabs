/**
 * Workspace state hook for the desktop app.
 *
 * Hydrates the auth session at mount, exposes the active paired session
 * (if any), and provides a `connect()` helper the UI can call after the
 * user pastes a token issued from the web app's /settings/desktop page.
 *
 * Single source of truth for whether the app is in "paired" or "preview"
 * mode. Views consume `useWorkspaceState()` instead of reading
 * `desktopClient.isPreviewMode` directly.
 */

import { useCallback, useEffect, useState } from "react";
import { desktopClient } from "./desktopClient";
import {
  clearAuthSession,
  hydrateAuthSession,
  saveAuthSession,
  type PairedSession,
} from "./authSession";

export type WorkspaceStatus = "loading" | "paired" | "unpaired";

export interface WorkspaceState {
  status: WorkspaceStatus;
  session?: PairedSession;
  /** True when the latest API call fell back to mock data. */
  previewMode: boolean;
}

interface TokenAndSession {
  token: string;
  session: PairedSession;
}

export function useWorkspaceState() {
  const [state, setState] = useState<WorkspaceState>({ status: "loading", previewMode: false });

  useEffect(() => {
    let cancelled = false;
    hydrateAuthSession().then((session) => {
      if (cancelled) return;
      setState({
        status: session ? "paired" : "unpaired",
        session,
        previewMode: desktopClient.isPreviewMode,
      });
    });
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async (paste: TokenAndSession) => {
    await saveAuthSession(paste.token, paste.session);
    setState({ status: "paired", session: paste.session, previewMode: false });
  }, []);

  const disconnect = useCallback(async () => {
    await clearAuthSession();
    setState({ status: "unpaired", previewMode: false });
  }, []);

  const markPreview = useCallback((preview: boolean) => {
    setState((prev) => prev.previewMode === preview ? prev : { ...prev, previewMode: preview });
  }, []);

  return { ...state, connect, disconnect, markPreview };
}
