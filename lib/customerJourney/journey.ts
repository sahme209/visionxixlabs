import type {DeploymentState} from "../tauri/releaseDeploymentExecutionContract";
import type {ReleaseWorkflowObservation} from "../tauri/releaseWorkflowEvidenceContract";

/** Presentation only. These summaries never confer authority or replace the
 * exact provider stores, native policies, human decisions or execution guards. */
export type JourneyStage='readiness'|'review'|'outcome'|'recovery';
export type JourneyStep={id:JourneyStage;title:string;state:'attention'|'verified'|'unverified';detail:string};
export type CustomerJourney={next:{title:string;owner:string;detail:string};steps:JourneyStep[];recovery:string};
type ActionObservation={status:string;attemptCount:number;providerWritePerformed:boolean|null;expiresAt:string;now:number;stale?:boolean;transportMode?:string};
export function actionJourney(o:ActionObservation):CustomerJourney{
 const expiry=Date.parse(o.expiresAt),uncertain=['unknown','dispatching'].includes(o.status),confirmed=o.status==='confirmed'&&o.attemptCount===1&&o.providerWritePerformed===true&&o.transportMode!=='controlled';
 const supported=['requested','awaiting_approval','approved','confirmed','refused','cancelled','unknown','dispatching'].includes(o.status),valid=supported&&Number.isFinite(expiry)&&Number.isFinite(o.now)&&[0,1].includes(o.attemptCount);
 let next:CustomerJourney['next'],recovery:string;
 if(uncertain){next={title:'Check the saved outcome',owner:'Designated requester',detail:'Read the durable action record and provider evidence before deciding what happens next.'};recovery='Do not resend. A timeout or missing acknowledgement does not prove that nothing happened.'}
 else if(o.stale||!valid){next={title:'Refresh saved status',owner:'Current workspace member',detail:'Current readiness and permissions are unverified. Load this exact record again.'};recovery='Keep the recorded plan and history. A stale screen cannot authorize another action.'}
 else if(confirmed){next={title:'Review the verified result',owner:'Requester and reviewer',detail:'This exact provider write has a confirmed saved receipt. Review its result and any separate follow-up.'};recovery='This attempt is complete. Any reversal or follow-up needs its own supported, reviewed action.'}
 else if(o.status==='confirmed'){next={title:'Verify the provider evidence',owner:'Designated requester',detail:'The record has no confirmed live provider-write receipt. A simulation or recorded status is not live acceptance.'};recovery='Do not resend. Reconcile the existing attempt; do not infer a provider effect.'}
 else if(o.attemptCount===1){next={title:'Review the recorded refusal',owner:'Designated requester',detail:'The attempt is consumed. Inspect the refusal and use only an explicitly supported recovery flow.'};recovery='Do not resend or reset this attempt. A separate recovery may require fresh proof and new independent review.'}
 else if(o.status==='cancelled'){next={title:'Review the cancelled plan',owner:'Designated requester',detail:'This plan cannot execute. Any replacement must be saved and independently reviewed.'};recovery='Keep the cancelled record. Its old approval cannot authorize another plan.'}
 else if(expiry<=o.now){next={title:'Prepare a fresh review',owner:'Designated requester',detail:'This unused plan has expired. Supported renewal clears its old approval and rechecks current access.'};recovery='No automatic renewal or retry. Confirm current targets and content before asking for a new review.'}
 else if(o.status==='approved'){next={title:'Review the exact execution controls',owner:'Designated requester',detail:'Approval is recorded for this plan. Current access, source, deadline and execution checks still apply.'};recovery='If the result becomes uncertain, load this exact saved action before taking another step.'}
 else if(['requested','awaiting_approval'].includes(o.status)){next={title:'Review the exact plan',owner:'Independent reviewer',detail:'A different authorized human reviews the exact target, content and effect. Approval alone does not send it.'};recovery='Correct or cancel an unused draft through its existing controls; changed content needs a fresh review.'}
 else{next={title:'Review the recorded refusal',owner:'Designated requester',detail:'Read the saved reason before preparing any replacement.'};recovery='Do not automatically resend a refused plan.'}
 const current=valid&&!o.stale;
 return{next,recovery,steps:[
 {id:'readiness',title:'Readiness',state:current?'attention':'unverified',detail:current?'Saved plan loaded. Current provider access and native policy are checked separately at execution.':'Current plan and access need verification.'},
 {id:'review',title:'Human review',state:current&&['approved','dispatching','confirmed'].includes(o.status)?'verified':'attention',detail:'Each exact action needs its own independent decision; connecting an account grants no action approval.'},
 {id:'outcome',title:'Verified outcome',state:confirmed&&!o.stale?'verified':'unverified',detail:confirmed&&!o.stale?'Confirmed provider-write receipt recorded for this exact attempt.':'No confirmed live provider outcome is established by this summary.'},
 {id:'recovery',title:'Recovery',state:uncertain||o.attemptCount===1&&!confirmed?'attention':'unverified',detail:recovery},
 ]};
}
type RecordedPrRequirement = {prStatus?: string; noPrRequired?: boolean};

export function prReviewNotRequired({ prStatus, noPrRequired }: RecordedPrRequirement) {
  return noPrRequired === true || prStatus === "not_applicable";
}

export function recordedPrReview(approval: RecordedPrRequirement) {
  if (prReviewNotRequired(approval)) return "PR not required";
  const {prStatus} = approval;
  if (prStatus === "approved") return "Approved (recorded)";
  if (prStatus === "pending") return "Pending";
  return "Unavailable";
}

export type ReleaseJourneyObservation = {
  status: string;
  approvalDecision: string;
  blockers: readonly string[];
  prStatus: string;
  noPrRequired: boolean;
  rollbackAvailability: string;
  stale: boolean;
  // Desktop supplies these only after reading exact release and plan evidence.
  executionState?: DeploymentState;
  workflowState?: Exclude<ReleaseWorkflowObservation["conclusion"], null> | "queued" | "in_progress";
};

export type ReleaseJourney = CustomerJourney & {
  next: CustomerJourney["next"] & {section?: "evidence" | "logs"};
};

function recordedExecutionGuidance({status, executionState, workflowState}: ReleaseJourneyObservation):
  {next: ReleaseJourney["next"]; recovery?: string} | undefined {
  const owner = "Release requester";
  if (executionState === "dispatching" || executionState === "unknown") {
    return {
      next: {title: "Check the saved deployment outcome", owner, section: "evidence",
        detail: "The dispatch outcome is unconfirmed. Review this plan’s execution history in Evidence before deciding what happens next."},
      recovery: "Do not send another deployment request while this outcome is unconfirmed.",
    };
  }
  if (executionState === "refused" || executionState === "cancelled") {
    const refused = executionState === "refused";
    return {
      next: {title: refused ? "Review the recorded refusal" : "Review the saved cancellation", owner, section: "evidence",
        detail: "Open Evidence to inspect the outcome saved for this release and plan."},
      recovery: "Do not resend this request. Any replacement needs its own review and approval.",
    };
  }
  if (workflowState === "success") {
    return {next: {title: "Check release verification", owner, section: "logs",
      detail: "The recorded workflow succeeded. Review the exact attempt, then verify application health and artifact delivery separately."
        + (status === "submitted" ? " Once verified externally, use Record external outcome to attach the result." : "")}};
  }
  if (workflowState && workflowState !== "queued" && workflowState !== "in_progress") {
    const outcome = {failure: "failed", cancelled: "cancelled", timed_out: "timed out",
      action_required: "requires action", neutral: "neutral", skipped: "skipped"}[workflowState];
    return {
      next: {title: "Inspect the recorded workflow", owner, section: "logs",
        detail: `The recorded outcome is ${outcome}. Inspect the matching run in Logs and check for any effects before recovery.`},
      recovery: "Rollback requires separate review and authority. A workflow outcome does not confirm what changed in the target environment.",
    };
  }
  if (workflowState || executionState === "accepted") {
    return {next: {title: "Check the acknowledged workflow", owner, section: "evidence",
      detail: "Open Evidence to inspect the workflow recorded for this plan. Acknowledgment alone does not verify the deployment."}};
  }
}

export function releaseJourney(o: ReleaseJourneyObservation): ReleaseJourney {
  if (o.stale) {
    const recovery = "Refresh the saved release to check its recovery requirements.";
    return {
      next: {
        title: "Refresh saved status",
        owner: "Current workspace member",
        detail: "The latest release status could not be verified. Refresh before making a decision.",
      },
      recovery,
      steps: [
        {id: "readiness", title: "Readiness", state: "unverified", detail: "Current prerequisites are unavailable."},
        {id: "review", title: "Human review", state: "unverified", detail: "Current approval requirements and decisions are unavailable."},
        {id: "outcome", title: "Verified outcome", state: "unverified", detail: "Current release outcomes are unavailable."},
        {id: "recovery", title: "Recovery", state: "unverified", detail: recovery},
      ],
    };
  }

  const ready = o.status === "submitted" && o.approvalDecision === "ready_for_human_approval";
  const noPrReview = prReviewNotRequired(o);
  const blockers = o.blockers.join(" · ");
  const execution = recordedExecutionGuidance(o);
  let next: ReleaseJourney["next"];
  if (execution) {
    next = execution.next;
  } else if (o.status === "closed") {
    next = {title: "Review saved outcomes and history", owner: "Requester and reviewer",
      detail: "This request is closed. Inspect saved evidence and use only separately supported recovery controls."};
  } else if (o.status === "draft") {
    next = {title: "Complete release details", owner: "Release requester",
      detail: "Capture scope, repository, validation, ownership and recovery requirements."};
  } else if (!ready) {
    next = {title: "Resolve readiness items", owner: "Release requester",
      detail: blockers || "Review the current request and its required signals."};
  } else if (!noPrReview) {
    next = {title: "View release review", owner: "Requester and independent reviewer",
      detail: "Check the pull request and the saved merge decision for this release version. Execution requires its own approval."};
  } else {
    next = {title: "Review exact execution controls", owner: "Requester and independent reviewer",
      detail: "Inspect the saved plan, its independent review and its separate execution approvals."};
  }

  const recovery = execution?.recovery ?? (o.rollbackAvailability === "yes"
    ? "A rollback path is declared, not a verified rollback. Review its exact scope, owner, evidence and separate authority."
    : "A verified recovery path is not established. Record the responsible owner and inspect the supported recovery controls.");
  const review = noPrReview ? "PR not required for this request" : o.prStatus === "approved"
    ? "PR approval recorded" : "PR approval needs review";
  return {
    next,
    recovery,
    steps: [
      {id: "readiness", title: "Readiness", state: ready ? "verified" : "attention",
        detail: ready ? "Recorded prerequisite signals are present; this does not authorize execution." : blockers || "Review required release details and current signals."},
      {id: "review", title: "Human review", state: "attention",
        detail: `${review}. Exact merge, deployment and ticket actions require separate approvals.`},
      {id: "outcome", title: "Verified outcome", state: "unverified",
        detail: execution?.next.detail ?? (o.status === "closed"
          ? "The release request is closed. Inspect saved provider receipts to verify deployment and application health."
          : "Read saved execution outcomes and successful-run evidence. This request summary does not establish provider effects or application health.")},
      {id: "recovery", title: "Recovery", state: execution?.recovery ? "attention" : "unverified", detail: recovery},
    ],
  };
}
