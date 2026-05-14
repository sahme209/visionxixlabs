/**
 * Contextual help registry.
 *
 * Every dashboard surface should answer "How does this work?" without a
 * support ticket. This module is the single mapping from screen-id →
 * help links. Surfaces import a typed `helpFor(screen)` and render the
 * links — no hand-typed hrefs scattered across components.
 *
 * Why a registry vs inline links: docs URLs change; CTA targeting changes;
 * "view the relevant section of /docs" should be one PR not twenty.
 */

export type HelpScreenId =
  | "dashboard.home"
  | "dashboard.command_center"
  | "dashboard.approvals"
  | "dashboard.workflows"
  | "dashboard.jobs"
  | "dashboard.topology"
  | "dashboard.memory"
  | "dashboard.copilot"
  | "dashboard.integrations"
  | "dashboard.governance"
  | "dashboard.releaseops"
  | "dashboard.reliability"
  | "dashboard.security"
  | "dashboard.audit"
  | "dashboard.traces"
  | "dashboard.resilience"
  | "operator.onboarding"
  | "download"
  | "docs.index";

export interface HelpLink {
  label: string;
  href: string;
  /** Short summary surfaced in tooltips / panels. */
  detail?: string;
}

export interface HelpBundle {
  /** One-sentence description of what this screen does. */
  what: string;
  /** Primary doc link — opens a deep dive. */
  primary: HelpLink;
  /** Secondary links — related topics. */
  secondary: HelpLink[];
  /** Common questions the screen answers (used in trust strips). */
  questions: { q: string; a: string }[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY: Record<HelpScreenId, HelpBundle> = {
  "dashboard.home": {
    what: "Workspace summary across all connected providers and recent activity.",
    primary: { label: "Getting started", href: "/docs/getting-started" },
    secondary: [
      { label: "Architecture overview", href: "/docs/architecture" },
      { label: "Permissions model",     href: "/docs/permissions-model" },
    ],
    questions: [
      { q: "What does Axiom do?",           a: "Reads your cloud state, classifies findings, and proposes safe approval-gated changes." },
      { q: "Where do I start?",             a: "Connect a provider in /operator/onboarding — AWS is fastest." },
    ],
  },
  "dashboard.command_center": {
    what: "Live operational view of scans, findings, plans, and execution.",
    primary: { label: "Command Center docs", href: "/docs/architecture" },
    secondary: [
      { label: "Approval workflow", href: "/docs/approval-workflow" },
      { label: "Execution plans",   href: "/docs/execution-plans" },
    ],
    questions: [
      { q: "Is this live data?",            a: "Yes when a provider is connected. The source tag on every panel labels live/preview/demo honestly." },
      { q: "How are findings prioritised?", a: "Risk × blast radius × tenant policy. The reasoner produces an evidence-backed score." },
    ],
  },
  "dashboard.approvals": {
    what: "Approve or deny execution plans. Every decision is audited and policy-evaluated.",
    primary: { label: "Approval workflow", href: "/docs/approval-workflow" },
    secondary: [
      { label: "Permissions model", href: "/docs/permissions-model" },
      { label: "Rollback strategy", href: "/docs/rollback" },
    ],
    questions: [
      { q: "Can I revoke an approval?",     a: "Yes — until the plan moves to running. After that, use the rollback path." },
      { q: "Who can approve?",              a: "Approver scope is set by your governance policy (any member / approver role / resource owner)." },
    ],
  },
  "dashboard.workflows": {
    what: "Recurring and ad-hoc operational workflows. Cron-driven where supported.",
    primary: { label: "Workflows overview", href: "/docs/architecture" },
    secondary: [
      { label: "Scanning",     href: "/docs/scanning" },
      { label: "ReleaseOps",   href: "/docs/releaseops" },
    ],
    questions: [
      { q: "Why is a workflow stuck?",     a: "Open the workflow detail — the recovery engine diagnoses the cause and suggests a safe move." },
    ],
  },
  "dashboard.jobs": {
    what: "Individual job lifecycle — queued, running, retrying, blocked, failed.",
    primary: { label: "Retry safety", href: "/docs/troubleshooting" },
    secondary: [
      { label: "Approval workflow", href: "/docs/approval-workflow" },
    ],
    questions: [
      { q: "Why isn't this retrying?",      a: "Some failure classes (credentials, policy, user input) are not safe to auto-retry." },
    ],
  },
  "dashboard.topology": {
    what: "Multi-cloud infrastructure graph with blast radius + dependency view.",
    primary: { label: "Architecture", href: "/docs/architecture" },
    secondary: [
      { label: "Scanning", href: "/docs/scanning" },
    ],
    questions: [
      { q: "How fresh is this?",            a: "Last scan timestamp is shown per provider. Re-scan from the Command Center." },
    ],
  },
  "dashboard.memory": {
    what: "Operational memory — what Axiom has learned about your environment.",
    primary: { label: "Architecture", href: "/docs/architecture" },
    secondary: [],
    questions: [
      { q: "Is this used by the AI?",       a: "Yes — the copilot reads memory before composing answers. All entries are redacted." },
    ],
  },
  "dashboard.copilot": {
    what: "AI operations copilot. Evidence-backed, policy-aware, approval-respecting.",
    primary: { label: "Security model",   href: "/docs/security-model" },
    secondary: [
      { label: "Permissions model",       href: "/docs/permissions-model" },
    ],
    questions: [
      { q: "Does it see my secrets?",       a: "No — the redaction pipeline runs before any LLM call." },
      { q: "Can it execute changes?",       a: "No — it can propose. Execution requires explicit human approval." },
    ],
  },
  "dashboard.integrations": {
    what: "Connectors across cloud, ReleaseOps, ticketing, messaging.",
    primary: { label: "Connectors guide", href: "/docs/getting-started" },
    secondary: [
      { label: "AWS setup",       href: "/docs/aws-setup" },
      { label: "Azure setup",     href: "/docs/azure-setup" },
      { label: "GCP setup",       href: "/docs/gcp-setup" },
      { label: "ReleaseOps",      href: "/docs/releaseops" },
    ],
    questions: [
      { q: "How do I revoke?",              a: "Open the connector card and use Revoke. Local credentials in the OS keychain are cleared on revocation." },
    ],
  },
  "dashboard.governance": {
    what: "Policy rules and autonomy ladder for the platform.",
    primary: { label: "Approval workflow", href: "/docs/approval-workflow" },
    secondary: [
      { label: "Permissions model", href: "/docs/permissions-model" },
      { label: "Security model",    href: "/docs/security-model" },
    ],
    questions: [
      { q: "Can the agent escalate itself?", a: "No — every autonomy change goes through an admin gate." },
    ],
  },
  "dashboard.releaseops": {
    what: "Deployment intelligence — readiness, blockers, risk, rollback.",
    primary: { label: "ReleaseOps", href: "/docs/releaseops" },
    secondary: [
      { label: "Approval workflow", href: "/docs/approval-workflow" },
      { label: "Rollback strategy", href: "/docs/rollback" },
    ],
    questions: [
      { q: "Why is this release risky?",    a: "The risk engine lists weighted factors — readiness gap, blockers, blast radius, recent failures." },
    ],
  },
  "dashboard.reliability": {
    what: "Idempotency, retries, circuit breakers, dead-letter, system health.",
    primary: { label: "Architecture", href: "/docs/architecture" },
    secondary: [
      { label: "Troubleshooting", href: "/docs/troubleshooting" },
    ],
    questions: [
      { q: "Can the system fail safely?",   a: "Yes — every failure routes through the classifier; unrecoverable items land in the dead-letter queue." },
    ],
  },
  "dashboard.security": {
    what: "Tenant trust posture — isolation, RBAC, credentials, redaction, desktop.",
    primary: { label: "Security model", href: "/docs/security-model" },
    secondary: [
      { label: "Permissions model", href: "/docs/permissions-model" },
      { label: "Audit logs",        href: "/docs/audit-logs" },
    ],
    questions: [
      { q: "Are secrets ever logged?",      a: "No — canonical redaction runs on every log, event, audit row, and AI context." },
    ],
  },
  "dashboard.audit": {
    what: "Audit stories — every sensitive action with actors, policy, approvals, evidence.",
    primary: { label: "Audit logs", href: "/docs/audit-logs" },
    secondary: [
      { label: "Approval workflow", href: "/docs/approval-workflow" },
    ],
    questions: [
      { q: "Can I export this?",            a: "Yes — JSON, CSV, NDJSON. PDF is on the roadmap." },
    ],
  },
  "dashboard.traces": {
    what: "Operation traces — span timelines, evidence, redacted spans for every operation.",
    primary: { label: "Architecture", href: "/docs/architecture" },
    secondary: [
      { label: "Audit logs", href: "/docs/audit-logs" },
    ],
    questions: [
      { q: "What's redacted?",              a: "Every string passes through canonical redaction before display. Sensitive keys are blocked outright." },
    ],
  },
  "dashboard.resilience": {
    what: "Disaster recovery readiness — RTO/RPO + posture scoring.",
    primary: { label: "Architecture", href: "/docs/architecture" },
    secondary: [],
    questions: [
      { q: "Is this a real DR plan?",       a: "It's a posture analyser. Acting on the plan is a separate Execution Center operation." },
    ],
  },
  "operator.onboarding": {
    what: "Connect a cloud provider, validate credentials, run the first scan.",
    primary: { label: "AWS setup", href: "/docs/aws-setup" },
    secondary: [
      { label: "Azure setup", href: "/docs/azure-setup" },
      { label: "GCP setup",   href: "/docs/gcp-setup" },
    ],
    questions: [
      { q: "What permissions does Axiom need?", a: "Read-only by default. Specific actions request additional scopes at use-time." },
    ],
  },
  "download": {
    what: "Downloadable desktop app for macOS / Windows / Linux. Currently preview.",
    primary: { label: "Desktop architecture", href: "/docs/desktop-architecture" },
    secondary: [
      { label: "Install guide", href: "/docs/desktop-install" },
      { label: "Security model", href: "/docs/security-model" },
    ],
    questions: [
      { q: "Why preview?",                  a: "Binaries ship with the signed 1.0 release. The Tauri shell is real but distribution requires signing/notarization." },
    ],
  },
  "docs.index": {
    what: "Documentation hub. Setup guides, architecture, security, troubleshooting.",
    primary: { label: "Getting started", href: "/docs/getting-started" },
    secondary: [
      { label: "Architecture", href: "/docs/architecture" },
      { label: "FAQ",          href: "/docs/faq" },
    ],
    questions: [],
  },
};

export function helpFor(screen: HelpScreenId): HelpBundle {
  return REGISTRY[screen];
}

/** All screen ids — for the Docs index "where to read about" page. */
export function listScreens(): HelpScreenId[] {
  return Object.keys(REGISTRY) as HelpScreenId[];
}
