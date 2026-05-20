/**
 * Pure desktop platform capabilities.
 *
 * Detects the runtime OS family from a user-agent / Node-process
 * platform string and exposes a typed capability map the desktop
 * shell (Electron / Tauri / native) uses to gate UI affordances.
 *
 * Pure / deterministic. No runtime side-effects — caller decides
 * where to grab the platform string (process.platform on Node,
 * navigator.userAgent in the renderer).
 */

export type DesktopOs = "macos" | "windows" | "linux" | "unknown";

export interface PlatformCapabilities {
  os: DesktopOs;
  /** Native keychain available (macOS Keychain / Win Credential Manager / Secret Service). */
  hasNativeKeychain: boolean;
  /** Native toast / banner notification support. */
  hasOsNotifications: boolean;
  /** Tray / menu-bar / status-icon support. */
  hasTrayIcon: boolean;
  /** Code-signing required for updates (mac & win). */
  requiresSignedUpdates: boolean;
  /** Auto-launch on login supported. */
  supportsLoginItem: boolean;
  /** Preferred package extension for the auto-updater. */
  packageExt: "dmg" | "exe" | "AppImage" | "tar.gz";
  /** Native deep-link scheme registration is fully supported. */
  supportsCustomScheme: boolean;
}

const UA_MAC = /\bMac OS X|Macintosh|Darwin\b/i;
const UA_WIN = /\bWindows\b/i;
const UA_LINUX = /\bLinux\b/i;

export function detectDesktopOs(input: { userAgent?: string; nodePlatform?: string }): DesktopOs {
  const np = (input.nodePlatform ?? "").toLowerCase();
  if (np === "darwin") return "macos";
  if (np === "win32") return "windows";
  if (np === "linux") return "linux";
  const ua = input.userAgent ?? "";
  if (UA_MAC.test(ua)) return "macos";
  if (UA_WIN.test(ua)) return "windows";
  if (UA_LINUX.test(ua)) return "linux";
  return "unknown";
}

const CAPS: Record<DesktopOs, Omit<PlatformCapabilities, "os">> = {
  macos: {
    hasNativeKeychain: true, hasOsNotifications: true, hasTrayIcon: true,
    requiresSignedUpdates: true, supportsLoginItem: true,
    packageExt: "dmg", supportsCustomScheme: true,
  },
  windows: {
    hasNativeKeychain: true, hasOsNotifications: true, hasTrayIcon: true,
    requiresSignedUpdates: true, supportsLoginItem: true,
    packageExt: "exe", supportsCustomScheme: true,
  },
  linux: {
    hasNativeKeychain: true, hasOsNotifications: true, hasTrayIcon: true,
    requiresSignedUpdates: false, supportsLoginItem: true,
    packageExt: "AppImage", supportsCustomScheme: true,
  },
  unknown: {
    hasNativeKeychain: false, hasOsNotifications: false, hasTrayIcon: false,
    requiresSignedUpdates: false, supportsLoginItem: false,
    packageExt: "tar.gz", supportsCustomScheme: false,
  },
};

export function capabilitiesOf(os: DesktopOs): PlatformCapabilities {
  return { os, ...CAPS[os] };
}

export function detectAndDescribe(input: { userAgent?: string; nodePlatform?: string }): PlatformCapabilities {
  return capabilitiesOf(detectDesktopOs(input));
}
