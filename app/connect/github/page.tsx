/**
 * Browser-safe GitHub App consent entry point.
 *
 * The desktop owns release operations. GitHub installation is deliberately
 * completed in the system browser, where GitHub can show its native
 * organization and repository-scope consent screen. This page is an account
 * companion, not an operational dashboard.
 */

import GitHubAppPage from "@/app/dashboard/github-app/page";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { AuthCompanionShell } from "@/components/auth/AuthCompanionShell";
import { currentContext } from "@/lib/auth/currentContext";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Connect GitHub · Axiom",
  description: "Install the Axiom GitHub App with explicit repository scope.",
};

export default async function ConnectGitHubPage() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.email) redirect("/auth/signin?callbackUrl=/connect/github");
  return (
    <AuthCompanionShell>
      <div className="mx-auto max-w-6xl">
        <AuthCompanionHeader email={context.email} />
        <div className="py-10 sm:py-14">
          <Suspense fallback={<div className="min-h-64" aria-busy="true" />}>
            <GitHubAppPage />
          </Suspense>
        </div>
      </div>
    </AuthCompanionShell>
  );
}
