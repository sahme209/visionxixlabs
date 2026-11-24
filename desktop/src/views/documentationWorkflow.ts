// These are documentation paths. They do not represent a tenant's live state.
export const workflowGroups = ["Preparation", "Release review", "Execution", "Verification"] as const;

const docs = "https://visionxixlabs.com/docs";
type Step = {
  id: string;
  title: string;
  group: number;
  row: number;
  detail: string;
  guide: string;
  status?: string;
  next: ReadonlyArray<{id: string; when: string; returnPath?: true}>;
};

export const workflowSteps: readonly Step[] = [
  {id: "scope", title: "Scope the change", group: 0, row: 0, guide: `${docs}/getting-started#workflow`,
    detail: "Confirm the repository, branch, artifact and target environment. Save the release request and use the exact saved version for subsequent review.",
    next: [{id: "evidence", when: "Release version recorded"}]},
  {id: "evidence", title: "Prepare readiness evidence", group: 0, row: 1, guide: `${docs}/releaseops/readiness`,
    detail: "Record the validation plan, evidence and recovery steps. Keep unknown results visible. A planned check is not an observed result.",
    next: [{id: "approval", when: "No batch dependency"}, {id: "batches", when: "Airflow runs declared"}]},
  {id: "batches", title: "Check declared Airflow runs", group: 0, row: 2, guide: `${docs}/batch-providers`,
    detail: "Inspect the runs declared on the selected release version. Waiting or unavailable evidence needs another scoped check. Finishing the runs does not grant release approval.",
    next: [{id: "approval", when: "Required runs verified"}]},
  {id: "approval", title: "Review current authority", group: 1, row: 1, guide: `${docs}/approval-workflow#desktop-release-review`,
    detail: "Obtain the required human approval for the exact operation and target. Review and execution are separate. A changed release, expired approval or missing authority calls for a new review.",
    next: [{id: "dispatch", when: "Current approval and authority"}, {id: "hold", when: "Rejected, expired or changed"}]},
  {id: "hold", title: "Hold for review", group: 1, row: 3, guide: `${docs}/permissions-model`,
    detail: "Keep the release on hold until the missing evidence or permission is resolved. Reopen the current saved version and obtain fresh review where required.",
    next: [{id: "approval", when: "Return to review", returnPath: true}]},
  {id: "dispatch", title: "Run the supported operation", group: 2, row: 1, guide: `${docs}/releaseops/connectors`,
    detail: "Follow the configured provider workflow and current authorization checks. Record the provider run reference when available. Dispatch acceptance alone does not establish execution or health.",
    next: [{id: "verify", when: "Observe execution outcome"}]},
  {id: "preview", title: "Separate requester execution", group: 2, row: 3, guide: `${docs}/approval-workflow`, status: "Local preview",
    detail: "The separate Agent requester execution control is documented as a local preview. It is not production-activated and may be absent from the installed version.",
    next: []},
  {id: "verify", title: "Verify the outcome", group: 3, row: 1, guide: `${docs}/releaseops/readiness`,
    detail: "Review provider outcome, required validation and evidence independently. Preserve failed and unconfirmed outcomes in the release record.",
    next: [{id: "close", when: "Closure criteria met"}, {id: "recover", when: "Failure or unconfirmed outcome"}]},
  {id: "close", title: "Record closure", group: 3, row: 0, guide: `${docs}/releaseops`,
    detail: "Close only after the required approvals, execution or manual steps, validation and evidence satisfy the request's closure criteria.",
    next: []},
  {id: "recover", title: "Review recovery", group: 3, row: 2, guide: `${docs}/rollback`,
    detail: "Follow the recovery procedure for the configured provider. The documented AWS ECS workflow restores the previous task definition on stabilization failure and verifies it afterward. Review unconfirmed outcomes before taking further action.",
    next: [{id: "verify", when: "Recheck independently", returnPath: true}]},
  {id: "limits", title: "Universal rollback", group: 3, row: 3, guide: `${docs}/rollback#limits`, status: "Unavailable",
    detail: "A universal provider rollback is unavailable. The ECS path does not undo database changes, external effects or work performed outside its workflow.",
    next: []},
];

const ticketSteps: readonly Step[] = [
  {id: "ticket", title: "Open a recorded ticket", group: 0, row: 0, guide: `${docs}/surfaces`,
    detail: "Open Tickets to review a deployment incident or a recorded change. Inspect its source, recorded state and available facts. Some workspace sources may be unavailable.",
    next: [{id: "timeline", when: "Deployment incident"}, {id: "change", when: "Provider change ticket"}]},
  {id: "timeline", title: "Read the incident timeline", group: 0, row: 1, guide: `${docs}/troubleshooting`,
    detail: "Use the recorded summary and reported, mitigated and resolved timestamps when present. A missing timestamp does not establish a completed stage.",
    next: [{id: "linked-release", when: "Read access and a linked release"}]},
  {id: "change", title: "Inspect the recorded change", group: 1, row: 0, guide: `${docs}/surfaces`,
    detail: "Compare the provider, recorded type, last synced time and linked release count. A saved change in the directory is not current provider evidence by itself.",
    next: [{id: "jira", when: "Jira action on the related release"}, {id: "servicenow", when: "ServiceNow action on the related release"}]},
  {id: "linked-release", title: "Open the exact linked release", group: 1, row: 1, guide: `${docs}/releaseops`,
    detail: "Use Open linked release to resolve the current saved version. If it changes before Deployments opens, return to Tickets and deliberately read it again.",
    next: [{id: "release-evidence", when: "Exact release available"}, {id: "timeline", when: "Link or exact version unavailable", returnPath: true}]},
  {id: "jira", title: "Review a saved Jira action", group: 2, row: 0, guide: `${docs}/approval-workflow`,
    detail: "From the related release, use the scoped Jira connection. Review the saved action and obtain independent approval before using the supported provider action.",
    next: [{id: "reconcile", when: "Read the Jira outcome"}]},
  {id: "servicenow", title: "Review a saved ServiceNow action", group: 2, row: 2, guide: `${docs}/approval-workflow`,
    detail: "From the related release, confirm the configured connection and available change model. Review the exact saved action and obtain independent approval before the provider change.",
    next: [{id: "reconcile", when: "Read the ServiceNow outcome"}]},
  {id: "release-evidence", title: "Inspect the release evidence", group: 2, row: 1, guide: `${docs}/releaseops/readiness`,
    detail: "Read the recorded release evidence and current scope. Keep planned checks and observed results separate when deciding whether recovery is needed.",
    next: [{id: "recovery", when: "Recovery needs review"}]},
  {id: "recovery", title: "Review release recovery", group: 3, row: 2, guide: `${docs}/rollback`,
    detail: "Use the linked release's validation and recovery evidence. Follow the provider-specific procedure and record what was observed. A mitigation entry or planned rollback does not prove recovery.",
    next: []},
  {id: "reconcile", title: "Reconcile the provider outcome", group: 3, row: 0, guide: `${docs}/releaseops/readiness`,
    detail: "Inspect recorded provider confirmation. Keep unknown outcomes open for reconciliation. ServiceNow closure has its own availability, evidence and review gates.",
    next: [{id: "closure", when: "ServiceNow closure is available and required evidence is recorded"}]},
  {id: "closure", title: "Review ServiceNow closure", group: 3, row: 1, guide: `${docs}/releaseops`,
    detail: "Review the saved closure action, its authority and provider outcome. Keep closure unconfirmed until evidence satisfies that action's gates. Closure here does not imply universal Jira or ServiceNow support.",
    next: []},
];

const batchSteps: readonly Step[] = [
  {id: "connect", title: "Confirm batch access", group: 0, row: 0, guide: `${docs}/integration-setup`,
    detail: "Use the workspace's authorized connection. Airflow automation and access to release dependencies have separate prerequisites.",
    next: [{id: "inspect", when: "Airflow connected"}, {id: "other-providers", when: "Scoped read-only provider"}]},
  {id: "other-providers", title: "Inspect other batch providers", group: 0, row: 2, guide: `${docs}/batch-providers`, status: "Read only",
    detail: "Prefect, Dagster and Argo Workflows have scoped read-only inspection. Live acceptance remains pending. These connections do not grant Airflow automation or release execution.",
    next: []},
  {id: "inspect", title: "Inspect Airflow runs", group: 1, row: 0, guide: `${docs}/batch-providers`,
    detail: "Review the selected DAG and its recorded runs. Optional run watching refreshes the visible Airflow view after opt-in. It pauses when Home covers Batches or Release dependencies is selected.",
    next: [{id: "dependencies", when: "A release declares specific runs"}]},
  {id: "dependencies", title: "Select exact release dependencies", group: 1, row: 1, guide: `${docs}/releaseops/readiness`,
    detail: "In Release dependencies, choose the saved release and version, or use Inspect release dependencies from Deployments. Batch readiness checks are available for submitted versions with pipeline read access. If the version changes, deliberately select a current row.",
    next: [{id: "check", when: "Submitted version and pipeline read access"}, {id: "monitor", when: "Inspect a saved monitoring record"}]},
  {id: "check", title: "Check the declared batches", group: 2, row: 1, guide: `${docs}/surfaces#batch-failed-run`,
    detail: "Use Check batches to read the declared runs for the exact version. Completion must match that version. Waiting and unverified responses leave the gate unresolved.",
    next: [{id: "review", when: "Required runs completed"}, {id: "waiting", when: "Waiting or unable to verify"}, {id: "tasks", when: "Run failed or task details needed"}]},
  {id: "tasks", title: "Inspect the run’s tasks", group: 2, row: 0, guide: `${docs}/surfaces#batch-failed-run`, status: "Read only",
    detail: "After Check batches records a failure for the selected release version, choose Inspect failed run to open the first failed run’s tasks. Inspect tasks opens the details for another observed run. Retry tasks repeats an unavailable read. Return to Check batches to refresh readiness for the saved version.",
    next: [{id: "check", when: "Refresh readiness for the selected version", returnPath: true}]},
  {id: "monitor", title: "Read the saved monitor", group: 2, row: 2, guide: `${docs}/releaseops`,
    detail: "Batches can inspect saved monitoring status, deadline and next observation for the selected version. Starting or stopping monitoring is separate and depends on the eligible controls in Deployments.",
    next: [{id: "waiting", when: "Expired, stopped or unavailable"}, {id: "check", when: "Manually check the recorded runs", returnPath: true}]},
  {id: "review", title: "Return to release review", group: 3, row: 1, guide: `${docs}/approval-workflow`,
    detail: "Open the selected release in Deployments. Batch completion or an observed monitor result does not grant execution authority. The release still needs current preflight evidence and any required approval.",
    next: []},
  {id: "waiting", title: "Keep readiness unresolved", group: 3, row: 2, guide: `${docs}/troubleshooting`,
    detail: "Use a fresh explicit check for the current release version. If the source remains unavailable, keep that uncertainty visible and review the configured connection before proceeding.",
    next: [{id: "check", when: "Current version is available to check", returnPath: true}]},
];

export const documentationWorkflows = [
  {id: "release", label: "Release", title: "Release workflow map",
    description: "Follow a release from preparation through review, execution and verification.",
    groups: workflowGroups, steps: workflowSteps},
  {id: "tickets", label: "Tickets and recovery", title: "Tickets and recovery workflow map",
    description: "Investigate recorded incidents and follow scoped Jira, ServiceNow and release recovery paths.",
    groups: ["Ticket intake", "Evidence", "Provider review", "Outcome"] as const, steps: ticketSteps},
  {id: "batches", label: "Batches", title: "Batch dependencies workflow map",
    description: "Trace authorized Airflow evidence from the declared runs to release review.",
    groups: ["Connection", "Run context", "Checks", "Release handoff"] as const, steps: batchSteps},
] as const;
