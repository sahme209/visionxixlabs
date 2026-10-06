/**
 * GitHub App Manifest builder — pure.
 *
 * GitHub's App Manifest flow (https://docs.github.com/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)
 * lets an operator create a fully-configured GitHub App with one click: we
 * build this JSON manifest server-side, the browser POSTs it (as a real
 * HTML form submission) to https://github.com/settings/apps/new, and
 * GitHub redirects back with a one-time `code` our callback exchanges for
 * the App's credentials.
 *
 * Only the permission scopes the platform's GitHub client actually uses
 * today are requested (see lib/connectors/github/githubLiveClient.ts,
 * githubLiveScanner.ts, and lib/releaseops/githubFetcher.ts) — all
 * read-only, since the platform never writes to GitHub on a tenant's
 * behalf.
 *
 * No I/O. Callers resolve the trusted origin and pass it in.
 */

/** Permissions this App actually exercises — kept read-only and minimal. */
export const GITHUB_APP_MANIFEST_PERMISSIONS = {
  // Repository listing, releases, contents (githubLiveScanner, githubFetcher).
  contents: "read",
  // Pull-request evidence (githubFetcher /pulls, the pull_request webhook event).
  pull_requests: "read",
  // Workflow / workflow-run evidence (githubLiveScanner, githubFetcher /actions/runs).
  actions: "read",
  // Deployment environment evidence (githubLiveScanner /environments).
  deployments: "read",
  // Branch protection evidence (githubLiveScanner branch-protection read).
  administration: "read",
} as const;

/** Webhook events the platform actually handles (lib/releaseops/githubWebhookResponder.ts). */
export const GITHUB_APP_MANIFEST_DEFAULT_EVENTS = [
  "pull_request",
  "push",
  "release",
  "workflow_run",
] as const;

export interface GithubAppManifestInput {
  /** Trusted Axiom origin, e.g. "https://app.axiom.example". No trailing slash. */
  origin: string;
  /** Human-readable App name shown on GitHub. */
  appName?: string;
}

export interface GithubAppManifest {
  name: string;
  url: string;
  redirect_url: string;
  hook_attributes: { url: string };
  public: false;
  default_permissions: typeof GITHUB_APP_MANIFEST_PERMISSIONS;
  default_events: typeof GITHUB_APP_MANIFEST_DEFAULT_EVENTS;
}

const DEFAULT_APP_NAME = "Axiom Agent";

/**
 * Builds the manifest JSON. `origin` must already be validated as the
 * platform's trusted deployment origin (see lib/integrations/trustedCallbackUrl.ts) —
 * this function does not perform that validation itself.
 */
export function buildGithubAppManifest(input: GithubAppManifestInput): GithubAppManifest {
  const origin = input.origin.replace(/\/+$/, "");
  return {
    name: (input.appName?.trim() || DEFAULT_APP_NAME),
    url: origin,
    redirect_url: `${origin}/api/integrations/github/app-manifest-callback`,
    hook_attributes: { url: `${origin}/api/webhooks/github` },
    public: false,
    default_permissions: GITHUB_APP_MANIFEST_PERMISSIONS,
    default_events: GITHUB_APP_MANIFEST_DEFAULT_EVENTS,
  };
}
