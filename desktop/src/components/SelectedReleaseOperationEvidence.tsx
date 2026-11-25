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

export type RecordedWorkflowRun = {
  repository: string;
  id: string;
  attempt: number;
  acceptedAt: string;
  observedAt: string;
};

export type RecordedWorkflowEvidence = (
  | {state: "success"; commit: string}
  | {state: keyof typeof recordedWorkflowOutcomes}
) & {run: RecordedWorkflowRun};

export type RecordedProviderDecision = ExactApprovalHistory["events"][number] & {pullRequest: number};
export type RecordedDeploymentEvent = DeploymentExecutionHistory["events"][number] & {pullRequest: number};

type PlanSelection = Pick<OperationPlanList["plans"][number], "id" | "version" | "planDigest">;

function isSelectedPlan(plan: PlanSelection, selection: PlanSelection | undefined) {
  return selection?.id === plan.id && selection.version === plan.version && selection.planDigest === plan.planDigest;
}

/** Explains why one exact workflow attempt could not be shown, without implying an outcome. */
export function workflowGapReason({readFailed, truncated, accepted, receipt, matches}: {readFailed: boolean; truncated: boolean; accepted: boolean; receipt: boolean; matches: number}) {
  if (readFailed) return "Workflow evidence is unavailable.";
  if (truncated) return "Workflow evidence was incomplete, so one exact attempt cannot be confirmed for this plan.";
  if (!accepted) return "No acknowledged workflow dispatch is recorded for this plan, so there is no attempt to verify.";
  if (!receipt) return "The dispatch was acknowledged, but its workflow run receipt is not recorded, so the exact attempt cannot be verified.";
  if (matches === 0) return "No workflow observation is recorded for this exact release version and plan.";
  if (matches > 1) return "More than one workflow observation matches this plan, so the exact attempt cannot be determined.";
  return "A single completed workflow commit could not be verified for this release and plan.";
}

export function SelectedReleaseOperationEvidence({requestId, version, workspaceId, onWorkflowEvidence, onWorkflowGap, onProviderDecision, onDeploymentEvent, onOpenLogs}: {
  requestId: string;
  version: number;
  workspaceId: string;
  onWorkflowEvidence: (evidence: RecordedWorkflowEvidence | undefined) => void;
  /** Latest explicit read that could not show one exact attempt; cleared with the evidence. */
  onWorkflowGap?: (reason: string | undefined) => void;
  onProviderDecision?: (decision: RecordedProviderDecision | undefined) => void;
  onDeploymentEvent?: (event: RecordedDeploymentEvent | undefined) => void;
  onOpenLogs?: () => void;
}) {
  const owner = useRef({config: desktopClient.config, revision: desktopClient.getContextRevision()}).current;
  const flight = useRef<AbortController | null>(null);
  const [result, setResult] = useState<OperationPlanList | null>();
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<PlanSelection>();
  const commitFlight = useRef<AbortController | null>(null);
  const [readingCommit, setReadingCommit] = useState(false);
  const [workflowRead, setWorkflowReadState] = useState<{message: string; hasRecordedRun?: boolean}>();
  function setWorkflowRead(read: {message: string; hasRecordedRun?: boolean} | undefined) {
    setWorkflowReadState(read);
    onWorkflowGap?.(read && !read.hasRecordedRun ? read.message : undefined);
  }
  useEffect(() => () => flight.current?.abort(), []);
  useEffect(() => () => commitFlight.current?.abort(), []);
  const plans = result?.plans.filter(row => row.requestVersion === version) ?? [];
  const selected = plans.find(row => isSelectedPlan(row, selection));
  const hasReviewedPlan = selected?.version === 1 && (selected.status === "reviewed" || selected.status === "stale");

  function clearEvidence() {
    commitFlight.current?.abort();
    commitFlight.current = null;
    setReadingCommit(false);
    setWorkflowRead(undefined);
    onWorkflowEvidence(undefined);
    onProviderDecision?.(undefined);
    onDeploymentEvent?.(undefined);
  }

  async function readWorkflowCommit() {
    const owns = () => owner.config === desktopClient.config && owner.revision === desktopClient.getContextRevision();
    if (!selected || commitFlight.current || !owns()) return;
    const controller = new AbortController();
    commitFlight.current = controller;
    setReadingCommit(true);
    setWorkflowRead(undefined);
    onWorkflowEvidence(undefined);
    try {
      const [history, workflow] = await Promise.all([
        desktopClient.deploymentExecutionHistory(requestId, version, selected.id, selected.planDigest, controller.signal),
        desktopClient.releaseWorkflowEvidence(requestId, selected.id, selected.planDigest, controller.signal),
      ]);
      if (controller.signal.aborted || !owns()) return;
      const receipt = history.ok ? history.data.receipt : undefined;
      const historyEvents = history.ok ? history.data.events : [];
      const accepted = historyEvents[historyEvents.length - 1];
      const evidence = workflow.ok && !workflow.data.truncated ? workflow.data.evidence : [];
      const matching = evidence.filter(item => item.state === "observed"
        && item.binding.organizationId === workspaceId && item.binding.releaseId === requestId
        && item.binding.releaseVersion === version && item.binding.planId === selected.id
        && item.binding.planDigest === selected.planDigest && item.binding.intakeDigest === selected.plan.intakeDigest
        && item.binding.repositoryFullName === selected.plan.pullRequest.repositoryFullName);
      const attempt = matching.length === 1 ? matching[0] : undefined;
      if (receipt && accepted?.type === "accepted" && attempt?.observation) {
        const {binding, observation} = attempt;
        if (binding.repositoryFullName !== receipt.repositoryFullName || binding.workflowPath !== receipt.workflowPath
          || binding.dispatchedRef !== receipt.ref || binding.sourceCommit !== receipt.headSha
          || binding.runId !== receipt.runId || binding.runAttempt !== receipt.runAttempt
          || binding.connectionId !== selected.plan.connectionId || binding.connectionRevision !== selected.plan.connectionRevision
          || !(Date.parse(observation.observedAt) >= Date.parse(accepted.at))) {
          setWorkflowRead({message: "The recorded workflow evidence does not match the accepted dispatch."});
          return;
        }
        const run = {
          repository: binding.repositoryFullName,
          id: binding.runId,
          attempt: binding.runAttempt,
          acceptedAt: accepted.at,
          observedAt: observation.observedAt,
        };
        if (observation.status === "completed" && observation.conclusion === "success") {
          onWorkflowEvidence({state: "success", commit: binding.sourceCommit, run});
          setWorkflowRead({message: "Recorded workflow commit shown in Overview.", hasRecordedRun: true});
          return;
        }
        const state = observation.conclusion ?? observation.status;
        if (state !== "success" && state !== "completed") {
          onWorkflowEvidence({state, run});
          setWorkflowRead({
            message: `The workflow was last recorded as ${recordedWorkflowOutcomes[state]}. A successful workflow commit is unavailable.`,
            hasRecordedRun: true,
          });
          return;
        }
      }
      setWorkflowRead({message: workflowGapReason({
        readFailed: !history.ok || !workflow.ok,
        truncated: workflow.ok && workflow.data.truncated,
        accepted: accepted?.type === "accepted",
        receipt: Boolean(receipt),
        matches: matching.length,
      })});
    } catch {
      if (!controller.signal.aborted && owns()) setWorkflowRead({message: "Workflow evidence is unavailable."});
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
    clearEvidence();
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
        if (verified) {
          const currentPlans = verified.plans.filter(row => row.requestVersion === version);
          setSelection(previous => currentPlans.some(row => isSelectedPlan(row, previous)) ? previous : undefined);
        }
        setResult(verified);
        setLoading(false);
      }
    }
  }

  return <section aria-label="Recorded operation evidence" className="studio-selected-operation-evidence">
    <h4>Recorded operation evidence</h4>
    <p>Saved plan history for release version {version}.</p>
    <button className="btn-secondary" type="button" aria-disabled={loading} onClick={() => void loadPlans()}>
      {loading ? "Checking evidence plans…" : result === null ? "Retry evidence plans" : result ? "Refresh evidence plans" : "Load evidence plans"}
    </button>
    {loading && <p role="status">Loading evidence plans…</p>}
    {result === null && <p role="alert">Evidence plans could not be verified for this release version.</p>}
    {result?.truncated && <p role="status">Showing the latest loaded evidence plans.</p>}
    {result && !plans.length && <p role="status">No loaded plan belongs to this release version.</p>}
    {plans.length > 0 && <label>Evidence plan
      <select value={selected?.id ?? ""} onChange={event => {
        const plan = plans.find(row => row.id === event.target.value);
        clearEvidence();
        setSelection(plan && {id: plan.id, version: plan.version, planDigest: plan.planDigest});
      }}>
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
          {workflowRead && <p role="status">{workflowRead.message}</p>}
          {onOpenLogs && workflowRead?.hasRecordedRun &&
            <button type="button" className="btn-secondary" onClick={onOpenLogs}>Open recorded workflow logs</button>}
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
