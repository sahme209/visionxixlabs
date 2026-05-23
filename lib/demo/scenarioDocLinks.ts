/**
 * Doc cross-reference catalog for demo scenarios.
 *
 * Pure mapping — no I/O. Takes a step (title, description, route,
 * connector, agent) and returns the matching set of /docs pages so the
 * walkthrough can show "read more" links pinned to the surface the
 * step is teaching.
 *
 * Why this lives separately:
 *   - The mapping is one place to audit (lastReviewed sweep), not 13
 *     places scattered through scenario step objects.
 *   - Adding a new /docs page → update this file → every scenario step
 *     that mentions it picks up the link automatically.
 */

import type { DemoScenario, DemoScenarioId, DemoStep } from "./demoScenarios";

export interface DocRef {
  href: string;
  title: string;
  /** One-line summary surfaced in tooltips / hover cards. */
  blurb: string;
}

/** Every /docs/* page known to the catalog. Add new entries here. */
const DOCS: Record<string, DocRef> = {
  gettingStarted:   { href: "/docs/getting-started",   title: "Getting Started",   blurb: "Workspace creation, first connector, first scan." },
  awsSetup:         { href: "/docs/aws-setup",         title: "AWS Setup",         blurb: "Read-only cross-account IAM role + scan permissions." },
  azureSetup:       { href: "/docs/azure-setup",       title: "Azure Setup",       blurb: "Service-principal app registration + RBAC roles." },
  oauthSetup:       { href: "/docs/oauth-setup",       title: "OAuth Setup",       blurb: "GitHub / GitLab / Google OAuth providers." },
  desktopInstall:   { href: "/docs/desktop-install",   title: "Desktop Install",   blurb: "macOS / Windows / Linux build + first pairing." },
  scanning:         { href: "/docs/scanning",          title: "Scanning Model",    blurb: "Inventory + risk surfaces + scan frequency." },
  sourceModes:      { href: "/docs/source-modes",      title: "Source Modes",      blurb: "live · partial_live · preview · blocked." },
  approvalWorkflow: { href: "/docs/approval-workflow", title: "Approval Workflow", blurb: "Two-person quorum, snapshots, decision audit." },
  executionPlans:   { href: "/docs/execution-plans",   title: "Execution Plans",   blurb: "Phased plans, dependency graphs, rollback verification." },
  terraformExport:  { href: "/docs/terraform-export",  title: "Terraform Export",  blurb: "HCL output + state-import + drift comparison." },
  auditLogs:        { href: "/docs/audit-logs",        title: "Audit Logs",        blurb: "Every action recorded with closed-union AuditAction." },
  permissionsModel: { href: "/docs/permissions-model", title: "Permissions Model", blurb: "Scopes, roles, and tenant isolation." },
  architecture:     { href: "/docs/architecture",      title: "Architecture",      blurb: "Pure kernels, IO boundaries, closed-union safety." },
  troubleshooting:  { href: "/docs/troubleshooting",   title: "Troubleshooting",   blurb: "Common errors + recovery playbooks." },
  faq:              { href: "/docs/faq",               title: "FAQ",               blurb: "Quick answers about safety, data, and pricing." },
};

/**
 * Per-scenario primary doc — what to read FIRST to understand the
 * whole walkthrough. Surfaced in the scenario header as a featured
 * link before the step-by-step visuals.
 */
export const SCENARIO_PRIMARY_DOCS: Record<DemoScenarioId, DocRef> = {
  first_time_workspace_setup: DOCS.gettingStarted,
  cloud_operations:           DOCS.awsSetup,
  devops_pipeline:            DOCS.oauthSetup,
  security_finding:           DOCS.scanning,
  monitoring_alert:           DOCS.troubleshooting,
  incident_response:          DOCS.approvalWorkflow,
  database_health:            DOCS.executionPlans,
  desktop_app_pairing:        DOCS.desktopInstall,
  developer_tools:            DOCS.oauthSetup,
  automation_dry_run:         DOCS.executionPlans,
  ai_workforce_overview:      DOCS.architecture,
  pricing_and_usage:          DOCS.faq,
  internal_growth_automation: DOCS.faq,
};

/**
 * Per-step doc references. Multiple docs can be relevant — order
 * matters (most relevant first). Heuristic-driven: title/description
 * text + relatedConnector + relatedAgent + step.route.
 */
export function docsForStep(step: DemoStep): ReadonlyArray<DocRef> {
  const t = (step.title + " " + step.description).toLowerCase();
  const refs: DocRef[] = [];
  const add = (d: DocRef) => { if (!refs.some((r) => r.href === d.href)) refs.push(d); };

  if (step.approval === "two_person" || t.includes("approval")) add(DOCS.approvalWorkflow);
  if (step.relatedConnector?.toUpperCase().includes("AWS"))     add(DOCS.awsSetup);
  if (step.relatedConnector?.toLowerCase().includes("azure"))   add(DOCS.azureSetup);
  if (step.relatedConnector === "GitHub")                       add(DOCS.oauthSetup);
  if (t.includes("scan") || t.includes("finding"))              add(DOCS.scanning);
  if (t.includes("terraform") || t.includes("diff") || t.includes("hcl")) add(DOCS.terraformExport);
  if (t.includes("execution") || t.includes("plan"))            add(DOCS.executionPlans);
  if (t.includes("audit") || step.route === "/dashboard/audit") add(DOCS.auditLogs);
  if (step.route === "/dashboard/desktop" || t.includes("desktop")) add(DOCS.desktopInstall);
  if (t.includes("preview") || t.includes("source mode"))       add(DOCS.sourceModes);
  if (t.includes("role") || t.includes("scope") || t.includes("permission")) add(DOCS.permissionsModel);
  return refs;
}

/** Aggregate every unique doc referenced by any step in the scenario. */
export function docsForScenario(s: DemoScenario): ReadonlyArray<DocRef> {
  const all: DocRef[] = [SCENARIO_PRIMARY_DOCS[s.id]];
  for (const step of s.steps) {
    for (const d of docsForStep(step)) {
      if (!all.some((r) => r.href === d.href)) all.push(d);
    }
  }
  return all;
}
