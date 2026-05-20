/**
 * Workflow template catalog.
 *
 * Deterministic library of canned workflow drafts operators can pin
 * with one click — no AI required. These mirror the closed unions
 * used by aiWorkflowTranslator so a template pinned from here lands
 * in the same review flow as an AI-translated one.
 *
 * Approval-only-no-execution. Pinning a template does NOT activate
 * it — that's a separate operator step.
 */

export type TriggerKind = "telemetry_signal" | "cloud_inventory_change" | "schedule" | "manual";
export type ActionKind =
  | "notify_outbound" | "stage_runbook" | "stage_policy_proposal"
  | "open_approval_packet" | "log_audit_only";

export type TemplateArea = "security" | "cost" | "reliability" | "compliance";

export interface WorkflowTemplate {
  id: string;
  area: TemplateArea;
  name: string;
  description: string;
  trigger: { kind: TriggerKind; selector: string };
  actions: Array<{ kind: ActionKind; label: string; reason?: string }>;
}

const TEMPLATES: readonly WorkflowTemplate[] = [
  // ----- Security -----
  {
    id: "sec.s3_public_acl",
    area: "security",
    name: "S3 bucket public ACL → page security",
    description: "When an S3 bucket inventory flag changes to PublicReadACL, open an approval packet for tightening Public Access Block.",
    trigger: { kind: "cloud_inventory_change", selector: "aws.s3.bucket.public_acl=true" },
    actions: [
      { kind: "notify_outbound", label: "Page #sec-prod with the bucket ARN" },
      { kind: "open_approval_packet", label: "Tighten S3 PAB on the affected bucket", reason: "Requires operator review before applying." },
    ],
  },
  {
    id: "sec.iam_root_login",
    area: "security",
    name: "IAM root-user login → critical alert",
    description: "When a root-user console login is detected in CloudTrail, page security and stage an MFA enforcement runbook.",
    trigger: { kind: "telemetry_signal", selector: "cloudtrail.event_name=ConsoleLogin AND user_identity.type=Root" },
    actions: [
      { kind: "notify_outbound", label: "Page #sec-prod immediately" },
      { kind: "stage_runbook", label: "Force MFA + key rotation for root account" },
    ],
  },
  // ----- Cost -----
  {
    id: "cost.untagged_resources_weekly",
    area: "cost",
    name: "Weekly untagged-resource roundup",
    description: "Every Monday, snapshot all resources missing required tags and stage a policy proposal to add the cost-allocation tag.",
    trigger: { kind: "schedule", selector: "weekly:monday:09:00 UTC" },
    actions: [
      { kind: "stage_policy_proposal", label: "Add cost_center tag to non-compliant resources" },
      { kind: "notify_outbound", label: "Post weekly cost-tag roundup to #finops" },
    ],
  },
  {
    id: "cost.idle_ec2_30d",
    area: "cost",
    name: "Idle EC2 ≥ 30 days → review",
    description: "When EC2 inventory flags an instance with <2% CPU for 30 days, open an approval packet to stop or right-size.",
    trigger: { kind: "cloud_inventory_change", selector: "aws.ec2.cpu_avg_30d<0.02" },
    actions: [
      { kind: "open_approval_packet", label: "Right-size or stop idle EC2 instance", reason: "Operator confirms before any state change." },
    ],
  },
  // ----- Reliability -----
  {
    id: "rel.p95_latency_spike",
    area: "reliability",
    name: "p95 latency spike → stage rollback",
    description: "When the p95 latency anomaly detector flags a service, page on-call and stage a one-version rollback runbook.",
    trigger: { kind: "telemetry_signal", selector: "anomaly.p95_latency=true" },
    actions: [
      { kind: "notify_outbound", label: "Page #oncall with the service id + delta" },
      { kind: "stage_runbook", label: "Rollback last deploy by one version (operator must approve)" },
    ],
  },
  {
    id: "rel.cron_self_heal_skip",
    area: "reliability",
    name: "Cron skipping ≥ 3 consecutive ticks",
    description: "When a cron's self-heal tracker reports 3+ consecutive failures, page and log an audit row.",
    trigger: { kind: "telemetry_signal", selector: "cron.consecutive_failures>=3" },
    actions: [
      { kind: "notify_outbound", label: "Page #oncall with the cron id" },
      { kind: "log_audit_only", label: "Audit-only log of the skip event" },
    ],
  },
  // ----- Compliance -----
  {
    id: "comp.evidence_packet_weekly",
    area: "compliance",
    name: "Weekly compliance evidence packet",
    description: "Every Sunday, emit the deterministic evidence packet (bus + proposals + status) and notify the compliance channel.",
    trigger: { kind: "schedule", selector: "weekly:sunday:23:00 UTC" },
    actions: [
      { kind: "log_audit_only", label: "Emit and archive the weekly evidence-packet JSON" },
      { kind: "notify_outbound", label: "Post packet hash to #compliance" },
    ],
  },
];

export function listTemplates(): WorkflowTemplate[] { return [...TEMPLATES]; }

export function listTemplatesByArea(area: TemplateArea): WorkflowTemplate[] {
  return TEMPLATES.filter((t) => t.area === area);
}

export function findTemplate(id: string): WorkflowTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

export const TEMPLATE_AREAS: readonly TemplateArea[] = ["security", "cost", "reliability", "compliance"];
