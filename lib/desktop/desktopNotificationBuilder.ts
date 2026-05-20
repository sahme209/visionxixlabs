/**
 * Pure desktop notification builder.
 *
 * macOS uses NSUserNotification / UNNotificationContent (title +
 * subtitle + body + actions). Windows uses Toast XML with header +
 * actions. Linux uses libnotify hints. This module emits per-OS
 * shapes from a single Axiom notification seed so the desktop shell
 * doesn't fork.
 *
 * Pure / deterministic.
 */

import type { DesktopOs } from "./platformCapabilities";

export interface DesktopNotificationSeed {
  kind: "approval_packet_ready" | "incident_paged" | "deploy_rollback_recommended" | "drift_high_severity";
  title: string;        // ≤ 60 chars
  subtitle?: string;    // ≤ 80 chars
  body: string;         // ≤ 200 chars
  severity?: "low" | "medium" | "high" | "critical";
  deepLink?: string;
  /** Optional one-action affordance the OS surfaces inline. */
  primaryAction?: { label: string; deepLink: string };
}

export interface MacOsNotificationPayload {
  title: string;
  subtitle?: string;
  body: string;
  /** Soundtrack name — "default" / "ping" / "" for silent. */
  sound: string;
  /** Identifier we pass to UNNotificationContent so it groups in Notification Center. */
  threadIdentifier: string;
  userInfo: {
    kind: DesktopNotificationSeed["kind"];
    deepLink?: string;
    primaryActionLabel?: string;
    primaryActionDeepLink?: string;
  };
}

export interface WindowsToastPayload {
  /** Toast XML string ready to pass to the Notifications platform. */
  toastXml: string;
}

export interface LinuxNotificationPayload {
  summary: string;
  body: string;
  /** Per libnotify: low / normal / critical. */
  urgency: "low" | "normal" | "critical";
  hints: Record<string, string>;
  actions: Array<{ key: string; label: string }>;
}

const clip = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 3)}...` : s);

const escapeXml = (s: string): string => s
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

export function buildMacOsNotification(seed: DesktopNotificationSeed): MacOsNotificationPayload {
  return {
    title: clip(seed.title, 60),
    subtitle: seed.subtitle ? clip(seed.subtitle, 80) : undefined,
    body: clip(seed.body, 200),
    sound: seed.severity === "critical" ? "ping" : seed.severity === "low" ? "" : "default",
    threadIdentifier: seed.kind,
    userInfo: {
      kind: seed.kind,
      deepLink: seed.deepLink,
      primaryActionLabel: seed.primaryAction?.label,
      primaryActionDeepLink: seed.primaryAction?.deepLink,
    },
  };
}

export function buildWindowsToast(seed: DesktopNotificationSeed): WindowsToastPayload {
  const actions = seed.primaryAction
    ? `<actions><action content="${escapeXml(seed.primaryAction.label)}" arguments="${escapeXml(seed.primaryAction.deepLink)}" /></actions>`
    : "";
  const scenario = seed.severity === "critical" ? ' scenario="urgent"' : "";
  const launchAttr = seed.deepLink ? ` launch="${escapeXml(seed.deepLink)}"` : "";
  const subtitleText = seed.subtitle ? `<text>${escapeXml(clip(seed.subtitle, 80))}</text>` : "";
  const toastXml =
    `<toast${scenario}${launchAttr}><visual><binding template="ToastGeneric">` +
    `<text>${escapeXml(clip(seed.title, 60))}</text>` +
    subtitleText +
    `<text>${escapeXml(clip(seed.body, 200))}</text>` +
    `</binding></visual>${actions}</toast>`;
  return { toastXml };
}

export function buildLinuxNotification(seed: DesktopNotificationSeed): LinuxNotificationPayload {
  return {
    summary: clip(seed.title, 60),
    body: [seed.subtitle, seed.body].filter(Boolean).map((x) => clip(String(x), 200)).join("\n"),
    urgency: seed.severity === "critical" ? "critical" : seed.severity === "low" ? "low" : "normal",
    hints: {
      "x-axiom-kind": seed.kind,
      ...(seed.deepLink ? { "x-axiom-deeplink": seed.deepLink } : {}),
    },
    actions: seed.primaryAction
      ? [{ key: "primary", label: seed.primaryAction.label }]
      : [],
  };
}

export interface DesktopNotificationPayload {
  macos: MacOsNotificationPayload;
  windows: WindowsToastPayload;
  linux: LinuxNotificationPayload;
}

export function buildDesktopNotificationForAll(seed: DesktopNotificationSeed): DesktopNotificationPayload {
  return {
    macos: buildMacOsNotification(seed),
    windows: buildWindowsToast(seed),
    linux: buildLinuxNotification(seed),
  };
}

export function pickByOs(seed: DesktopNotificationSeed, os: DesktopOs):
  MacOsNotificationPayload | WindowsToastPayload | LinuxNotificationPayload | null {
  switch (os) {
    case "macos":   return buildMacOsNotification(seed);
    case "windows": return buildWindowsToast(seed);
    case "linux":   return buildLinuxNotification(seed);
    case "unknown": return null;
  }
}
