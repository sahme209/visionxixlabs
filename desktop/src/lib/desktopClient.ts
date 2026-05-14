/**
 * Desktop app's web client.
 *
 * Wraps the typed REST endpoints the web platform exposes:
 *   - GET  /api/command-center
 *   - POST /api/aws/validate
 *   - POST /api/aws/scan
 *   - POST /api/security-scan
 *
 * Honest by design: when the desktop runtime isn't connected to a
 * workspace, the client returns a typed `disconnected` outcome rather
 * than fabricating data. UI surfaces show preview state accordingly.
 */

const DEFAULT_API_BASE = "https://visionxixlabs.com";

export type DesktopConnectionState = "connecting" | "connected" | "disconnected" | "auth_required";

export interface DesktopClientConfig {
  apiBase: string;
  /** Bearer-style session token / API key. Optional during preview. */
  sessionToken?: string;
}

export interface CommandCenterStateLite {
  features: {
    awsScanMode: "live" | "preview" | "disabled";
    githubSyncMode: "live" | "preview" | "disabled";
    desktopMode: "live" | "preview" | "disabled";
    copilotEnabled: boolean;
    oauth: { google: boolean; github: boolean };
  };
  user: {
    isAuthenticated: boolean;
    email?: string;
    displayName?: string;
    workspaceLabel?: string;
  };
  headline: string;
}

export class DesktopClient {
  config: DesktopClientConfig;

  constructor(config?: Partial<DesktopClientConfig>) {
    this.config = {
      apiBase: config?.apiBase ?? DEFAULT_API_BASE,
      sessionToken: config?.sessionToken,
    };
  }

  setSession(token: string | undefined) {
    this.config = { ...this.config, sessionToken: token };
  }

  /** GET /api/command-center — used by the desktop dashboard view. */
  async commandCenterState(): Promise<{ ok: true; data: CommandCenterStateLite } | { ok: false; error: string }> {
    return this.get("/api/command-center");
  }

  async awsValidate(input: { roleArn: string; externalId: string; region: string; requestLive?: boolean }): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    return this.post("/api/aws/validate", input);
  }

  async awsScan(input: { roleArn: string; externalId: string; region: string; requestLive?: boolean }): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    return this.post("/api/aws/scan", input);
  }

  async securityScan(): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    return this.post("/api/security-scan", {});
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------

  private async get(path: string): Promise<{ ok: true; data: CommandCenterStateLite } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        headers: this.headers(),
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: { userMessage?: string } };
      if (json.ok && json.data) {
        return { ok: true, data: json.data as CommandCenterStateLite };
      }
      return { ok: false, error: json.error?.userMessage ?? `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async post(path: string, body: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    try {
      const res = await fetch(`${this.config.apiBase}${path}`, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: { userMessage?: string } };
      return { ok: Boolean(json.ok), data: json.data, error: json.error?.userMessage ?? (json.ok ? undefined : `HTTP ${res.status}`) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.config.sessionToken) h["Authorization"] = `Bearer ${this.config.sessionToken}`;
    return h;
  }
}

/** Module-level singleton (most desktop code wants one client). */
export const desktopClient = new DesktopClient();
