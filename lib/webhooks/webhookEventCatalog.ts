/**
 * Plain-language catalog of webhook events for the self-serve Webhooks page. Every entry must be a
 * real WebhookEventKind (checked by the type), so a typo can never offer an event that never fires.
 */
import type { WebhookEventKind } from "./webhookEventKinds";

export interface WebhookEventEntry { kind: WebhookEventKind; group: string; description: string }

export const WEBHOOK_EVENT_CATALOG: readonly WebhookEventEntry[] = [
  { kind: "deployment.blocked", group: "Releases", description: "A release gate refused a deployment: change window, freeze, stability warning, checks or rings." },
  { kind: "release_gate.passed", group: "Releases", description: "A release gate check passed." },
  { kind: "release_gate.blocked", group: "Releases", description: "A release gate check blocked a release." },
  { kind: "pipeline.run_started", group: "Pipelines", description: "A pipeline run started." },
  { kind: "pipeline.run_completed", group: "Pipelines", description: "A pipeline run completed." },
  { kind: "pipeline.run_failed", group: "Pipelines", description: "A pipeline run failed." },
  { kind: "pipeline.stage_failed", group: "Pipelines", description: "A pipeline stage failed." },
  { kind: "pipeline.stage_decision_recorded", group: "Pipelines", description: "A decision was recorded for a pipeline stage." },
  { kind: "agent_gateway.request_pending", group: "AI agents", description: "An AI agent's action needs a person to decide." },
  { kind: "agent_gateway.request_decided", group: "AI agents", description: "Someone approved or rejected an agent's request." },
  { kind: "agent_gateway.outcome_recorded", group: "AI agents", description: "An agent reported what happened after acting." },
  { kind: "coding.pr_opened", group: "Code", description: "A pull request was opened for a coding task." },
  { kind: "coding.lint_failed", group: "Code", description: "Lint failed for a coding task." },
  { kind: "coding.test_failed", group: "Code", description: "Tests failed for a coding task." },
  { kind: "airflow.action_proposed", group: "Batches", description: "An Airflow automation proposed an action." },
  { kind: "airflow.automation_succeeded", group: "Batches", description: "An Airflow automation succeeded." },
  { kind: "airflow.automation_failed", group: "Batches", description: "An Airflow automation failed." },
  { kind: "connector.health_changed", group: "Workspace", description: "A connection became healthy or unhealthy." },
  { kind: "api_key.created", group: "Workspace", description: "An API key was created." },
  { kind: "api_key.revoked", group: "Workspace", description: "An API key was revoked." },
  { kind: "audit.integrity_failed", group: "Workspace", description: "Audit verification found an edited, missing or reordered record." },
  { kind: "workspace.access_requested", group: "Workspace", description: "Someone asked to join the workspace." },
  { kind: "billing.threshold_crossed", group: "Billing", description: "AI usage crossed a billing threshold." },
  { kind: "billing.quota_exhausted", group: "Billing", description: "A usage quota ran out." },
  { kind: "eval.regression_detected", group: "Quality", description: "An evaluation found a regression." },
  { kind: "eval.run_completed", group: "Quality", description: "An evaluation run completed." },
];
