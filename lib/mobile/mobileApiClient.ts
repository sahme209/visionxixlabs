/**
 * Typed mobile API client for the Axiom platform.
 *
 * Shared between web (browser fetch) and a future mobile app
 * (React Native, Capacitor, or a native iOS Swift port that imports
 * the same TypeScript surface via JavaScriptCore / Hermes). The
 * shape is intentionally narrow: every web dashboard has an
 * equivalent typed call here so a mobile surface can reach feature
 * parity without re-writing route handlers.
 *
 * Pure aside from `fetch`. Never throws — wraps errors in a typed
 * ApiClientError so callers can pattern-match.
 */

export type ApiErrorKind =
  | "unauthenticated"
  | "rate_limited"
  | "not_found"
  | "validation"
  | "network"
  | "timeout"
  | "bad_response";

export class ApiClientError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly correlationId?: string;
  constructor(input: { kind: ApiErrorKind; message: string; status?: number; correlationId?: string }) {
    super(input.message);
    this.name = "ApiClientError";
    this.kind = input.kind;
    this.status = input.status ?? 0;
    this.correlationId = input.correlationId;
  }
}

export interface ApiClientConfig {
  baseUrl: string;            // e.g. https://visionxixlabs.com
  /** Bearer token. Caller refreshes; client never stores. */
  getAccessToken: () => string | null | Promise<string | null>;
  /** Default per-call timeout in ms (default 15_000). */
  timeoutMs?: number;
  /** Optional client-id header surfaced for server analytics. */
  clientId?: string;
}

export interface PublicStatusComponent {
  id: string;
  label: string;
  verdict: "operational" | "degraded" | "down" | "unknown";
  detail: string;
}

export interface PublicStatusReport {
  generatedAt: string;
  overall: PublicStatusComponent["verdict"];
  components: PublicStatusComponent[];
}

export interface ApprovalPacketSummary {
  id: string;
  candidateLabel: string;
  candidateKind: string;
  blastRadius: "single_resource" | "service" | "account" | "org";
  boundaryClass: string;
  councilSupport: number;
  councilOppose: number;
  createdAt: string;
}

export interface NextBestAction {
  title: string;
  rationale: string;
  category: "security" | "cost" | "reliability" | "compliance" | "governance";
  effort: "low" | "medium" | "high";
}

export class MobileApiClient {
  private readonly cfg: ApiClientConfig;
  constructor(cfg: ApiClientConfig) {
    this.cfg = cfg;
  }

  private async fetchJson<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
    const ctrl = new AbortController();
    const timeoutMs = this.cfg.timeoutMs ?? 15_000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const url = `${this.cfg.baseUrl.replace(/\/+$/, "")}${path}`;
    try {
      const token = await Promise.resolve(this.cfg.getAccessToken());
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "accept": "application/json",
      };
      if (token) headers.authorization = `Bearer ${token}`;
      if (this.cfg.clientId) headers["x-client-id"] = this.cfg.clientId;

      const res = await fetch(url, {
        method: init?.method ?? "GET",
        headers,
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        signal: ctrl.signal,
      });
      const correlationId = res.headers.get("x-correlation-id") ?? undefined;
      const text = await res.text();
      if (!res.ok) {
        const kind: ApiErrorKind =
          res.status === 401 || res.status === 403 ? "unauthenticated"
          : res.status === 404 ? "not_found"
          : res.status === 422 ? "validation"
          : res.status === 429 ? "rate_limited"
          : "bad_response";
        throw new ApiClientError({ kind, status: res.status, message: text.slice(0, 200), correlationId });
      }
      try {
        const parsed = JSON.parse(text) as { ok?: boolean; data?: T; error?: { userMessage?: string } };
        if (parsed && parsed.ok && parsed.data !== undefined) return parsed.data;
        // Some routes return the bare object; accept that too.
        return parsed as unknown as T;
      } catch {
        throw new ApiClientError({ kind: "bad_response", message: "non-JSON body", status: res.status, correlationId });
      }
    } catch (err) {
      if (err instanceof ApiClientError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiClientError({ kind: "timeout", message: `timeout after ${timeoutMs}ms` });
      }
      throw new ApiClientError({ kind: "network", message: "network error" });
    } finally {
      clearTimeout(timer);
    }
  }

  // ----- Public, unauthenticated -----
  getPublicStatus(): Promise<PublicStatusReport> {
    return this.fetchJson<PublicStatusReport>("/api/status");
  }

  // ----- Authenticated dashboards mirrored to mobile -----
  listApprovalPackets(): Promise<{ packets: ApprovalPacketSummary[] }> {
    return this.fetchJson("/api/approvals/packets");
  }

  decideApproval(input: { packetId: string; decision: "approved" | "rejected"; reason?: string }): Promise<{ ok: boolean }> {
    return this.fetchJson("/api/approvals/decide", { method: "POST", body: input });
  }

  listNextBestActions(): Promise<{ actions: NextBestAction[] }> {
    return this.fetchJson("/api/insights/next-actions");
  }

  generateAi(input: { prompt: string; system?: string; maxTokens?: number; temperature?: number }): Promise<{ text: string; provider: string; model: string; latencyMs: number }> {
    return this.fetchJson("/api/ai/generate", { method: "POST", body: input });
  }
}
