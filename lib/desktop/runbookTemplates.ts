/**
 * Day-2 runbook starting points for Saved Tasks. Each fills an unsaved draft only:
 * the operator edits and saves it, and any action it leads to still goes through
 * the normal review and approval. Templates never run anything.
 */
export interface RunbookTemplate { id: string; title: string; summary: string; instruction: string; context: string }

const footer = "Prepare the plan and evidence only. Do not change anything until the action has been reviewed and approved in V19.";

export const RUNBOOK_TEMPLATES: readonly RunbookTemplate[] = [
  { id: "restart-service", title: "Restart a service safely", summary: "Check health, plan a restart, define success and rollback.",
    instruction: `Plan a safe restart of the service named below.\n1. Summarize current health from the latest recorded runs and open incidents.\n2. Propose the restart through the governed deployment for this environment.\n3. State what will count as success (stable tasks, error rate back to normal) and how long to watch.\n4. State the rollback if it does not stabilize.\n${footer}`,
    context: "Service:\nEnvironment:\nWhy a restart is needed:\nChange window or freeze to respect:" },
  { id: "roll-back-release", title: "Roll back the last release", summary: "Identify the last good version and prepare a governed rollback.",
    instruction: `Prepare a rollback of the most recent release in the environment below.\n1. Identify the release, its commit and the previous release that succeeded.\n2. List what changes for users and for configuration (compare the configuration fingerprints).\n3. Prepare the rollback as its own release for approval, with the incident or ticket linked.\n4. Describe how to confirm recovery.\n${footer}`,
    context: "Environment:\nRelease or version to roll back:\nIncident or ticket:\nUser impact observed:" },
  { id: "rotate-credential", title: "Rotate a credential", summary: "Plan a rotation without downtime and record who approved it.",
    instruction: `Plan the rotation of the credential described below.\n1. List every service and environment that uses it (names only, never the value).\n2. Order the steps so nothing loses access: create new, deploy consumers, verify, revoke old.\n3. Note who must approve each production step.\n4. Describe how to confirm the old credential is no longer used.\n${footer}`,
    context: "Credential name (not its value):\nProvider:\nEnvironments that use it:\nReason for rotation:" },
  { id: "investigate-deployment", title: "Investigate a failing deployment", summary: "Collect recorded evidence and propose the next safe step.",
    instruction: `Investigate the failing deployment below using recorded evidence.\n1. Summarize the workflow run, its failing step and the recorded logs.\n2. Compare it with the last successful run: commit, configuration fingerprint, environment.\n3. List likely causes in order, each with the evidence for it.\n4. Propose the next safe step (retry, fix, rollback) for review.\n${footer}`,
    context: "Repository:\nEnvironment:\nRun link or release:\nWhen it started failing:" },
  { id: "scale-for-event", title: "Scale for a traffic event", summary: "Plan capacity changes before and after a known peak.",
    instruction: `Plan capacity for the traffic event below.\n1. State the expected peak and the current capacity.\n2. Propose the configuration changes per environment (for example REPLICAS) and when to apply them.\n3. Define what to watch during the event and the threshold to act on.\n4. Plan the scale-down afterwards.\n${footer}`,
    context: "Service:\nEvent and dates:\nExpected peak:\nCurrent capacity:" },
  { id: "unstick-airflow", title: "Clear a stuck Airflow run", summary: "Find the blocking task and propose a governed retry or clear.",
    instruction: `Work out why the Airflow run below is stuck.\n1. Identify the blocking task and its state from the recorded run.\n2. Check upstream dependencies and recent changes to the DAG.\n3. Propose the smallest safe action (retry one task, clear downstream, or wait) for approval.\n4. Describe how to confirm the run completed.\n${footer}`,
    context: "DAG:\nRun:\nTask that looks stuck:\nDeadline that matters:" },
];

export function runbookTemplate(id: string): RunbookTemplate | undefined {
  return RUNBOOK_TEMPLATES.find((t) => t.id === id);
}
