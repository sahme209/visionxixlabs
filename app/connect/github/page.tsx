/**
 * Browser-safe GitHub App consent entry point.
 *
 * The desktop owns release operations. GitHub installation is deliberately
 * completed in the system browser, where GitHub can show its native
 * organization and repository-scope consent screen. This page is an account
 * companion, not an operational dashboard.
 */

import GitHubAppPage from "@/app/dashboard/github-app/page";

export const metadata = {
  title: "Connect GitHub · Axiom",
  description: "Install the Axiom GitHub App with explicit repository scope.",
};

export default function ConnectGitHubPage() {
  return <GitHubAppPage />;
}
