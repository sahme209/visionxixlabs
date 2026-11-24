import Link from "next/link";
import {notFound} from "next/navigation";
import {currentContext} from "@/lib/auth/currentContext";
import {prisma} from "@/lib/db";
import {GitLabRepositorySelection} from "./GitLabRepositorySelection";

export const dynamic = "force-dynamic";

export default async function GitLabIntegrationPage() {
  if (process.env.GITLAB_WORKSPACE_SETUP_ENABLED !== "true") notFound();
  const {organizationId, sessionUserId, isAuthenticated} = await currentContext();
  if (!isAuthenticated || !organizationId || !sessionUserId) notFound();

  const result = await prisma.$transaction(async tx => {
    const membership = await tx.orgMembership.findUnique({
      where: {userId_organizationId: {userId: sessionUserId, organizationId}},
      select: {acceptedAt: true, role: true, providerScopes: true},
    });
    if (!membership?.acceptedAt || !["owner", "admin"].includes(membership.role)
      || (membership.providerScopes.length > 0 && !membership.providerScopes.includes("gitlab"))) return {kind: "denied" as const};
    const repositories = await tx.repository.findMany({
      where: {organizationId, provider: "gitlab"},
      orderBy: [{remoteOwner: "asc"}, {remoteName: "asc"}],
      select: {id: true, remoteOwner: true, remoteName: true},
    });
    return {kind: "ready" as const, repositories};
  }, {isolationLevel: "RepeatableRead", maxWait: 1_000, timeout: 2_000}).catch(() => ({kind: "unavailable" as const}));
  if (result.kind === "denied") notFound();

  return (
    <section className="w-full max-w-2xl">
      <Link href="/control/integrations" className="text-sm text-zinc-300 underline underline-offset-4">Back to Integrations</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">GitLab</h1>
      <p className="mt-2 text-sm text-zinc-400">Connect one tracked project to sync merge requests, releases and pipeline evidence.</p>
      {result.kind === "unavailable" ? (
        <p role="alert" className="mt-6 text-sm text-zinc-300">GitLab repository records are unavailable. Reload to check again.</p>
      ) : result.repositories.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-300">Register a GitLab repository in V19 Studio before connecting it here.</p>
      ) : <GitLabRepositorySelection key={organizationId} repositories={result.repositories} />}
    </section>
  );
}
