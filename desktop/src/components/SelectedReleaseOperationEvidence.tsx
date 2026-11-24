import {useEffect, useRef, useState} from "react";
import {desktopClient} from "../lib/desktopClient";
import {isOperationPlanList, type OperationPlanList} from "../lib/releaseOperationPlanContract";
import type { ExactApprovalHistory } from "../../../lib/tauri/releaseExecutionApprovalContract";
import {RecordedReleaseEvents} from "./RecordedReleaseEvents";
import type {DeploymentExecutionHistory} from "../../../lib/tauri/releaseDeploymentExecutionContract";
import {deploymentExecutionEventLabels} from "./ReleaseDeploymentExecution";
import {simulationApprovalEventLabels} from "./ReleaseExecutionApproval";
import {providerApprovalEventLabels} from "./ReleaseProviderMergeApproval";
import {providerMergeEventLabels} from "./ReleaseProviderMergeExecution";

export const recordedWorkflowOutcomes = {
  queued: "queued",
  in_progress: "in progress",
  failure: "failed",
  cancelled: "cancelled",
  skipped: "skipped",
  timed_out: "timed out",
  action_required: "requiring action",
  neutral: "neutral",
} as const;

export type RecordedWorkflowRun = {repository: string; id: string; attempt: number};

export type RecordedWorkflowEvidence = (
  | {state: "success"; commit: string}
  | {state: keyof typeof recordedWorkflowOutcomes}
) & {run?: RecordedWorkflowRun};

export type RecordedProviderDecision = ExactApprovalHistory["events"][number] & {pullRequest: number};
export type RecordedDeploymentEvent = DeploymentExecutionHistory["events"][number] & {pullRequest: number};

export function SelectedReleaseOperationEvidence({requestId, version, workspaceId, onWorkflowEvidence, onProviderDecision, onDeploymentEvent}: {
  requestId: string;
  version: number;
  workspaceId: string;
  onWorkflowEvidence: (evidence: RecordedWorkflowEvidence | undefined) => void;
  onProviderDecision?: (decision: RecordedProviderDecision | undefined) => void;
  onDeploymentEvent?: (event: RecordedDeploymentEvent | undefined) => void;
}) {
  const owner = useRef({config: desktopClient.config, revision: desktopClient.getContextRevision()}).current;
  const flight = useRef<AbortController | null>(null);
  const [result, setResult] = useState<OperationPlanList | null>();
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const commitFlight = useRef<AbortController | null>(null);
  const [readingCommit, setReadingCommit] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string>();
  useEffect(() => () => flight.current?.abort(), []);
  useEffect(() => () => commitFlight.current?.abort(), []);
  const plans = result?.plans.filter(row => row.requestVersion === version) ?? [];
  const selected = plans.find(row => row.id === selectedId);
  const hasReviewedPlan = selected?.version === 1 && (selected.status === "reviewed" || selected.status === "stale");

  function selectPlan(id: string) {
    commitFlight.current?.abort();
    commitFlight.current = null;
    setReadingCommit(false);
    setCommitMessage(undefined);
    onWorkflowEvidence(undefined);
    onProviderDecision?.(undefined);
    onDeploymentEvent?.(undefined);
    setSelectedId(id);
  }

  async function readWorkflowCommit() {
    const owns = () => owner.config === desktopClient.config && owner.revision === desktopClient.getContextRevision();
    if (!selected || commitFlight.current || !owns()) return;
    const controller = new AbortController();
    commitFlight.current = controller;
    setReadingCommit(true);
    setCommitMessage(undefined);
    onWorkflowEvidence(undefined);
    try {
      const [history, workflow] = await Promise.all([
        desktopClient.deploymentExecutionHistory(requestId, version, selected.id, selected.planDigest, controller.signal),
        desktopClient.releaseWorkflowEvidence(requestId, selected.id, selected.planDigest, controller.signal),
      ]);
      if (controller.signal.aborted || !owns()) return;
      const accepted = history.ok && history.data.events.some(event => event.type === "accepted");
      const evidence = accepted && workflow.ok && !workflow.data.truncated ? workflow.data.evidence : [];
      const matching = evidence.filter(item => item.state === "observed"
        && item.binding.organizationId === workspaceId && item.binding.releaseId === requestId
        && item.binding.releaseVersion === version && item.binding.planId === selected.id
        && item.binding.planDigest === selected.planDigest && item.binding.intakeDigest === selected.plan.intakeDigest
        && item.binding.repositoryFullName === selected.plan.pullRequest.repositoryFullName);
      const attempt = matching.length === 1 ? matching[0] : undefined;
      if (attempt?.observation) {
        const {binding, observation} = attempt;
        const run = {repository: binding.repositoryFullName, id: binding.runId, attempt: binding.runAttempt};
        if (observation.status === "completed" && observation.conclusion === "success") {
          onWorkflowEvidence({state: "success", commit: binding.sourceCommit, run});
          setCommitMessage("Recorded workflow commit shown in Overview.");
          return;
        }
        const state = observation.conclusion ?? observation.status;
        if (state !== "success" && state !== "completed") {
          onWorkflowEvidence({state, run});
          setCommitMessage(`The workflow was last recorded as ${recordedWorkflowOutcomes[state]}. A successful workflow commit is unavailable.`);
          return;
        }
      }
      setCommitMessage("A single completed workflow commit could not be verified for this release and plan.");
    } catch {
      if (!controller.signal.aborted && owns()) setCommitMessage("Workflow evidence is unavailable.");
    } finally {
      if (commitFlight.current === controller) commitFlight.current = null;
      if (!controller.signal.aborted && owns()) setReadingCommit(false);
    }
  }

  async function loadPlans() {
    const owns = () => owner.config === desktopClient.config && owner.revision === desktopClient.getContextRevision();
    if (flight.current || !owns()) return;
    const controller = new AbortController();
    flight.current = controller;
    setLoading(true);
    setResult(undefined);
    selectPlan("");
    let verified: OperationPlanList | null = null;
    try {
      const response = await desktopClient.releaseOperationPlans(requestId, version, controller.signal);
      if (response.ok && isOperationPlanList(response.data, requestId, version)
        && response.data.plans.every(row => row.plan.organizationId === workspaceId)) {
        verified = response.data;
      }
    } catch {
      // Keep failed reads distinct from an empty stored list.
    } finally {
      flight.current = null;
      if (!controller.signal.aborted && owns()) {
        setResult(verified);
        setLoading(false);
      }
    }
  }

  return <section aria-label="Recorded operation evidence" className="studio-selected-operation-evidence">
    <h4>Recorded operation evidence</h4>
    <p>Saved plan history for release version {version}.</p>
    <button className="btn-secondary" type="button" aria-disabled={loading} onClick={() => void loadPlans()}>
      {result ? "Refresh evidence plans" : "Load evidence plans"}
    </button>
    {loading && <p role="status">Loading evidence plans…</p>}
    {result === null && <p role="alert">Evidence plans could not be verified for this release version.</p>}
    {result?.truncated && <p role="status">Showing the latest loaded evidence plans.</p>}
    {result && !plans.length && <p role="status">No loaded plan belongs to this release version.</p>}
    {plans.length > 0 && <label>Evidence plan
      <select value={selectedId} onChange={event => selectPlan(event.target.value)}>
        <option value="">Choose a saved plan</option>
        {plans.map(row => <option key={row.id} value={row.id}>
          PR #{row.plan.pullRequest.number} · plan version {row.version}
        </option>)}
      </select>
    </label>}
    {selected && <div key={JSON.stringify([selected.id, selected.version, selected.planDigest])} className="studio-selected-operation-reads">
      {hasReviewedPlan && <section aria-label="Approval history" className="studio-selected-operation-group">
        <h5>Approval history</h5>
        <RecordedReleaseEvents subject="selected simulation approval" labels={simulationApprovalEventLabels}
          read={signal => desktopClient.simulationApprovalHistory(requestId, version, selected.id, selected.planDigest, signal)}/>
        <RecordedReleaseEvents subject="selected provider approval" labels={providerApprovalEventLabels}
          read={signal => desktopClient.providerApprovalHistory(requestId, version, selected.id, selected.planDigest, signal)}
          onEvents={events => {
            const latest = events?.[events.length - 1];
            onProviderDecision?.(latest && {...latest, pullRequest: selected.plan.pullRequest.number});
          }}/>
      </section>}
      <section aria-label="Execution records" className="studio-selected-operation-group">
        <h5>Execution records</h5>
        <div>
          <button type="button" className="btn-secondary" aria-disabled={readingCommit}
            onClick={() => void readWorkflowCommit()}>{readingCommit ? "Checking workflow evidence…" : "Read recorded workflow commit"}</button>
          {commitMessage && <p role="status">{commitMessage}</p>}
        </div>
        <RecordedReleaseEvents subject="selected deployment execution" labels={deploymentExecutionEventLabels}
          read={signal => desktopClient.deploymentExecutionHistory(requestId, version, selected.id, selected.planDigest, signal)}
          onEvents={events => {
            const latest = events && events[events.length - 1];
            onDeploymentEvent?.(latest && {...latest, pullRequest: selected.plan.pullRequest.number});
          }}/>
        {hasReviewedPlan && <RecordedReleaseEvents subject="selected provider merge" labels={providerMergeEventLabels}
          read={signal => desktopClient.providerMergeHistory(requestId, version, selected.id, selected.planDigest, signal)}/>}
      </section>
      <p>Application validation outcomes and rollback verification are unavailable for this plan.</p>
    </div>}
  </section>;
}
