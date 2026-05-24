/**
 * GCP Cloud Shell tutorial URL builder — Phase 412.
 *
 * Google Cloud's `shell.cloud.google.com/?cloudshell_git_repo=…` opens
 * the customer's Cloud Shell pre-cloned with a tutorial repo that
 * walks through creating a service account + binding the right
 * roles + emitting the JSON key the customer pastes back.
 *
 * Pure URL builder — no I/O.
 */

export interface GcpCloudShellInput {
  /** GitHub repo URL containing the tutorial markdown + gcloud setup script. */
  tutorialRepoUrl?: string;
  /** Tutorial file path inside the repo (relative). */
  tutorialPath?: string;
}

const DEFAULT_REPO   = "https://github.com/sahme209/visionxixlabs";
const DEFAULT_TUTORIAL = "docs/gcp-cloud-shell-tutorial.md";

/**
 * Returns:
 *   https://shell.cloud.google.com/?cloudshell_git_repo=<repo>
 *     &cloudshell_tutorial=<path>
 *     &cloudshell_workspace=.
 */
export function buildGcpCloudShellUrl(input: GcpCloudShellInput = {}): string {
  const params = new URLSearchParams({
    cloudshell_git_repo: input.tutorialRepoUrl ?? DEFAULT_REPO,
    cloudshell_tutorial: input.tutorialPath ?? DEFAULT_TUTORIAL,
    cloudshell_workspace: ".",
  });
  return `https://shell.cloud.google.com/?${params.toString()}`;
}
