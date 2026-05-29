/**
 * /operator/onboarding — auth-gated redirect.
 *
 * This route used to be the public-facing "Connect a real provider" page
 * — anyone with the URL could try to wire up AWS/Azure/GCP before signing
 * up. That was the architectural mismatch the user kept flagging: cloud
 * connect doesn't make sense outside an authenticated portal.
 *
 * The page now redirects every visitor into the dashboard-native flow:
 *   - Signed in  → /dashboard/connect-cloud
 *   - Signed out → /auth/signin?callbackUrl=/dashboard/connect-cloud
 *
 * The provider-specific components (AwsKeyConnect, AzureDeployConnect,
 * GcpDeployConnect) live in this directory but are now imported by
 * /dashboard/connect-cloud. They stay as siblings to this stub — the
 * file paths are stable so the dashboard's import doesn't break.
 *
 * Inbound deep links of the form ?provider=aws&step=… are preserved
 * through to the dashboard surface so any saved CFN bounce-back URLs
 * (FinishUrl on existing stacks) still land somewhere coherent.
 */

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

export default async function OperatorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Build the same query string back onto the dashboard URL so CFN
  // bounce-backs (roleArn, externalId, accountId, provider, step,
  // token) keep working without callers updating their links.
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw == null) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.length > 0) next.set(key, value);
  }
  const suffix = next.toString();
  const dashboardTarget = suffix
    ? `/dashboard/connect-cloud?${suffix}`
    : "/dashboard/connect-cloud";

  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(dashboardTarget);
  }

  const signinUrl = `/auth/signin?callbackUrl=${encodeURIComponent(dashboardTarget)}`;
  redirect(signinUrl);
}
