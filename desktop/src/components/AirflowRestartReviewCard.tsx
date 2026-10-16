import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { desktopClient } from "../lib/desktopClient";
import type { AirflowRestartReviewDto } from "../../../lib/integrations/airflow/restartReviewDto";

const button = "rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40";
const recovery: Record<string, string> = {
  airflow_review_required: "This historical action has no immutable destination review. Reject it and wait for a new scheduler proposal; it cannot be backfilled.",
  airflow_review_storage_unavailable: "Destination review storage is unavailable. Ask a workspace administrator to review the installation proposal. Approval remains unavailable.",
  airflow_review_changed: "The displayed review changed. Read it again before approving.",
  airflow_restart_review_stale: "The proposal's destination or policy changed. Reject it and wait for a new scheduler proposal.",
};
function matchesExecution(value: AirflowRestartReviewDto, id: string): boolean {
  return value?.executionId === id && /^[a-f0-9]{64}$/.test(value.digest) && value.requestedOperation === "service_restart"
    && value.dependencyPolicy === "latest_run_freshness" && value.target?.kind === "ecs_restart_target" && value.target.provider === "aws"
    && [value.source?.dagId, value.source?.runId, value.source?.state, value.target.organizationId, value.target.environmentId, value.target.environmentTier,
      value.target.targetId, value.target.targetUpdatedAt, value.target.roleArn, value.target.region, value.target.ecsCluster, value.target.ecsService].every(item => typeof item === "string" && item.length > 0);
}
export function AirflowRestartReviewCard({ executionId, busy, onRun }: {
  executionId: string; busy: boolean;
  onRun: (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => Promise<void>;
}) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision);
  const generation = useRef(0);
  const [state, setState] = useState<{ id: string; revision: number; review?: AirflowRestartReviewDto; error?: string; loading?: boolean } | null>(null);
  useEffect(() => () => { generation.current++; }, [executionId, revision]);
  const current = state?.id === executionId && state.revision === revision ? state : null;
  const review = current?.review;

  async function read() {
    const request = ++generation.current;
    setState({ id: executionId, revision, loading: true });
    try {
      const result = await desktopClient.getAirflowExecutionReview(executionId);
      if (request !== generation.current || revision !== desktopClient.getContextRevision()) return;
      setState({ id: executionId, revision, ...(result.ok && matchesExecution(result.data, executionId)
        ? { review: result.data } : { error: result.ok ? "The review did not match the selected execution." : recovery[result.error] ?? "The destination review could not be confirmed. Read it again before approving." }) });
    } catch {
      if (request === generation.current && revision === desktopClient.getContextRevision()) setState({ id: executionId, revision, error: "The destination review could not be reached. Approval remains unavailable." });
    }
  }
  function approve() {
    if (!review || busy || revision !== desktopClient.getContextRevision()) return;
    generation.current++;
    setState(null);
    void onRun(() => revision === desktopClient.getContextRevision()
      ? desktopClient.approveAirflowExecution(executionId, review.digest)
      : Promise.resolve({ ok: false, error: "airflow_review_changed" }), "Service restart processed. Review the recorded outcome.");
  }
  return <div className="mt-4 space-y-3 text-xs text-zinc-400">
    <p>Restart the configured ECS service. This does not promote a source release, select a new image, verify cloud health, or recover an image.</p>
    <p>Dependencies use latest-run freshness, not an exact cross-DAG run correlation.</p>
    <button disabled={busy || current?.loading} className={button} onClick={() => void read()}>{current?.loading ? "Reading destination…" : "Review restart destination"}</button>
    {current?.error && <p role="alert">{current.error}</p>}
    {review && <dl className="grid gap-2 break-all rounded-lg border border-white/10 p-3 sm:grid-cols-[auto_1fr]">
      <dt>Source DAG / run / state</dt><dd>{review.source.dagId} / {review.source.runId} / {review.source.state}</dd>
      <dt>Repository / ref context</dt><dd>{review.repositoryFullName ?? "None"} / {review.sourceRef ?? "None"}</dd>
      <dt>Environment / tier</dt><dd>{review.target.environmentId} / {review.target.environmentTier}</dd>
      <dt>Target / revision</dt><dd>{review.target.targetId} / {review.target.targetUpdatedAt}</dd>
      <dt>AWS role</dt><dd>{review.target.roleArn}</dd><dt>Region</dt><dd>{review.target.region}</dd>
      <dt>ECS cluster</dt><dd>{review.target.ecsCluster}</dd><dt>ECS service</dt><dd>{review.target.ecsService}</dd>
      <dt>Review digest</dt><dd>{review.digest}</dd>
    </dl>}
    <div className="flex gap-2"><button disabled={busy} className={button} onClick={() => { if (revision === desktopClient.getContextRevision()) void onRun(() => desktopClient.rejectAirflowExecution(executionId), "Action rejected and recorded."); }}>Reject</button>
      <button disabled={busy || !review} className={`${button} bg-white text-black`} onClick={approve}>Approve service restart</button></div>
  </div>;
}
