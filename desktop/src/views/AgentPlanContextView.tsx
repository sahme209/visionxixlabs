import {useEffect, useId, useLayoutEffect, useRef, useState} from "react";
import {ArrowRight, ChevronRight, RefreshCw, FileText, LockKeyhole, ShieldCheck} from "lucide-react";
import {desktopClient} from "../lib/desktopClient";
import {RecordedReleaseEvents} from "../components/RecordedReleaseEvents";
import {deploymentExecutionEventLabels} from "../components/ReleaseDeploymentExecution";
import {simulationApprovalEventLabels} from "../components/ReleaseExecutionApproval";
import {providerApprovalEventLabels} from "../components/ReleaseProviderMergeApproval";
import {hasCompleteOperationPlanHistory, isOperationPlanList, operationPlanEventLabels, type OperationPlanList, type ReleaseOperationPlanDto} from "../lib/releaseOperationPlanContract";
import type {SavedReleaseLink} from "./WelcomeView";
import { StatusBadge, type StatusShape, type StatusTone } from "../components/StatusBadge";
import "./AgentPlanContextView.css";

const labels: Record<ReleaseOperationPlanDto["status"], string> = {
  pending_review: "Pending independent review",
  reviewed: "Independent review recorded",
  rejected: "Rejected",
  stale: "Earlier or stale plan",
  cancelled: "Cancelled",
};

function verifiedPlanHistory(row: ReleaseOperationPlanDto) {
  if (!hasCompleteOperationPlanHistory(row)) return null;
  if (row.status === "reviewed" &&
    !row.history.some(event => event.type === "reviewed" && event.actorKind === "independent_reviewer")) return null;
  return row.history;
}

function planTone(row: ReleaseOperationPlanDto): {tone: StatusTone; shape: StatusShape} {
  if (!verifiedPlanHistory(row)) return {tone: "amber", shape: "attention"};
  if (row.status === "reviewed") return {tone: "green", shape: "success"};
  if (row.status === "pending_review") return {tone: "amber", shape: "waiting"};
  if (row.status === "rejected") return {tone: "red", shape: "failure"};
  return {tone: "neutral", shape: "closed"};
}

function planState(row: ReleaseOperationPlanDto) {
  return verifiedPlanHistory(row) ? labels[row.status] : "History unverified";
}

export function AgentPlanContextView({release, workspaceId, ownerConfig, revision, active = true, onReturn, onClose}: {
  release: SavedReleaseLink;
  workspaceId: string;
  ownerConfig: typeof desktopClient.config;
  revision: number;
  active?: boolean;
  onReturn: (section?: "review") => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<OperationPlanList | null>();
  const [selected, setSelected] = useState<Pick<ReleaseOperationPlanDto, "id" | "version" | "planDigest">>();
  const [refresh, setRefresh] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (active && ownerConfig === desktopClient.config && revision === desktopClient.getContextRevision()) {
      heading.current?.focus();
    }
  }, [active, ownerConfig, release.id, release.version, revision]);

  useEffect(() => {
    if (!active || ownerConfig !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    const controller = new AbortController();
    setList(undefined);
    async function load() {
      const result = await desktopClient.releaseOperationPlans(release.id, release.version, controller.signal).catch(() => null);
      if (controller.signal.aborted || ownerConfig !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
      const related = result?.ok && isOperationPlanList(result.data, release.id, release.version)
        && result.data.plans.every(plan => plan.plan.organizationId === workspaceId);
      if (related && result.ok) {
        setList(result.data);
        setSelected(previous => previous ?? result.data.plans[0]);
      } else {
        setList(null);
      }
    }
    void load();
    return () => controller.abort();
  }, [release.id, release.version, workspaceId, ownerConfig, revision, active, refresh]);

  const row = list?.plans.find(plan => plan.id === selected?.id && plan.version === selected.version && plan.planDigest === selected.planDigest);
  const pr = row?.plan.pullRequest;
  const history = row ? verifiedPlanHistory(row) : null;
  const currentEvidence = active && ownerConfig === desktopClient.config && revision === desktopClient.getContextRevision()
    && list?.enabled && row?.requestVersion === release.version && history ? row : undefined;
  const canOpenReview = currentEvidence?.status === "pending_review" || currentEvidence?.status === "reviewed";
  return <aside hidden={!active} className="studio-agent-plan" aria-label="Saved release plan context" onKeyDown={event => {
    if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 ||
      (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable], [role="dialog"], [role="alertdialog"]'))) return;
    event.preventDefault();
    onClose();
  }}>
    <div className="studio-agent-plan-main">
      <header>
        <div className="studio-agent-plan-title">
          {row && <div className="studio-agent-plan-record-meta">
            <p>Release version {row.requestVersion} · Plan version {row.version}{row.requestVersion !== release.version ? " · Earlier release version" : ""}</p>
            <span className="studio-agent-plan-state">{(() => { const t = planTone(row); return <StatusBadge tone={t.tone} shape={t.shape}>{planState(row)}</StatusBadge>; })()}</span>
          </div>}
          <h2 ref={heading} tabIndex={-1}>{pr ? `Merge pull request #${pr.number}` : "Saved release plans"}</h2>
          {!row && <p>Release version {release.version} · Read-only context</p>}
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>Close plan context</button>
      </header>
      {list === undefined && <p role="status">Loading saved plans…</p>}
      {list === null && <p role="alert">Plans for this release version could not be verified.</p>}
      {list && !list.enabled && <p role="status">Creating or reviewing plans is unavailable on this service.</p>}
      {list?.truncated && <p role="status">Only the latest loaded plans are shown.</p>}
      {list?.plans.length === 0 && <p role="status">No saved plans were returned for this release.</p>}
      {list && selected && !row && <p role="status">The selected plan version is no longer available. Choose a current plan if one is listed.</p>}
      {row && pr && <section className="studio-agent-plan-record" aria-label="Selected operation plan">
        <h3 className="studio-agent-plan-facts-heading"><span>Plan details</span></h3>
        <dl>
          <div><dt>Repository</dt><dd>{pr.repositoryFullName}</dd></div>
          <div><dt>Merge method</dt><dd>{row.plan.method}</dd></div>
        </dl>
        <ol className="studio-agent-plan-steps" aria-label="Saved merge plan details">
          <li>
            <span aria-hidden="true">1</span>
            <div><h4>Recorded source head</h4><p>{pr.headRef} · <code>{pr.headSha}</code></p></div>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div><h4>Observed target base</h4><p>{pr.baseRef} · <code>{pr.baseSha}</code></p></div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div><h4>Recorded window</h4><p>
              <time dateTime={row.plan.window.startUtc}>{new Date(row.plan.window.startUtc).toLocaleString()}</time>
              {" – "}
              <time dateTime={row.plan.window.endUtc}>{new Date(row.plan.window.endUtc).toLocaleString()}</time>
            </p></div>
          </li>
        </ol>
      </section>}
      {list && list.plans.length > 0 && <label className="studio-agent-plan-select">Saved plan
        <select value={row?.id ?? ""} onChange={event => setSelected(list.plans.find(plan => plan.id === event.target.value))}>
          {!row && <option value="" disabled>Choose a current plan</option>}
          {list.plans.map(plan => <option key={plan.id} value={plan.id}>PR #{plan.plan.pullRequest.number} · Plan version {plan.version} · {planState(plan)}</option>)}
        </select>
      </label>}
      <div className="studio-agent-plan-actions">
        <button type="button" className="btn-secondary" aria-disabled={list === undefined}
          onClick={() => { if (active && list !== undefined) { setList(undefined); setRefresh(value => value + 1); } }}>
          <RefreshCw aria-hidden="true" size={14}/>Refresh plans
        </button>
        <div className="studio-agent-plan-destinations">
          <button type="button" className={canOpenReview ? "btn-secondary" : "btn-primary"} onClick={() => onReturn()}>
            Open exact release<ArrowRight aria-hidden="true" size={15}/>
          </button>
          {canOpenReview && <button type="button" className="btn-primary" onClick={() => {
            if (active && ownerConfig === desktopClient.config && revision === desktopClient.getContextRevision()) onReturn("review");
          }}>
            <ShieldCheck aria-hidden="true" size={15}/>View release review
          </button>}
        </div>
      </div>
    </div>
    <section className="studio-agent-plan-review" aria-label="Recorded plan review" tabIndex={0}>
      <h3>Recorded plan review</h3>
      {history ? <ol className="studio-agent-plan-events" role="list">
        {history.map(event => <li key={event.sequence}>
          {event.type === "reviewed" && event.actorKind === "independent_reviewer"
            ? <ShieldCheck aria-hidden="true" size={14}/> : <FileText aria-hidden="true" size={14}/>}
          <div>
            <strong>{operationPlanEventLabels[event.type]}</strong>
            <p><span>{event.actorKind.replaceAll("_", " ")}</span><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></p>
          </div>
        </li>)}
      </ol> : row ? <p role="status">Plan history could not be verified.</p> : <p>No plan selected.</p>}
      {currentEvidence && <AgentPlanEvidence key={JSON.stringify([currentEvidence.id, currentEvidence.version, currentEvidence.planDigest])}
        row={currentEvidence} />}
      <div className="studio-agent-plan-boundary">
        <h4><LockKeyhole aria-hidden="true" size={13}/> Review only</h4>
        <p>Review and execution controls are in Deployments. Saved plan review does not authorize execution.</p>
      </div>
    </section>
  </aside>;
}


function AgentPlanEvidence({row}: {row: ReleaseOperationPlanDto}) {
  const [open, setOpen] = useState(false);
  const {requestId, requestVersion, id, planDigest} = row;
  const titleId = useId();
  const reviewed = row.status === "reviewed" && row.version === 1;
  return <>
    {reviewed && <section className="studio-agent-plan-approval-reads" aria-label="Recorded approvals">
      <RecordedReleaseEvents subject="simulation approval" labels={simulationApprovalEventLabels}
        read={signal => desktopClient.simulationApprovalHistory(requestId, requestVersion, id, planDigest, signal)}/>
      <RecordedReleaseEvents subject="provider approval" labels={providerApprovalEventLabels}
        read={signal => desktopClient.providerApprovalHistory(requestId, requestVersion, id, planDigest, signal)}/>
    </section>}
    <section className="studio-agent-plan-evidence" aria-labelledby={titleId}>
      <h3 id={titleId}>Evidence</h3>
      <details onToggle={event => setOpen(event.currentTarget.open)}>
        <summary><FileText size={14} aria-hidden="true"/>Saved plan evidence<ChevronRight size={14} aria-hidden="true"/></summary>
        {open && <div className="studio-agent-plan-evidence-body">
          <dl>
            <div><dt>Plan digest</dt><dd><code>{planDigest}</code></dd></div>
            <div><dt>Saved intake digest</dt><dd><code>{row.plan.intakeDigest}</code></dd></div>
          </dl>
          <RecordedReleaseEvents subject="deployment execution" labels={deploymentExecutionEventLabels}
            read={signal => desktopClient.deploymentExecutionHistory(requestId, requestVersion, id, planDigest, signal)}/>
          <p>Application validation and rollback verification are unavailable here.</p>
        </div>}
      </details>
    </section>
  </>;
}
