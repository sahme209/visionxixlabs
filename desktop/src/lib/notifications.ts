/**
 * Native OS notifications via the Tauri notification plugin.
 *
 * Used by ApprovalsView to surface a desktop notification the moment
 * a new pipeline run lands in the awaiting_approval queue — so the
 * operator doesn't have to keep the app focused to know they need to
 * review.
 *
 * Honest fallback: when the runtime isn't Tauri (browser preview, web
 * embed, tests), every export becomes a no-op rather than throwing.
 * That lets the same component render unchanged across surfaces.
 */

import { invoke } from "@tauri-apps/api/core";

type TauriNotificationModule = typeof import("@tauri-apps/plugin-notification");

let cachedModule: TauriNotificationModule | null = null;
let moduleLoadFailed = false;

/**
 * Read the user's `notifications_enabled` preference from the Tauri-side
 * config store (see `src-tauri/src/config.rs`). Cached for the lifetime
 * of the page so we don't pay an IPC round-trip per row, but invalidated
 * when the SettingsView writes a new value via `markNotificationPrefDirty`.
 */
let notificationsEnabledCache: boolean | null = null;

export function markNotificationPrefDirty(): void {
  notificationsEnabledCache = null;
}

async function readNotificationsEnabled(): Promise<boolean> {
  if (notificationsEnabledCache !== null) return notificationsEnabledCache;
  if (!isTauri()) return false;
  try {
    const prefs = await invoke<{ notifications_enabled?: boolean }>("get_preferences");
    notificationsEnabledCache = prefs?.notifications_enabled !== false; // default true
    return notificationsEnabledCache;
  } catch {
    return true; // default-on if the IPC blip resolves; matches Settings default.
  }
}

/**
 * Detect Tauri at runtime. Tauri 2 exposes `__TAURI_INTERNALS__` on
 * window — checking `window` first keeps this safe for SSR / Vite SSG.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function loadModule(): Promise<TauriNotificationModule | null> {
  if (!isTauri()) return null;
  if (cachedModule) return cachedModule;
  if (moduleLoadFailed) return null;
  try {
    cachedModule = await import("@tauri-apps/plugin-notification");
    return cachedModule;
  } catch {
    moduleLoadFailed = true;
    return null;
  }
}

/**
 * Ask the OS for permission to post notifications, but only once and
 * only when we actually need it. Returns the resolved permission state.
 *
 * Returns `"denied"` outside Tauri so callers can decide whether to
 * fall back to in-app toasts.
 */
export async function ensureNotificationPermission(): Promise<"granted" | "denied" | "default"> {
  const mod = await loadModule();
  if (!mod) return "denied";
  try {
    const granted = await mod.isPermissionGranted();
    if (granted) return "granted";
    const requested = await mod.requestPermission();
    if (requested === "granted") return "granted";
    if (requested === "denied") return "denied";
    return "default";
  } catch {
    return "denied";
  }
}

export interface NotifyApprovalArgs {
  runId: string;
  pipelineId: string;
  triggeredBy: string;
  stageCount: number;
}

/**
 * Fire a native notification for a new awaiting_approval pipeline run.
 * Best-effort — failures are swallowed (the row is still visible in the
 * approvals table, so a missed notification is not a missed approval).
 */
/**
 * Push the current count of pipeline runs awaiting approval to the OS
 * menubar/tray (see `src-tauri/src/tray.rs`). On macOS the count appears
 * as text next to the icon; on Windows/Linux it lives in the tooltip.
 * No-op outside Tauri.
 */
export async function setTrayApprovalBadge(count: number): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("set_tray_badge", { count: Math.max(0, Math.floor(count)) });
  } catch {
    /* best-effort — a stale badge is fine */
  }
}

/**
 * Snake-cased on the Rust side so this is the shape Tauri's deserializer
 * actually accepts when going from the JS object to `PendingRunSummary`.
 * Matches the Rust struct fields one-for-one.
 */
export interface TrayPendingRun {
  id: string;
  pipeline_id: string;
  triggered_by: string;
}

/**
 * Replace the tray's "Pending approvals" submenu with the current top N
 * runs. The Rust side caps to 5 visible items + an "X more in Approvals
 * view" footer, so passing a longer list is safe.
 */
export async function setTrayPendingList(runs: ReadonlyArray<TrayPendingRun>): Promise<void> {
  if (!isTauri()) return;
  try {
    // Tauri's IPC takes the array under a `pending` key matching the
    // Rust command signature `(app, pending: Vec<_>)`.
    await invoke("set_tray_pending_list", { pending: runs });
  } catch {
    /* best-effort */
  }
}

/**
 * Open a URL in the OS default browser. Inside Tauri this routes through
 * `tauri-plugin-shell` so the link reliably leaves the webview (rather
 * than navigating the desktop app itself). In a non-Tauri runtime we
 * fall back to `window.open(url, "_blank")` so the same call works in
 * Vite dev / preview / web embed.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      return;
    } catch {
      /* fall through to window.open */
    }
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Generic native-notification helper for one-off operational results
 * (e.g. quick-approve outcome from the tray). Unlike `notifyNewApproval`,
 * this does NOT gate on the new-arrival diff — every call fires.
 *
 * Still respects the user's `notifications_enabled` preference so the
 * Settings toggle is the single ON/OFF source of truth for OS banners.
 */
export interface NotifyResultArgs {
  title: string;
  body: string;
}

export async function notifyResult(args: NotifyResultArgs): Promise<void> {
  const mod = await loadModule();
  if (!mod) return;
  if (!(await readNotificationsEnabled())) return;
  try {
    const granted = await mod.isPermissionGranted();
    if (!granted) return;
    mod.sendNotification({ title: args.title, body: args.body });
  } catch {
    /* best-effort */
  }
}

export async function notifyNewApproval(args: NotifyApprovalArgs): Promise<void> {
  const mod = await loadModule();
  if (!mod) return;
  // Respect the user's Settings toggle — silent no-op when disabled.
  if (!(await readNotificationsEnabled())) return;
  try {
    const granted = await mod.isPermissionGranted();
    if (!granted) return;
    mod.sendNotification({
      title: "Pipeline awaiting approval",
      body: `${args.pipelineId} · ${args.stageCount} stages · triggered by ${args.triggeredBy}`,
    });
  } catch {
    /* best-effort */
  }
}
