/** Shared operational guidance for website docs and the installed desktop.
 * Navigation and explanation only: never execution authority or availability evidence.
 */
export const GOVERNED_JOURNEY = [
  {
    id: "scope", title: "Scope the repository", destination: "repository-workspace",
    cta: "Open repository",
    detail: "Select the connected repository and branch, then confirm the local folder and saved files. Repository context is evidence, not permission to change a cloud environment.",
  },
  {
    id: "code", title: "Prepare and verify code", destination: "agent",
    cta: "Open Agent",
    detail: "Ask for a targeted change, inspect the proposed diffs, and explicitly apply approved local edits. Run checks with command consent. A proposal does not apply code or prove a check passed; stale or failed verification remains visible.",
  },
  {
    id: "govern", title: "Review deployment authority", destination: "deployment-requests",
    cta: "Open deployment requests",
    detail: "Review the exact environment, artifact, readiness evidence and recovery plan. Obtain the required human approvals before execution. Model output, a local test pass and a GitHub connection do not grant deployment authority.",
  },
  {
    id: "schedule", title: "Schedule with Airflow", destination: "airflow-automation",
    cta: "Open Airflow",
    detail: "Use an authorized Airflow connection to inspect DAGs, dependencies and run state. Review the target and permitted operation before triggering work. A schedule is not deployment approval and does not guarantee successful execution.",
  },
  {
    id: "recover", title: "Validate and recover", destination: "deployment-requests",
    cta: "Review deployment evidence",
    detail: "Inspect execution results and validation evidence before closing a request. Preserve failures and confirm rollback readiness; a recorded recovery plan is not proof that rollback ran.",
  },
] as const;
export type GovernedJourneyDestination = typeof GOVERNED_JOURNEY[number]["destination"];
export const GOVERNED_JOURNEY_AVAILABILITY =
  "This guide explains the workflow. Available actions depend on the installed version, workspace policy, connected credentials and validated adapters. A guide is not proof of end-to-end acceptance.";
