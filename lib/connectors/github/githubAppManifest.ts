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
 * today are requested. `contents` and `pull_requests` are `write` —
 * user-directed scope expansion (branch creation, file commits, opening
 * real pull requests from the desktop app; see
 * lib/connectors/github/githubWriteClient.ts) on top of the read scopes
 * every other evidence path still uses (githubLiveClient.ts,
 * githubLiveScanner.ts, lib/releaseops/githubFetcher.ts).
 *
 * Important: changing this manifest only affects GitHub Apps created
 * *from now on* via the manifest flow — it does not retroactively grant
 * new permissions to an already-installed App. GitHub requires every
 * installation owner to explicitly review and approve a permission
 * upgrade; for an App that already exists, the operator must go to the
 * App's own settings on github.com (Settings → Developer settings →
 * GitHub Apps → the App → Permissions & events), add the new scopes
 * there, and then each installation owner gets a real GitHub-hosted
 * approval prompt before write calls will actually work. This is not a
 * bug to route around — it's GitHub's own consent model working as
 * intended.
 *
 * No I/O. Callers resolve the trusted origin and pass it in.
 */

/** Permissions this App actually exercises. */
export const GITHUB_APP_MANIFEST_PERMISSIONS = {
  // Repository listing, releases, contents (githubLiveScanner, githubFetcher)
  // AND file commits from the desktop app (githubWriteClient.commitFile).
  contents: "write",
  // Pull-request evidence (githubFetcher /pulls, the pull_request webhook
  // event) AND opening real PRs from the desktop app
  // (githubWriteClient.createPullRequest).
  pull_requests: "write",
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
  setup_url: string;
  setup_on_update: true;
}

const DEFAULT_APP_NAME = "Axiom Agent";

/**
 * Builds the manifest JSON. `origin` must already be validated as the
 * platform's trusted deployment origin (see lib/integrations/trustedCallbackUrl.ts) —
 * this function does not perform that validation itself.
 *
 * `redirect_url` and `setup_url` are two different GitHub concepts that
 * are easy to conflate: `redirect_url` is used exactly once, for the
 * manifest-conversion flow itself (app-manifest-callback — where GitHub
 * hands back the new App's credentials right after creation).
 * `setup_url` is what GitHub redirects every end user to after THEY
 * install or update the App on their own org/account (install-callback
 * — the one that captures `installation_id` + `state` and actually
 * records the installation against a workspace). Omitting `setup_url`
 * doesn't break App creation, but leaves GitHub with nowhere configured
 * to send installers back to — it just shows its own generic
 * installation-settings page instead, and the installation is never
 * recorded on the Axiom side. `setup_on_update: true` means the same
 * redirect also fires when someone changes repository access on an
 * existing installation, not just on first install.
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
    setup_url: `${origin}/api/integrations/github/install-callback`,
    setup_on_update: true,
  };
}
