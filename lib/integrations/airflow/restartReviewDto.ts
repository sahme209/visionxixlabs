import type { RestartTargetReview } from "../../axiom/agentRuntime/restartTargetReview";

/** Explicit paired projection: configuration identity, not credentials or cloud health. */
export interface AirflowRestartReviewDto {
  executionId: string;
  digest: string;
  requestedOperation: "service_restart";
  source: { dagId: string; runId: string; state: string };
  repositoryFullName: string | null;
  sourceRef: string | null;
  dependencyPolicy: "latest_run_freshness";
  target: RestartTargetReview;
}
