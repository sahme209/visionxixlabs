export interface DeploymentObservationInput {
  status: string;
  conclusion: string | null;
  workflowRunId: string | null;
}

export function deploymentObservationState(execution: DeploymentObservationInput): { label: string; canPoll: boolean } {
  if (execution.status === "completed") return { label: execution.conclusion === "success" ? "Deployment stabilized" : "Deployment failed", canPoll: false };
  if (execution.status === "tracking_unavailable") return { label: "Live tracking unavailable", canPoll: false };
  if (execution.status === "reserved" || !execution.workflowRunId) return { label: "Dispatch outcome awaiting verification", canPoll: false };
  return { label: "Deployment in progress", canPoll: true };
}
