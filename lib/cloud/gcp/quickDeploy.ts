/**
 * GCP Cloud Shell URL builder.
 *
 * The old flow tried to clone a tutorial repo via
 * `?cloudshell_git_repo=…` — but it pointed at the Axiom application
 * monorepo, which is private. Customer Cloud Shells couldn't clone
 * it, so the entire onboarding flow stalled with "Fatal: could not
 * read Username for 'https://github.com'".
 *
 * New flow drops the tutorial dependency entirely. The customer
 * opens a plain Cloud Shell, the UI shows the single gcloud command
 * inline (same pattern Azure already uses), and they paste the JSON
 * key back. No external repo. No git auth. No broken clones.
 *
 * If a customer wants the legacy tutorial flow back, they can set
 * GCP_TUTORIAL_REPO_URL + GCP_TUTORIAL_PATH on the host to point at
 * a PUBLIC repo of their choosing.
 *
 * Pure URL builder — no I/O.
 */

export interface GcpCloudShellInput {
  /** Public GitHub repo URL containing a tutorial markdown. Optional — when unset, we open a plain shell. */
  tutorialRepoUrl?: string;
  /** Tutorial file path inside the repo (relative). */
  tutorialPath?: string;
}

/**
 * Returns the Cloud Shell URL.
 *  · With both tutorial params: pre-clones the repo and opens the tutorial pane.
 *  · Without them: opens a plain Cloud Shell terminal.
 */
export function buildGcpCloudShellUrl(input: GcpCloudShellInput = {}): string {
  const repo = input.tutorialRepoUrl?.trim();
  const path = input.tutorialPath?.trim();
  if (repo && path) {
    const params = new URLSearchParams({
      cloudshell_git_repo: repo,
      cloudshell_tutorial: path,
      cloudshell_workspace: ".",
    });
    return `https://shell.cloud.google.com/?${params.toString()}`;
  }
  return `https://shell.cloud.google.com/?show=terminal`;
}

/**
 * The single gcloud script the customer pastes into Cloud Shell.
 * Creates a read-only service account, binds the Security Reviewer
 * role on the active project, generates a key, and prints it.
 *
 * Exposed as a named export so the dashboard surface can render it
 * verbatim (and we can keep a single source of truth instead of
 * drifting between the doc and the UI).
 */
export const GCP_SETUP_COMMAND = [
  `PROJECT_ID=$(gcloud config get-value project) && \\`,
  `gcloud iam service-accounts create axiom-agent-reader \\`,
  `  --description="Axiom read-only inventory access" \\`,
  `  --display-name="Axiom Agent Reader" --project="$PROJECT_ID" && \\`,
  `gcloud projects add-iam-policy-binding "$PROJECT_ID" \\`,
  `  --member="serviceAccount:axiom-agent-reader@$PROJECT_ID.iam.gserviceaccount.com" \\`,
  `  --role="roles/iam.securityReviewer" --quiet && \\`,
  `gcloud iam service-accounts keys create /tmp/axiom-key.json \\`,
  `  --iam-account="axiom-agent-reader@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" && \\`,
  `cat /tmp/axiom-key.json`,
].join("\n");
