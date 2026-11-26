import { redirect } from "next/navigation";
import Link from "next/link";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildServiceCatalog } from "@/lib/releaseops/serviceCatalog";

export const dynamic = "force-dynamic";
const OUTCOME: Record<string, { label: string; tone: string }> = {
  succeeded: { label: "succeeded", tone: "text-emerald-300" }, failed: { label: "failed", tone: "text-red-300" },
  in_progress: { label: "in progress", tone: "text-sky-300" }, other: { label: "other", tone: "text-zinc-300" },
};

export default async function ServicesPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/services");
  const organizationId = String(context.organizationId);
  const since = new Date(Date.now() - 90 * 86_400_000);
  const data = await (async () => {
    const [repos, components, executions, environments] = await Promise.all([
      prisma.repository.findMany({ where: { organizationId }, take: 200, select: { id: true, remoteOwner: true, remoteName: true, defaultBranch: true, codeownersPresent: true, protectedBranches: true } }),
      prisma.component.findMany({ where: { organizationId }, take: 1000, select: { repositoryId: true, name: true, ownerTeamLabel: true } }),
      prisma.deploymentExecution.findMany({ where: { organizationId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 2000, select: { repositoryFullName: true, environmentId: true, sourceCommitSha: true, status: true, conclusion: true, createdAt: true } }),
      prisma.environment.findMany({ where: { organizationId }, select: { id: true, name: true, displayOrder: true } }),
    ]);
    return buildServiceCatalog(repos.map((r) => ({ id: r.id, fullName: `${r.remoteOwner}/${r.remoteName}`, defaultBranch: r.defaultBranch, codeownersPresent: r.codeownersPresent, protectedBranches: r.protectedBranches })), components, executions, environments);
  })().catch(() => null);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em]">Services</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Every connected repository with its components and owners, its guardrails, and the latest recorded run in each environment over the last 90 days. Built from recorded data only; it is not the live state of your systems.</p>
      {data === null ? <p role="status" className="mt-8 text-sm text-zinc-400">The service catalog could not be read. Nothing is shown rather than an estimate.</p>
        : data.rows.length === 0 ? <p className="mt-8 text-sm text-zinc-400">No repositories are connected yet. Connect a repository in the desktop app to see it here.</p>
        : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Services with owners, guardrails and the latest recorded run per environment</caption>
              <thead className="bg-white/[0.03] text-xs text-zinc-400"><tr>
                <th scope="col" className="px-4 py-3 font-medium">Repository</th>
                <th scope="col" className="px-4 py-3 font-medium">Owners</th>
                <th scope="col" className="px-4 py-3 font-medium">Guardrails</th>
                {data.environments.map((e) => <th key={e.id} scope="col" className="px-4 py-3 font-medium">{e.name}</th>)}
                <th scope="col" className="px-4 py-3 font-medium">Recent failures</th>
              </tr></thead>
              <tbody className="divide-y divide-white/[0.07]">{data.rows.map((r) => (
                <tr key={r.repository} className="align-top">
                  <th scope="row" className="px-4 py-3 font-normal"><span className="font-mono text-xs text-zinc-100">{r.repository}</span>{r.components.length > 0 && <span className="mt-1 block text-xs text-zinc-400">{r.components.join(", ")}</span>}</th>
                  <td className="px-4 py-3 text-xs text-zinc-300">{r.owners.length ? r.owners.join(", ") : <span className="text-zinc-400">Not recorded</span>}</td>
                  <td className="px-4 py-3 text-xs"><span className={r.guardrails.codeowners ? "text-zinc-200" : "text-amber-300"}>{r.guardrails.codeowners ? "CODEOWNERS" : "No CODEOWNERS"}</span><br /><span className={r.guardrails.defaultBranchProtected ? "text-zinc-200" : "text-amber-300"}>{r.guardrails.defaultBranchProtected ? "Default branch protected" : "Default branch not protected"}</span></td>
                  {r.environments.map((cell, i) => <td key={data.environments[i].id} className="px-4 py-3 text-xs">{cell ? <><span className="font-mono text-zinc-200">{cell.commit ?? "no commit"}</span><br /><span className={OUTCOME[cell.outcome].tone}>{OUTCOME[cell.outcome].label}</span> <span className="text-zinc-400">· {new Date(cell.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></> : <span className="text-zinc-400">No recorded run</span>}</td>)}
                  <td className="px-4 py-3 text-xs text-zinc-300">{r.recentFailureRate === null ? <span className="text-zinc-400">—</span> : `${r.recentFailureRate}% of recent finished runs`}</td>
                </tr>))}
              </tbody>
            </table>
          </div>)}
      <p className="mt-6 max-w-2xl text-xs leading-5 text-zinc-400">Owners come from components recorded in V19. Guardrails come from the repository&apos;s last scan. See <Link href="/control/checks" className="underline underline-offset-4">Checks</Link> and <Link href="/control/governance" className="underline underline-offset-4">Governance</Link> for what gates each release.</p>
    </div>
  );
}
