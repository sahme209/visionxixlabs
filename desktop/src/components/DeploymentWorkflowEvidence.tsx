import type { DeploymentExecution } from "../lib/desktopClient";

/** Workflow observations are never artifact, application-health or recovery proof. */
export function DeploymentWorkflowEvidence({ execution }: { execution: Pick<DeploymentExecution, "status" | "conclusion" | "rollbackStatus" | "evidence"> & Partial<Pick<DeploymentExecution, "workflowRunId" | "lastObservedAt">> }) {
  const observed = execution.lastObservedAt ? new Date(execution.lastObservedAt) : null;
  const observation = observed && Number.isFinite(observed.getTime()) ? observed.toLocaleString() : "Not yet recorded";
  return (
    <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
      <p>{execution.evidence?.requestedOperation === "service_restart" ? "Requested operation: ECS service restart" : "Requested operation: unverified"} · installed workflow behavior unverified</p>
      <p>Workflow run: {execution.workflowRunId || "Not yet identified"}</p>
      <p>Last observed: {observation} · saved observation, not a live check</p>
      <p>GitHub workflow: {execution.status.replaceAll("_", " ")}{execution.conclusion ? ` · ${execution.conclusion}` : ""}</p>
      <p>Rollback step evidence: {execution.rollbackStatus.replaceAll("_", " ")} · image recovery unverified</p>
      <p>Source artifact release, application health and image rollback remain unverified.</p>
    </div>
  );
}
