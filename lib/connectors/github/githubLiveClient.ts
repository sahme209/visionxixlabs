/**
 * GitHub live REST client — native fetch, no @octokit dependency.
 *
 * Reads from the configured GitHub credential (PAT preferred for the
 * practical path; GitHub App support stubbed for the production path).
 * Every call is *read-only* — this module never POSTs / PATCHes / DELETEs.
 *
 * Hard rules:
 *  - Tokens are never logged. Errors redact the Authorization header.
 *  - Calls have a hard timeout (default 8 s) and bail out cleanly.
 *  - Rate-limit headers surface on every result so callers can warn.
 *  - 4xx responses get a typed classification (auth_failure /
 *    permission_denied / not_found / rate_limited / other) so UI labels
 *    are honest.
 *
 * Server-only: imports `loadAppEnv`.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { getGithubAuthPath } from "@/lib/config/providerModes";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

const DEFAULT_BASE = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 8_000;
const USER_AGENT = "axiom-agent/1.0";

export type GithubErrorKind =
  | "auth_failure"
  | "permission_denied"
  | "not_found"
  | "rate_limited"
  | "validation"
  | "network"
  | "timeout"
  | "other";

export interface GithubRateLimit {
  limit?: number;
  remaining?: number;
  resetEpoch?: number;
  used?: number;
}

export interface GithubResult<T> {
  ok: boolean;
  data?: T;
  status: number;
  errorKind?: GithubErrorKind;
  errorMessage?: string;
  rateLimit: GithubRateLimit;
}

export interface GithubClient {
  /** Auth path actually used by this client instance. */
  authPath: ReturnType<typeof getGithubAuthPath>;
  /** True when the client can make authenticated calls. */
  available: boolean;
  /** Make an authenticated GET. Pass relative or absolute paths. */
  get<T>(path: string, opts?: { timeoutMs?: number }): Promise<GithubResult<T>>;
}

// ---------------------------------------------------------------------------
// Mode + availability helpers
// ---------------------------------------------------------------------------

export type GithubMode = "live" | "preview" | "disabled";

export function getGithubMode(): GithubMode {
  const env = loadAppEnv();
  if (env.githubSyncMode === "disabled") return "disabled";
  if (env.githubSyncMode === "live" && (env.githubPatConfigured || env.githubAppConfigured)) return "live";
  return "preview";
}

// ---------------------------------------------------------------------------
// Token resolution — PAT is the canonical practical path for now.
// ---------------------------------------------------------------------------

function resolvePatToken(): string | undefined {
  const raw = process.env.GITHUB_PAT?.trim();
  if (!raw) return undefined;
  if (!/^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)/.test(raw)) {
    // Token doesn't look like a recognised GitHub token format — refuse to
    // use it rather than firing a hopeless request.
    return undefined;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function createGithubClient(): GithubClient {
  const authPath = getGithubAuthPath();
  const pat = resolvePatToken();
  // Available when EITHER the App is configured (token minted on demand)
  // OR a PAT is present. The App path is preferred when both exist.
  const available = authPath === "github_app" || Boolean(pat);

  return {
    authPath,
    available,

    async get<T>(path: string, opts: { timeoutMs?: number } = {}): Promise<GithubResult<T>> {
      // Resolve the bearer token: App installation token if configured,
      // otherwise PAT. The App path mints + caches transparently.
      let bearer: string | undefined;
      if (authPath === "github_app") {
        const { resolveGithubInstallationToken } = await import("./githubAppAuth");
        const result = await resolveGithubInstallationToken();
        if (result.ok) bearer = result.token;
        else if (!pat) {
          return failed<T>(0, "auth_failure", `GitHub App auth unavailable: ${result.errorCode}.`);
        }
      }
      if (!bearer) bearer = pat;
      if (!bearer) {
        return failed<T>(0, "auth_failure", "No GitHub credential configured. Set GITHUB_APP_ID + GITHUB_PRIVATE_KEY (+ GITHUB_INSTALLATION_ID) or GITHUB_PAT.");
      }
      const url = path.startsWith("http") ? path : `${DEFAULT_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${bearer}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": USER_AGENT,
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        const rateLimit = readRateLimit(res);

        if (res.status === 401) return failed<T>(res.status, "auth_failure", "GitHub rejected the token (401).", rateLimit);
        if (res.status === 403) {
          const text = await safeText(res);
          const kind: GithubErrorKind = /rate limit/i.test(text) ? "rate_limited" : "permission_denied";
          return failed<T>(res.status, kind, redactMessage(text), rateLimit);
        }
        if (res.status === 404) return failed<T>(res.status, "not_found", "GitHub returned 404.", rateLimit);
        if (res.status === 422) return failed<T>(res.status, "validation", redactMessage(await safeText(res)), rateLimit);
        if (!res.ok) {
          return failed<T>(res.status, "other", `GitHub returned HTTP ${res.status}.`, rateLimit);
        }
        const data = (await res.json().catch(() => undefined)) as T | undefined;
        return { ok: true, data, status: res.status, rateLimit };
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof Error && err.name === "AbortError") {
          return failed<T>(0, "timeout", `GitHub request timed out after ${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms.`);
        }
        return failed<T>(0, "network", err instanceof Error ? err.message : "Network error.");
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Validation helper — exposed for the validator surface
// ---------------------------------------------------------------------------

export interface AuthenticatedIdentity {
  kind: "user" | "app";
  login?: string;
  name?: string;
  scopes?: string[];
}

/**
 * Confirm the current credential works. Returns the identity behind the
 * credential or a classified error.
 */
export async function getAuthenticatedUserOrApp(): Promise<GithubResult<AuthenticatedIdentity>> {
  const client = createGithubClient();
  if (!client.available) {
    return failed("auth_failure" === "auth_failure" ? 0 : 0, "auth_failure", "No GitHub credential configured.");
  }
  // PAT and OAuth tokens both work against /user. App installation tokens
  // would need /app — left as a future branch.
  const res = await client.get<{ login: string; name?: string }>("/user");
  if (!res.ok) {
    return { ok: false, status: res.status, errorKind: res.errorKind, errorMessage: res.errorMessage, rateLimit: res.rateLimit };
  }
  return {
    ok: true,
    status: res.status,
    rateLimit: res.rateLimit,
    data: { kind: "user", login: res.data?.login, name: res.data?.name },
  };
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export function classifyGithubError(status: number): GithubErrorKind {
  if (status === 401) return "auth_failure";
  if (status === 403) return "permission_denied";
  if (status === 404) return "not_found";
  if (status === 422) return "validation";
  if (status === 429) return "rate_limited";
  return "other";
}

function failed<T>(
  status: number,
  errorKind: GithubErrorKind,
  errorMessage: string,
  rateLimit: GithubRateLimit = {},
): GithubResult<T> {
  return { ok: false, status, errorKind, errorMessage, rateLimit };
}

function readRateLimit(res: Response): GithubRateLimit {
  const get = (k: string): number | undefined => {
    const v = res.headers.get(k);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    limit: get("x-ratelimit-limit"),
    remaining: get("x-ratelimit-remaining"),
    resetEpoch: get("x-ratelimit-reset"),
    used: get("x-ratelimit-used"),
  };
}

async function safeText(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 1024); } catch { return ""; }
}

function redactMessage(s: string): string {
  // Strip anything that looks like a token even though we never log them
  // ourselves — defence-in-depth.
  return s
    .replace(/ghp_[A-Za-z0-9]{20,}/g, "ghp_***")
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, "github_pat_***")
    .replace(/gho_[A-Za-z0-9]{20,}/g, "gho_***");
}

/** Strict variant used by API routes that want to throw on bad config. */
export function assertGithubLiveAvailable(): void {
  const mode = getGithubMode();
  if (mode === "disabled") {
    throw AxiomErrors.policy("github.disabled", "GitHub sync is disabled on this deployment.");
  }
  if (mode === "preview") {
    throw AxiomErrors.validation(
      "github.preview_only",
      "Live GitHub access is not configured. Set GITHUB_PAT (or GITHUB_APP_ID + GITHUB_PRIVATE_KEY) and GITHUB_SYNC_MODE=live.",
    );
  }
}
