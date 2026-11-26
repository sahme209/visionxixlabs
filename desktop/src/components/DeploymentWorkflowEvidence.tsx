import type { DeploymentExecution } from "../lib/desktopClient";
import { StatusIconChip, runResultTone, type StatusShape, type StatusTone } from "./StatusBadge";

type TimedExecution = Pick<DeploymentExecution, "status" | "conclusion" | "rollbackStatus" | "evidence"> & Partial<Pick<DeploymentExecution, "workflowRunId" | "lastObservedAt" | "createdAt" | "completedAt">>;

function validTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Elapsed time between two recorded timestamps; never a live clock. */
export function formatRunElapsed(from: Date, to: Date): string | null {
  const seconds = Math.round((to.getTime() - from.getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 ? `${minutes}m ${seconds % 60}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** Recorded run timing: dispatch, last observation and completion, each only when saved. */
export function DeploymentRunTiming({ execution }: { execution: TimedExecution }) {
  const dispatched = validTime(execution.createdAt);
  if (!dispatched) return null;
  const observed = validTime(execution.lastObservedAt);
  const completed = validTime(execution.completedAt);
  const result = runResultTone(execution.status, execution.conclusion);
  const steps: Array<{ label: string; at: Date | null; tone: StatusTone; shape: StatusShape; pending: string }> = [
    { label: "Dispatched", at: dispatched, tone: "blue", shape: "dot", pending: "" },
    { label: "Last observed", at: observed, tone: observed ? "blue" : "neutral", shape: "dot", pending: "Not yet observed" },
    { label: "Completed", at: completed, tone: completed ? result.tone : "neutral", shape: completed ? result.shape : "dot", pending: "Not completed" },
  ];
  const end = completed ?? observed;
  const total = end ? end.getTime() - dispatched.getTime() : 0;
  const firstShare = observed && total > 0 ? Math.min(1, Math.max(0, (observed.getTime() - dispatched.getTime()) / total)) : completed ? 0 : 1;
  const running = !completed && result.tone === "blue";
  return (
    <div className="deployment-run-timing-wrap">
    {total > 0 && <div className="deployment-run-gantt" aria-hidden="true" data-running={running ? "true" : undefined}>
      <span className="deployment-run-gantt-segment" data-tone="blue" style={{flexGrow: firstShare}}/>
      {completed && firstShare < 1 && <span className="deployment-run-gantt-segment" data-tone={result.tone} style={{flexGrow: 1 - firstShare}}/>}
    </div>}
    <ol className="deployment-run-timing" aria-label="Recorded run timing">
      {steps.map((step) => {
        const elapsed = step.at && step.at !== dispatched ? formatRunElapsed(dispatched, step.at) : null;
        return (
          <li key={step.label} data-tone={step.tone} data-recorded={step.at ? "true" : "false"}>
            <StatusIconChip tone={step.tone} shape={step.shape} size={11} />
            <span className="deployment-run-timing-label">{step.label}</span>
            <span className="deployment-run-timing-value">{step.at ? step.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : step.pending}{elapsed ? ` · +${elapsed}` : ""}</span>
          </li>
        );
      })}
    </ol>
    </div>
  );
}

/** Workflow observations are never artifact, application-health or recovery proof. */
export function DeploymentWorkflowEvidence({ execution }: { execution: TimedExecution }) {
  const observed = validTime(execution.lastObservedAt);
  const observation = observed ? observed.toLocaleString() : "Not yet recorded";
  return (
    <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
      <DeploymentRunTiming execution={execution} />
      <p>{execution.evidence?.requestedOperation === "service_restart" ? "Requested operation: ECS service restart" : "Requested operation: unverified"} · installed workflow behavior unverified</p>
      <p>Workflow run: {execution.workflowRunId || "Not yet identified"}</p>
      <p>Last observed: {observation} · saved observation, not a live check</p>
      <p className="flex items-center gap-1.5">{(() => { const t = runResultTone(execution.status, execution.conclusion); return <StatusIconChip tone={t.tone} shape={t.shape} size={11}/>; })()}GitHub workflow: {execution.status.replaceAll("_", " ")}{execution.conclusion ? ` · ${execution.conclusion}` : ""}</p>
      <p>Rollback step evidence: {execution.rollbackStatus.replaceAll("_", " ")} · image recovery unverified</p>
      <p>Source artifact release, application health and image rollback remain unverified.</p>
    </div>
  );
}
