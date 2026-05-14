/**
 * GitHub connector validator.
 *
 * Validates org/repo input format + (when live mode is configured) makes
 * a single authenticated GitHub API call to confirm the token works.
 *
 * Server-only.
 */

import "server-only";
import { requireGithubOwner, requireGithubRepo } from "@/lib/security/validation";
import { isAxiomError } from "@/lib/errors/axiomErrors";

export type GithubValidationOutcome =
  | "valid_live"
  | "valid_format_only"
  | "invalid_format"
  | "auth_failure"
  | "rate_limited"
  | "missing_config"
  | "live_disabled";

export interface GithubValidationResult {
  ok: boolean;
  outcome: GithubValidationOutcome;
  message: string;
  errorCode?: string;
  mode: "live" | "preview" | "expanding";
  observedRateLimit?: { remaining: number; reset: number };
  /** Login the token resolved to, if live. */
  validatedLogin?: string;
}

export interface GithubValidateInput {
  owner: string;
  repo?: string;
  /** Personal access token / installation token. Server-only — never logged. */
  token?: string;
  requestLive: boolean;
}

export async function validateGithubConnection(opts: GithubValidateInput): Promise<GithubValidationResult> {
  // 1. Format check
  try {
    requireGithubOwner(opts.owner);
    if (opts.repo) requireGithubRepo(opts.repo);
  } catch (err) {
    return {
      ok: false,
      outcome: "invalid_format",
      message: isAxiomError(err) ? err.userMessage : "GitHub input is malformed.",
      errorCode: isAxiomError(err) ? err.code : "validation.malformed",
      mode: "preview",
    };
  }

  // 2. Live check — needs a token
  if (opts.requestLive) {
    if (!opts.token) {
      return {
        ok: false,
        outcome: "missing_config",
        message:
          "Live GitHub validation requires a token. Configure GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET " +
          "and complete OAuth, or provide a personal access token.",
        errorCode: "github.token_missing",
        mode: "preview",
      };
    }
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      });
      const remaining = parseInt(res.headers.get("x-ratelimit-remaining") ?? "0", 10);
      const reset = parseInt(res.headers.get("x-ratelimit-reset") ?? "0", 10);
      if (res.status === 401 || res.status === 403) {
        const txt = await res.text().catch(() => "");
        if (txt.toLowerCase().includes("rate limit")) {
          return {
            ok: false,
            outcome: "rate_limited",
            message: "GitHub rate-limited the validation call. Try again shortly.",
            errorCode: "github.rate_limited",
            mode: "live",
            observedRateLimit: { remaining, reset },
          };
        }
        return {
          ok: false,
          outcome: "auth_failure",
          message: "GitHub rejected the token (401/403). Re-issue the token or reconnect the app.",
          errorCode: "github.auth_failure",
          mode: "live",
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          outcome: "auth_failure",
          message: `GitHub API returned status ${res.status}.`,
          errorCode: "github.unexpected_status",
          mode: "live",
        };
      }
      const body = (await res.json().catch(() => ({}))) as { login?: string };
      return {
        ok: true,
        outcome: "valid_live",
        message: `Validated GitHub token for ${body.login ?? "unknown login"}.`,
        validatedLogin: body.login,
        mode: "live",
        observedRateLimit: { remaining, reset },
      };
    } catch (err) {
      return {
        ok: false,
        outcome: "auth_failure",
        message: err instanceof Error ? err.message : String(err),
        errorCode: "github.fetch_failed",
        mode: "live",
      };
    }
  }

  return {
    ok: true,
    outcome: "valid_format_only",
    message: "GitHub input format validated. Live validation runs when sync is started.",
    mode: "preview",
  };
}
