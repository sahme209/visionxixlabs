import { redirect } from "next/navigation";
import Link from "next/link";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { buildServiceCatalog } from "@/lib/releaseops/serviceCatalog";
import { formatRunMinutes, summarizeDeliveryHealth, type DeliveryHealth } from "@/lib/releaseops/deliveryHealth";
import { StatusDot } from "@/components/cockpit/StatusDot";
import { openIncidentsByRepository, rankScorecards, scoreService, type ScoreGrade, type ScoreState } from "@/lib/releaseops/serviceScorecard";
import { TONE_DOT, toneFor } from "@/lib/cockpit/statusTone";
import { ROLLOUT_STRATEGIES } from "@/lib/releaseops/kubernetesRolloutTemplates";
import { SERVERLESS_PLATFORMS } from "@/lib/releaseops/serverlessDeployTemplates";

export const dynamic = "force-dynamic";
const OUTCOME: Record<string, { label: string; tone: string }> = {
  succeeded: { label: "succeeded", tone: "text-emerald-300" }, failed: { label: "failed", tone: "text-red-300" },
  in_progress: { label: "in progress", tone: "text-sky-300" }, other: { label: "other", tone: "text-zinc-300" },
};

const GRADE: Record<ScoreGrade, { label: string; tone: "success" | "attention" | "failed" | "idle" }> = {
  strong: { label: "Strong", tone: "success" }, fair: { label: "Fair", tone: "attention" }, weak: { label: "Needs work", tone: "failed" }, unknown: { label: "Not enough data", tone: "idle" },
};
const CHECK_MARK: Record<ScoreState, { mark: string; tone: string; label: string }> = {
  pass: { mark: "✓", tone: "text-emerald-300", label: "Passes" }, fail: { mark: "✕", tone: "text-rose-300", label: "Fails" }, unknown: { mark: "–", tone: "text-zinc-500", label: "Unknown" },
};

const HEALTH: Record<DeliveryHealth, { label: string; tone: "success" | "attention" | "failed" | "idle" }> = {
  healthy: { label: "Healthy", tone: "success" }, degraded: { label: "Degraded", tone: "attention" }, failing: { label: "Failing", tone: "failed" }, idle: { label: "No recent runs", tone: "idle" },
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
    const catalog = buildServiceCatalog(repos.map((r) => ({ id: r.id, fullName: `${r.remoteOwner}/${r.remoteName}`, defaultBranch: r.defaultBranch, codeownersPresent: r.codeownersPresent, protectedBranches: r.protectedBranches })), components, executions, environments);
    const incidentsByRepo = await (async () => {
      const incidents = await prisma.deploymentIncident.findMany({ where: { organizationId, status: { in: ["open", "mitigated"] } }, take: 1000, select: { releaseId: true, status: true } });
      const releases = incidents.length ? await prisma.release.findMany({ where: { organizationId, id: { in: [...new Set(incidents.map((i) => i.releaseId))] } }, select: { id: true, evidenceRepositoryId: true } }) : [];
      return openIncidentsByRepository(incidents, releases);
    })().catch(() => null);
    const idByName = new Map(repos.map((r) => [`${r.remoteOwner}/${r.remoteName}`, r.id]));
    const now = new Date();
    const scorecards = rankScorecards(catalog.rows.map((row) => scoreService(row, incidentsByRepo === null ? null : incidentsByRepo.get(idByName.get(row.repository) ?? "") ?? 0, now)));
    return { ...catalog, scorecards };
  })().catch(() => null);
  const health = await (async () => {
    const [runs, environments] = await Promise.all([
      prisma.deploymentExecution.findMany({ where: { organizationId, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { createdAt: "desc" }, take: 2000, select: { environmentId: true, status: true, conclusion: true, createdAt: true, completedAt: true, lastObservedAt: true } }),
      prisma.environment.findMany({ where: { organizationId }, select: { id: true, name: true, displayOrder: true } }),
    ]);
    return summarizeDeliveryHealth(runs, environments, new Date());
  })().catch(() => null);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em]">Services</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Every connected repository with its components and owners, its guardrails, and the latest recorded run in each environment over the last 90 days. Built from recorded data only; it is not the live state of your systems.</p>
      <section aria-labelledby="delivery-health-heading" className="mt-8">
        <h2 id="delivery-health-heading" className="text-base font-medium">Delivery health</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">How each environment&apos;s delivery pipeline has behaved over the last 30 days: success rate, typical run time, and runs that look stuck or lost tracking.</p>
        {health === null ? <p role="status" className="mt-3 text-sm text-zinc-400">Delivery health could not be read.</p>
          : health.length === 0 ? <p className="mt-3 text-sm text-zinc-400">No environments yet.</p>
          : <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{health.map((h) => (
            <li key={h.environmentId} className={`rounded-xl border p-4 ${h.health === "failing" ? "border-rose-400/30" : h.health === "degraded" ? "border-amber-300/30" : "border-white/8"}`}>
              <div className="flex items-center justify-between gap-2"><p className="truncate text-sm text-zinc-100">{h.name}</p><StatusDot tone={HEALTH[h.health].tone} label={HEALTH[h.health].label} className="text-xs" /></div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-zinc-500">Runs</dt><dd className="tabular-nums text-zinc-200">{h.runs}</dd></div>
                <div><dt className="text-zinc-500">Succeeded</dt><dd className="tabular-nums text-zinc-200">{h.successRate === null ? "—" : `${h.successRate}%`}</dd></div>
                <div><dt className="text-zinc-500">Median</dt><dd className="tabular-nums text-zinc-200">{h.medianMinutes === null ? "—" : formatRunMinutes(h.medianMinutes)}</dd></div>
              </dl>
              {h.reasons.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-zinc-400">{h.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              {h.lastRunAt && <p className="mt-2 text-[11px] text-zinc-500">Last run {new Date(h.lastRunAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>}
            </li>))}</ul>}
      </section>
      {data !== null && data.scorecards.length > 0 && (
        <section aria-labelledby="scorecards-heading" className="mt-8">
          <h2 id="scorecards-heading" className="text-base font-medium">Scorecards</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">Six checks per service from recorded data: ownership, guardrails, delivery and open incidents. Unknown never counts as a pass. Weakest first.</p>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">{data.scorecards.map((c) => (
            <li key={c.repository} className={`rounded-xl border p-4 ${c.grade === "weak" ? "border-rose-400/30" : c.grade === "fair" ? "border-amber-300/30" : "border-white/8"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-mono text-xs text-zinc-100">{c.repository}</p>
                <span className="flex shrink-0 items-center gap-2 text-xs"><span className="tabular-nums text-zinc-300">{c.passed}/{c.known}</span><StatusDot tone={GRADE[c.grade].tone} label={GRADE[c.grade].label} /></span>
              </div>
              <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{c.checks.map((k) => (
                <li key={k.id} className="flex gap-2" title={k.detail}><span aria-hidden className={CHECK_MARK[k.state].tone}>{CHECK_MARK[k.state].mark}</span><span className="text-zinc-300"><span className="sr-only">{CHECK_MARK[k.state].label}: </span>{k.label}<span className="block text-[11px] text-zinc-500">{k.detail}</span></span></li>))}
              </ul>
              {c.nextStep && <p className="mt-3 border-t border-white/[0.06] pt-2 text-xs text-zinc-400"><span className="text-zinc-200">Next:</span> {c.nextStep}</p>}
            </li>))}
          </ul>
        </section>)}
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
                  {r.environments.map((cell, i) => <td key={data.environments[i].id} className="px-4 py-3 text-xs">{cell ? <><span className="font-mono text-zinc-200">{cell.commit ?? "no commit"}</span><br /><StatusDot tone={toneFor(cell.outcome)} label={OUTCOME[cell.outcome].label} /> <span className="text-zinc-400">· {new Date(cell.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>{cell.recent.length > 1 && <span role="img" aria-label={`Last ${cell.recent.length} runs, oldest first: ${cell.recent.map((o) => OUTCOME[o].label).join(", ")}`} className="mt-1.5 flex gap-[3px]">{cell.recent.map((o, i) => <span key={i} aria-hidden className={`h-2 w-2 rounded-[2px] ${TONE_DOT[toneFor(o)]}`} />)}</span>}</> : <span className="text-zinc-400">No recorded run</span>}</td>)}
                  <td className="px-4 py-3 text-xs text-zinc-300">{r.recentFailureRate === null ? <span className="text-zinc-400">—</span> : `${r.recentFailureRate}% of recent finished runs`}</td>
                </tr>))}
              </tbody>
            </table>
          </div>)}
      <h2 className="mt-10 text-base font-medium">Deploy templates</h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-400">Download a GitHub Actions workflow for a rollout strategy. Open one to fill it in.</p>
      <details className="group mt-4 rounded-xl border border-white/[0.07] px-4 py-3 open:pb-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"><h3 id="k8s-templates-heading" className="text-sm font-medium">Kubernetes rollout templates</h3><span aria-hidden className="text-xs text-zinc-500 group-open:rotate-90">›</span></summary>
      <section aria-labelledby="k8s-templates-heading">
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">Generate a GitHub Actions workflow for your repository. V19 dispatches it only after the environment&apos;s policy, checks, rings, change window and approvals pass. Cluster access stays in your CI through a KUBE_CONFIG secret.</p>
        <ul className="mt-3 max-w-2xl space-y-1 text-xs text-zinc-400">{ROLLOUT_STRATEGIES.map((s) => <li key={s.id}><span className="text-zinc-200">{s.label}:</span> {s.summary}</li>)}</ul>
        <form method="get" action="/api/control/templates/kubernetes" className="mt-4 flex max-w-3xl flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-400">Strategy
            <select name="strategy" defaultValue="rolling" className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200">{ROLLOUT_STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          </label>
          {[["namespace", "Namespace", "shop"], ["deployment", "Deployment", "checkout"], ["container", "Container", "web"]].map(([name, label, placeholder]) => (
            <label key={name} className="text-xs text-zinc-400">{label}
              <input name={name} required pattern="[a-z0-9]([\-a-z0-9]*[a-z0-9])?" maxLength={63} placeholder={placeholder} spellCheck={false} className="mt-1 block w-36 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-200" />
            </label>))}
          <label className="text-xs text-zinc-400">Canary pods
            <input name="canaryReplicas" type="number" min={1} max={10} defaultValue={1} className="mt-1 block w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200" />
          </label>
          <label className="text-xs text-zinc-400">Watch minutes
            <input name="observeMinutes" type="number" min={1} max={60} defaultValue={5} className="mt-1 block w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200" />
          </label>
          <button type="submit" className="inline-flex min-h-9 items-center rounded-full bg-[#f3f3f3] px-4 text-sm text-black hover:bg-white">Download workflow</button>
        </form>
      </section>
      </details>

      <details className="group mt-3 rounded-xl border border-white/[0.07] px-4 py-3 open:pb-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"><h3 id="serverless-templates-heading" className="text-sm font-medium">Serverless deploy templates</h3><span aria-hidden className="text-xs text-zinc-500 group-open:rotate-90">›</span></summary>
      <section aria-labelledby="serverless-templates-heading">
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">Generate a GitHub Actions workflow that shifts traffic gradually and keeps the previous version for rollback. Cloud access uses short-lived sign-in (OIDC) that you set up in your cloud account, named in repository variables; no cloud keys are stored anywhere.</p>
        <ul className="mt-3 max-w-2xl space-y-1 text-xs text-zinc-400">{SERVERLESS_PLATFORMS.map((p) => <li key={p.id}><span className="text-zinc-200">{p.label}:</span> {p.summary}</li>)}</ul>
        <form method="get" action="/api/control/templates/serverless" className="mt-4 flex max-w-3xl flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-400">Platform
            <select name="platform" defaultValue="aws_lambda" className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200">{SERVERLESS_PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          </label>
          {[["name", "Function or service", "checkout-api", true], ["region", "Region", "us-east-1", true], ["resourceGroup", "Azure resource group", "only for Azure", false]].map(([name, label, placeholder, required]) => (
            <label key={String(name)} className="text-xs text-zinc-400">{label}
              <input name={String(name)} required={Boolean(required)} maxLength={90} placeholder={String(placeholder)} spellCheck={false} className="mt-1 block w-40 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-200" />
            </label>))}
          <label className="text-xs text-zinc-400">First traffic %
            <input name="canaryPercent" type="number" min={1} max={50} defaultValue={10} className="mt-1 block w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200" />
          </label>
          <label className="text-xs text-zinc-400">Watch minutes
            <input name="observeMinutes" type="number" min={1} max={60} defaultValue={5} className="mt-1 block w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200" />
          </label>
          <button type="submit" className="inline-flex min-h-9 items-center rounded-full bg-[#f3f3f3] px-4 text-sm text-black hover:bg-white">Download serverless workflow</button>
        </form>
      </section>
      </details>

      <p className="mt-6 max-w-2xl text-xs leading-5 text-zinc-400">Owners come from components recorded in V19. Guardrails come from the repository&apos;s last scan. See <Link href="/control/checks" className="underline underline-offset-4">Checks</Link> and <Link href="/control/governance" className="underline underline-offset-4">Governance</Link> for what gates each release.</p>
    </div>
  );
}
