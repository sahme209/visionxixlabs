import { redirect } from "next/navigation";
import Link from "next/link";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { OUTCOME_ROW_LIMIT, OUTCOME_WINDOW_DAYS, summarizeDeploymentOutcomes, type ExecutionOutcomeRow } from "@/lib/releaseops/deploymentOutcomeSummary";
import { incidentRecoveryMetrics } from "@/lib/desktop/incidentRecoveryMetrics";
import { checkEvidenceCoverage } from "@/lib/releaseops/checkEvidenceCoverage";
import { changeFailureRate } from "@/lib/releaseops/changeFailureRate";

export const dynamic = "force-dynamic";

const INCIDENT_WINDOW_DAYS = 90;
const INCIDENT_ROW_LIMIT = 2000;

interface InsightsRepo {
  deploymentExecution: {
    findMany(args: { where: { organizationId: string; createdAt: { gte: Date } }; orderBy: { createdAt: "desc" }; take: number; select: { status: true; conclusion: true; createdAt: true; completedAt: true } }): Promise<ExecutionOutcomeRow[]>;
    count(args: { where: { organizationId: string; createdAt: { gte: Date; lt: Date } } }): Promise<number>;
  };
  deploymentIncident: {
    findMany(args: { where: { organizationId: string; reportedAt: { gte: Date } }; orderBy: { reportedAt: "desc" }; take: number; select: { status: true; reportedAt: true; mitigatedAt: true; resolvedAt: true } }): Promise<Array<{ status: string; reportedAt: Date; mitigatedAt: Date | null; resolvedAt: Date | null }>>;
  };
}

function duration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values), w = 240, h = 44;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - (v / max) * (h - 6)).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-11 w-full max-w-[260px] text-sky-300" role="img" aria-label={`Workflow runs per day over ${values.length} days, peak ${max}`}>
    <polyline points={`0,${h} ${pts} ${w},${h}`} fill="currentColor" opacity="0.12" />
    <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-xl border border-white/8 bg-[#111111] p-4"><dt className="text-xs text-zinc-400">{label}</dt><dd className="mt-2 text-2xl tabular-nums text-zinc-100">{value}</dd>{note && <dd className="mt-1 text-[11px] text-zinc-400">{note}</dd>}</div>;
}

export default async function InsightsPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/insights");
  const organizationId = String(context.organizationId);
  const repo = prisma as unknown as InsightsRepo;
  const now = new Date();
  const since = new Date(now.getTime() - OUTCOME_WINDOW_DAYS * 86_400_000);
  const incidentSince = new Date(now.getTime() - INCIDENT_WINDOW_DAYS * 86_400_000);
  const [runs, previous, incidents] = await Promise.all([
    repo.deploymentExecution.findMany({ where: { organizationId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: OUTCOME_ROW_LIMIT + 1, select: { status: true, conclusion: true, createdAt: true, completedAt: true } }).catch(() => null),
    repo.deploymentExecution.count({ where: { organizationId, createdAt: { gte: new Date(since.getTime() - OUTCOME_WINDOW_DAYS * 86_400_000), lt: since } } }).catch(() => null),
    repo.deploymentIncident.findMany({ where: { organizationId, reportedAt: { gte: incidentSince } }, orderBy: { reportedAt: "desc" }, take: INCIDENT_ROW_LIMIT + 1, select: { status: true, reportedAt: true, mitigatedAt: true, resolvedAt: true } }).catch(() => null),
  ]);
  const outcome = runs ? summarizeDeploymentOutcomes(runs.slice(0, OUTCOME_ROW_LIMIT), runs.length > OUTCOME_ROW_LIMIT, now, previous) : null;
  const recovery = incidents ? incidentRecoveryMetrics(incidents.slice(0, INCIDENT_ROW_LIMIT).map((i) => ({ status: i.status, reportedAt: i.reportedAt.toISOString(), mitigatedAt: i.mitigatedAt?.toISOString() ?? null, resolvedAt: i.resolvedAt?.toISOString() ?? null }))) : null;
  // Change failure rate from recorded releases over the incident window; optional, so a read failure hides only this section.
  const changes = await (async () => {
    const releases = await prisma.release.findMany({ where: { organizationId, actualDeployEnd: { gte: incidentSince } }, take: 2000, select: { id: true, status: true, actualDeployEnd: true } });
    const ids = releases.map((r) => r.id);
    const withIncidents = ids.length ? await prisma.deploymentIncident.findMany({ where: { organizationId, releaseId: { in: ids } }, take: 5000, select: { releaseId: true } }) : [];
    return changeFailureRate(releases, new Set(withIncidents.map((i) => i.releaseId)));
  })().catch(() => null);
  // Deployment check evidence for recorded runs; optional, so a read failure hides only this section.
  const coverage = await (async () => {
    const blocking = await prisma.deploymentCheck.findMany({ where: { organizationId, enabled: true, mode: "blocking" }, take: 200, select: { key: true } });
    if (blocking.length === 0) return { none: true as const };
    const shas = await prisma.deploymentExecution.findMany({ where: { organizationId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: OUTCOME_ROW_LIMIT, select: { sourceCommitSha: true } });
    const commits = [...new Set(shas.map((r) => r.sourceCommitSha).filter((v): v is string => Boolean(v)))];
    const results = commits.length ? await prisma.deploymentCheckResult.findMany({ where: { organizationId, releaseRef: { in: commits.slice(0, 1000) } }, take: 5000, select: { checkKey: true, releaseRef: true, status: true } }) : [];
    return checkEvidenceCoverage(shas.map((r) => r.sourceCommitSha), blocking.map((b) => b.key), results);
  })().catch(() => null);
  const perWeek = outcome ? (outcome.recorded / (OUTCOME_WINDOW_DAYS / 7)).toFixed(1) : null;
  const change = outcome && typeof outcome.previousRecorded === "number" && outcome.previousRecorded > 0 ? Math.round(((outcome.recorded - outcome.previousRecorded) / outcome.previousRecorded) * 100) : null;
  return (
    <div className="w-full min-w-0">
      <h1 className="text-3xl font-semibold tracking-[-0.045em]">Delivery insights</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">How often this workspace ships and how quickly it recovers, from recorded workflow runs and incidents only. Unrecorded work, provider-side runs and live health are not counted.</p>

      <section aria-labelledby="insights-delivery" className="mt-8">
        <h2 id="insights-delivery" className="text-base font-medium">Delivery · last {OUTCOME_WINDOW_DAYS} days</h2>
        {!outcome ? <p role="status" className="mt-3 text-sm text-zinc-400">Workflow run records could not be read. Nothing is shown rather than an estimate.</p>
          : outcome.recorded === 0 ? <p role="status" className="mt-3 text-sm text-zinc-400">No workflow runs were recorded in the last {OUTCOME_WINDOW_DAYS} days. Runs appear here after a governed release dispatches its workflow.</p> : <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Workflow runs" value={outcome.recorded.toLocaleString()} note={change === null ? undefined : `${change >= 0 ? "+" : ""}${change}% vs previous ${OUTCOME_WINDOW_DAYS} days`} />
            <Metric label="Runs per week" value={perWeek ?? "—"} note="Deployment frequency proxy" />
            <Metric label="Run success rate" value={outcome.successRate === null ? "—" : `${outcome.successRate}%`} note={`${outcome.succeeded} succeeded · ${outcome.failed} failed`} />
            <Metric label="Median time to complete" value={duration(outcome.medianSeconds)} note="Dispatch to recorded completion" />
          </dl>
          {outcome.daily && <Sparkline values={outcome.daily} />}
          {outcome.truncated && <p className="mt-2 text-xs text-zinc-400">Only the latest {OUTCOME_ROW_LIMIT.toLocaleString()} runs are counted.</p>}
        </>}
      </section>

      <section aria-labelledby="insights-recovery" className="mt-10">
        <h2 id="insights-recovery" className="text-base font-medium">Recovery · incidents reported in the last {INCIDENT_WINDOW_DAYS} days</h2>
        {!recovery ? <p role="status" className="mt-3 text-sm text-zinc-400">Incident records could not be read. Nothing is shown rather than an estimate.</p> : <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Open incidents" value={recovery.open.toLocaleString()} />
          <Metric label="Median time to mitigate" value={duration(recovery.mitigate.medianSeconds)} note={`${recovery.mitigate.count} mitigated`} />
          <Metric label="Median time to resolve" value={duration(recovery.resolve.medianSeconds)} note={`${recovery.resolve.count} resolved`} />
        </dl>}
      </section>

      <section aria-labelledby="insights-change-failure" className="mt-10">
        <h2 id="insights-change-failure" className="text-base font-medium">Change failure rate · releases finished in the last {INCIDENT_WINDOW_DAYS} days</h2>
        {changes === null ? <p role="status" className="mt-3 text-sm text-zinc-400">Release records could not be read. Nothing is shown rather than an estimate.</p>
          : changes.ratePercent === null ? <p className="mt-3 text-sm text-zinc-400">No release finished in this window yet.</p>
          : <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Change failure rate" value={`${changes.ratePercent}%`} note={`${changes.failedChanges} of ${changes.finished} finished releases`} />
              <Metric label="Failed or rolled back" value={changes.byReason.failedOrRolledBack.toLocaleString()} />
              <Metric label="Deployed, then an incident" value={changes.byReason.incidentOnly.toLocaleString()} />
            </dl>}
      </section>

      <section aria-labelledby="insights-checks" className="mt-10">
        <h2 id="insights-checks" className="text-base font-medium">Deployment check evidence · last {OUTCOME_WINDOW_DAYS} days</h2>
        {coverage === null ? <p role="status" className="mt-3 text-sm text-zinc-400">Check evidence could not be read. Nothing is shown rather than an estimate.</p>
          : "none" in coverage ? <p className="mt-3 text-sm text-zinc-400">No blocking deployment checks are configured. <Link href="/control/checks" className="underline underline-offset-4">Add checks</Link> to see how many deployments had passing evidence.</p>
          : <><dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="All blocking checks passed" value={`${coverage.allPassed} of ${coverage.deployments}`} />
              <Metric label="A blocking check failed" value={coverage.anyFailed.toLocaleString()} />
              <Metric label="Evidence missing" value={coverage.missing.toLocaleString()} note="Includes deployments before a check existed and emergency bypasses" />
            </dl>
            <p className="mt-3 max-w-2xl text-xs leading-5 text-zinc-400">Counts recorded workflow runs against today&apos;s blocking checks, by commit.</p></>}
      </section>

      <p className="mt-10 max-w-2xl text-xs leading-5 text-zinc-400">These are workflow and incident records, not DORA certification: a workflow failure is not always a failed change, and lead time from commit is not measured. See <Link className="underline underline-offset-4" href="/docs/releaseops">Release operations</Link>.</p>
    </div>
  );
}
