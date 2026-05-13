/**
 * Desktop runtime interface — typed contract between the Axiom web platform
 * and the future Tauri-based desktop application.
 *
 * The desktop shell implements this interface; the web platform calls into it.
 * Same operational UI runs in both environments, but the desktop runtime
 * enables local execution, OS keychain credential bridging, native notifications,
 * and optional workstation mode (no outbound network).
 *
 * No actual implementation here — just the contract. The desktop shell at
 * /desktop will implement these methods using Tauri's Rust-side commands.
 */

export type DesktopPlatform = "macos-arm" | "macos-intel" | "windows" | "linux";

export type DesktopRuntimeMode = "connected" | "workstation";

export interface DesktopRuntimeStatus {
  /** Is the desktop runtime present in the current environment? */
  available: boolean;
  platform?: DesktopPlatform;
  version?: string;
  /** Code-signing + notarization status. */
  signed?: boolean;
  notarized?: boolean;
  /** Connected vs workstation (offline) mode. */
  mode?: DesktopRuntimeMode;
  /** Last successful sync with the cloud platform. */
  lastSyncAt?: string;
}

// ---------------------------------------------------------------------------
// Credential bridge
// ---------------------------------------------------------------------------

export type KeychainScope = "axiom-session" | "aws-profile" | "azure-credentials" | "gcp-credentials";

export interface KeychainAdapter {
  /** Store an opaque secret in the OS keychain under the given scope + identifier. */
  set(scope: KeychainScope, identifier: string, value: string): Promise<void>;
  /** Retrieve a previously-stored secret. Returns null if not present. */
  get(scope: KeychainScope, identifier: string): Promise<string | null>;
  /** Remove a secret. */
  remove(scope: KeychainScope, identifier: string): Promise<void>;
  /** List identifiers stored under a scope. Never returns values. */
  list(scope: KeychainScope): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Local execution bridge
// ---------------------------------------------------------------------------

export type LocalExecutable = "terraform" | "aws" | "az" | "gcloud" | "kubectl" | "git";

export interface LocalExecutableStatus {
  executable: LocalExecutable;
  /** Whether the binary was found in PATH. */
  available: boolean;
  /** Resolved absolute path if available. */
  path?: string;
  /** Reported version string. */
  version?: string;
}

export interface LocalCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** Whether the command was killed by the user or by timeout. */
  killed: boolean;
}

export interface LocalCommandOptions {
  executable: LocalExecutable;
  args: string[];
  /** Working directory for the command. */
  cwd?: string;
  /** Environment variables to add or override (secrets must come from the keychain). */
  env?: Record<string, string>;
  /** Hard timeout in milliseconds. */
  timeoutMs?: number;
  /** Stream stdout/stderr to the audit log as the command runs. */
  streamToAuditLog?: boolean;
}

export interface LocalExecutionAdapter {
  /** Detect which executables are present. */
  detect(): Promise<LocalExecutableStatus[]>;
  /** Run a single local command. */
  run(options: LocalCommandOptions): Promise<LocalCommandResult>;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationCategory = "approval" | "drift" | "scan_complete" | "execution_outcome" | "release" | "system";

export interface DesktopNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** Deep-link to open inside the app when the notification is clicked. */
  href?: string;
  /** Severity hint for OS-level styling. */
  severity?: "info" | "warning" | "critical";
  timestamp: string;
}

export interface NotificationAdapter {
  /** Emit a native OS notification. */
  notify(notification: DesktopNotification): Promise<void>;
  /** Acknowledge dismissal from the user side. */
  acknowledge(id: string): Promise<void>;
  /** List notifications still pending dismissal. */
  pending(): Promise<DesktopNotification[]>;
}

// ---------------------------------------------------------------------------
// Audit + sync
// ---------------------------------------------------------------------------

export interface LocalAuditAdapter {
  /** Append an event to the local audit log. */
  append(event: { kind: string; payload: Record<string, unknown>; timestamp: string }): Promise<void>;
  /** Query local audit log within a time range. */
  query(opts: { sinceISO?: string; limit?: number }): Promise<Array<{ kind: string; payload: Record<string, unknown>; timestamp: string }>>;
  /** Export to local file for SIEM ingestion. */
  exportToFile(path: string, format: "json" | "csv" | "ndjson"): Promise<{ bytesWritten: number }>;
}

export interface SyncAdapter {
  /** Push pending local audit events to the cloud platform. No-op in workstation mode. */
  push(): Promise<{ pushed: number; skipped: number }>;
  /** Pull operational memory updates from the cloud platform. */
  pull(): Promise<{ pulled: number }>;
  /** Returns true while the runtime is in workstation mode (no outbound sync). */
  isWorkstationMode(): boolean;
}

// ---------------------------------------------------------------------------
// Composite runtime
// ---------------------------------------------------------------------------

/** The full desktop runtime exposed to the web layer when running inside Tauri. */
export interface DesktopRuntime {
  status: DesktopRuntimeStatus;
  keychain: KeychainAdapter;
  execution: LocalExecutionAdapter;
  notifications: NotificationAdapter;
  audit: LocalAuditAdapter;
  sync: SyncAdapter;
}

/**
 * Detect whether the current runtime is the desktop shell.
 * Web builds return false; the Tauri shell injects a global flag.
 */
export function isDesktopRuntime(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri sets __TAURI__ on window when the shell is present.
  return "__TAURI__" in window;
}

/**
 * Web-side stub used when the desktop runtime isn't available.
 * Lets the same operational UI code render in both environments without branching.
 */
export const WEB_RUNTIME_STUB: DesktopRuntime = {
  status: { available: false },
  keychain: {
    async set() { throw new Error("Keychain unavailable in web runtime"); },
    async get() { return null; },
    async remove() { /* no-op */ },
    async list() { return []; },
  },
  execution: {
    async detect() { return []; },
    async run() { throw new Error("Local execution unavailable in web runtime"); },
  },
  notifications: {
    async notify() { /* no-op — falls back to in-app toast */ },
    async acknowledge() { /* no-op */ },
    async pending() { return []; },
  },
  audit: {
    async append() { /* no-op — web writes to cloud audit fabric instead */ },
    async query() { return []; },
    async exportToFile() { throw new Error("Local file export unavailable in web runtime"); },
  },
  sync: {
    async push() { return { pushed: 0, skipped: 0 }; },
    async pull() { return { pulled: 0 }; },
    isWorkstationMode() { return false; },
  },
};
