/**
 * Knowledge layer for demo scenarios.
 *
 * Pure mapping — no I/O. Returns the educational copy that turns each
 * demo step into a learning moment: what the platform does behind the
 * scenes, which safety invariants are touched, how the data flows.
 *
 * Why this lives separately:
 *   - The scenarios themselves stay terse and operator-facing.
 *   - Educational copy is product-marketing-class content; keeping it
 *     here keeps it auditable + reviewable + diffable in PRs.
 *   - One place to update when the underlying engineering changes.
 */

import type { DemoScenario, DemoScenarioId, DemoStep } from "./demoScenarios";

/** A short knowledge nugget rendered next to a step's visual. */
export interface StepKnowledge {
  /** Short title (3-4 words). */
  title: string;
  /** Why the platform behaves this way (1-2 sentences). */
  body: string;
}

/** A safety invariant the platform enforces — surfaced as a badge row. */
export interface SafetyInvariant {
  label: string;
  detail: string;
}

const READ_ONLY:        SafetyInvariant = { label: "Read-only by default",  detail: "No write API is even minted until you explicitly grant write scope." };
const TWO_PERSON:       SafetyInvariant = { label: "Two-person quorum",     detail: "Pipeline gates default to requiredApprovers=2. No surface can single-handedly tip a gate." };
const ROLLBACK_READY:   SafetyInvariant = { label: "Rollback verified",     detail: "Every recommendation ships with a pre-validated rollback plan before the apply button is enabled." };
const BLAST_RADIUS:     SafetyInvariant = { label: "Blast radius capped",   detail: "Each change is risk-tiered against the number of resources it touches; high tiers force extra approvers." };
const AUDIT_FABRIC:     SafetyInvariant = { label: "Full audit fabric",     detail: "Every action emits a row in the closed-union AuditAction log — actor, action, outcome, correlationId." };
const ASSUME_ROLE:      SafetyInvariant = { label: "Assume-role model",     detail: "No long-lived access keys stored — workspace assumes a short-lived role you own and can revoke." };
const CLOSED_UNION:     SafetyInvariant = { label: "Closed-union types",    detail: "Scope strings, event kinds, audit actions, approval rules are TypeScript closed unions — typos are compile errors, not runtime denial bugs." };
const TENANT_ISOLATION: SafetyInvariant = { label: "Tenant isolation",      detail: "Every Prisma read joins on organizationId; cross-tenant probes collapse to 404, never leak." };
const IDEMPOTENT:       SafetyInvariant = { label: "Idempotent writes",     detail: "Stripe-style Idempotency-Key on every POST that fires side-effects; duplicate calls return the cached response." };
const SIGNED_DELIVERY:  SafetyInvariant = { label: "Signed webhooks",       detail: "Every outbound delivery carries HMAC-SHA256 and ES256 (JWS) signatures; public keys published at /api/v1/webhooks/jwks." };

/** Per-step knowledge based on step kind + scenario. Heuristic-driven. */
export function knowledgeForStep(_scenario: DemoScenario, step: DemoStep): StepKnowledge {
  const t = (step.title + " " + step.description).toLowerCase();

  if (t.includes("workspace") && (t.includes("create") || t.includes("residency"))) {
    return {
      title: "Behind the scenes",
      body: "Workspace ids carry a prefix (ws_real_*, ws_sandbox_*, ws_internal_*) which is the platform-wide tenant-kind tag. Demo data is gated by isSandboxWorkspace() and assertNotDemoLeak() so example rows can NEVER leak into a real workspace.",
    };
  }
  if (t.includes("invite") || t.includes("teammate") || t.includes("role")) {
    return {
      title: "Roles, not permissions",
      body: "Roles compose into Permission sets via a pure permissionResolver kernel. Every dashboard route enforces it at the IO boundary; pages don't sprinkle their own auth checks.",
    };
  }
  if (t.includes("connect") || step.relatedConnector) {
    return {
      title: "Assume-role over keys",
      body: "Cloud connectors never store long-lived access keys. AWS uses a cross-account IAM role you create + an externalId we generate; Azure uses a service principal you control. You can revoke at any time from the provider console — no calls needed.",
    };
  }
  if (t.includes("scan")) {
    return {
      title: "Read-only inventory",
      body: "The first scan touches list-* and describe-* APIs only. Findings are computed in pure kernels (no provider mutation). A live → preview → blocked source-mode flag travels with every row so you always know what's real.",
    };
  }
  if (t.includes("risk") || t.includes("finding") || t.includes("detected")) {
    return {
      title: "Severity is computed, not assigned",
      body: "Severity = f(exposure, blast radius, compliance binding, exploit reachability). Pure kernel — same inputs always yield the same severity, and the function is unit-tested against a fixture set.",
    };
  }
  if (t.includes("recommend") || t.includes("terraform") || t.includes("diff") || t.includes("plan")) {
    return {
      title: "Plans before applies",
      body: "Every recommendation generates a Terraform diff + a separate rollback plan. The apply button stays disabled until the rollback plan validates against a digital twin of your cloud.",
    };
  }
  if (step.approval === "two_person" || t.includes("approval")) {
    return {
      title: "Two-person human approval",
      body: "Approval snapshots default to requiredApprovers=2 with a per-snapshot DB-unique constraint on (snapshotId, approverUserId). The desktop, the CLI, and the web all hit the same kernel — no surface can rubber-stamp.",
    };
  }
  if (t.includes("postmortem") || t.includes("incident") || t.includes("timeline")) {
    return {
      title: "Timelines are stitched, not narrated",
      body: "The incident timeline is built from real platform events — deploys, audit rows, config changes, alert ingestions — joined on correlationId. The AI proposes a root cause hypothesis with citations to the underlying rows.",
    };
  }
  if (t.includes("backup") || t.includes("ddl") || t.includes("schema")) {
    return {
      title: "Schema changes are change-class",
      body: "DDL is treated as a high-tier action regardless of how small the diff looks. A composite-index add forces two-person approval and a rollback plan; the runner pauses at the approval stage before running anything.",
    };
  }
  if (t.includes("desktop") || t.includes("pair")) {
    return {
      title: "Desktop is just an API key",
      body: "Pairing the desktop = pasting a vxlk_live_* key with the scopes you want it to have. The webview never sees plaintext credentials; the key lives in OS keychain via the keyring crate and is read on every Authorization header build.",
    };
  }
  if (t.includes("audit")) {
    return {
      title: "Closed-union audit actions",
      body: "Every audit row uses one of ~80 closed-union AuditAction values. A typo would be a compile error, not a silent denial bug. Rows are best-effort wrapped on the producer side so an audit-DB blip never blocks the business event.",
    };
  }
  if (t.includes("quota") || t.includes("billing") || t.includes("usage")) {
    return {
      title: "Quota gates fail open",
      body: "The monthly v1 quota gate reads UsageEvent rows month-to-date. If the billing DB is slow or unreachable, the call FAILS OPEN (you keep working) — better to over-serve than to lock customers out of their integration.",
    };
  }
  if (t.includes("dry-run") || t.includes("dry run") || t.includes("automation")) {
    return {
      title: "Dry-run is the default",
      body: "Every automation runs in dry-run mode by default. The plan output enumerates every side-effect; you have to explicitly promote it to live. Live runs always emit an audit row + a stage of awaiting_approval if any action is change-class.",
    };
  }
  if (t.includes("engineer") || step.relatedAgent) {
    return {
      title: "Engineers have scoped tools",
      body: "Each AI engineer is configured with a closed set of callable tools (scan, propose, draft-plan, comment). The runtime gate checks every call against the engineer's scope BEFORE the model can see the tool definition — typos can't widen authority.",
    };
  }
  return {
    title: "Why this step matters",
    body: "Every demo step maps to a real platform surface — the route shown in the browser-chrome bar is the actual production path. The mock data here is illustrative; the architecture, kernels, and audit flow are real.",
  };
}

/**
 * Safety invariants surfaced as small badges next to each step. The set
 * is curated per step kind so the same invariant doesn't appear on
 * every step — only the ones that the step's behavior depends on.
 */
export function invariantsForStep(step: DemoStep): ReadonlyArray<SafetyInvariant> {
  const t = (step.title + " " + step.description).toLowerCase();
  const out: SafetyInvariant[] = [];
  const add = (inv: SafetyInvariant) => { if (!out.some((x) => x.label === inv.label)) out.push(inv); };

  if (step.approval === "two_person") add(TWO_PERSON);
  if (step.relatedConnector || t.includes("connect"))     add(ASSUME_ROLE);
  if (t.includes("scan") || t.includes("read-only") || t.includes("inventory")) add(READ_ONLY);
  if (t.includes("recommend") || t.includes("plan") || t.includes("terraform")) add(ROLLBACK_READY);
  if (t.includes("risk") || t.includes("finding") || t.includes("severity"))    add(BLAST_RADIUS);
  if (t.includes("audit") || step.route === "/dashboard/audit")                  add(AUDIT_FABRIC);
  if (t.includes("scope") || t.includes("permission") || t.includes("role"))     add(CLOSED_UNION);
  if (t.includes("tenant") || t.includes("workspace"))                          add(TENANT_ISOLATION);
  if (t.includes("dry-run") || t.includes("execute") || t.includes("trigger"))   add(IDEMPOTENT);
  if (t.includes("webhook") || t.includes("delivery"))                          add(SIGNED_DELIVERY);

  // Every step in a two-person scenario inherits the audit invariant.
  if (step.approval === "two_person") add(AUDIT_FABRIC);
  return out;
}

/**
 * Per-scenario architecture diagram. Plain ASCII boxes-and-arrows so
 * the rendered page is just <pre>; no SVG dependency. Each diagram
 * shows the data flow specific to that scenario, not a generic chart.
 */
export const SCENARIO_DIAGRAMS: Record<DemoScenarioId, string> = {
  first_time_workspace_setup: `
   you           workspace          provider
    │                 │                 │
    ├─create─────────▶│                 │
    │                 ├─assume role────▶│  (read-only)
    │◀───inventory────┤                 │
    ├─invite team────▶│                 │
    └─enable engineer▶│                 │
  `.trimEnd(),

  cloud_operations: `
   AWS  ──assume-role──▶  Cloud Engineer  ──scan──▶  finding
                                  │
                              recommend (terraform diff + rollback)
                                  │
                                  ▼
                          two-person approval  ──tip──▶  apply
                                  │                       │
                                  └────────audit row──────┘
  `.trimEnd(),

  devops_pipeline: `
   GitHub  ──webhook──▶  DevOps Engineer  ──read pipeline──▶  status
                                │
                            explain failure (cite log lines)
                                │
                            suggest diff
                                │
                                ▼
                        two-person approval  ──tip──▶  open PR
  `.trimEnd(),

  security_finding: `
   scan  ──finding──▶  Security Engineer  ──impact──▶  blast radius
                              │
                          remediation plan
                          (terraform diff + rollback)
                              │
                              ▼
                      two-person approval  ──tip──▶  apply
  `.trimEnd(),

  monitoring_alert: `
   CloudWatch/Grafana  ──alert──▶  Monitoring Engineer
                                          │
                                  correlate with recent deploys
                                          │
                                          ▼
                                   incident created
  `.trimEnd(),

  incident_response: `
   alert ──promote──▶ incident
              │
          timeline (deploys + configs + logs joined on correlationId)
              │
          root-cause hypothesis (Incident Engineer)
              │
              ▼
       two-person approval ──tip──▶ mitigation
              │
          postmortem auto-drafted
  `.trimEnd(),

  database_health: `
   DB  ──read-only role──▶  Database Engineer
                                  │
                          slow query / backup gap detected
                                  │
                          composite index proposed (DDL)
                                  │
                                  ▼
                        two-person approval ──tip──▶ DDL runs
  `.trimEnd(),

  desktop_app_pairing: `
   web /admin/api-keys ──mint vxlk_live_*──▶  paste in desktop
                                                  │
                                          keyring (OS keychain)
                                                  │
                                          Authorization: Bearer
                                                  │
                                          v1 API surface
  `.trimEnd(),

  developer_tools: `
   VS Code extension ──API key──▶  workspace
                                        │
                              link local repo to tracked repo
                                        │
                              chat: DevOps Engineer cites log lines
  `.trimEnd(),

  automation_dry_run: `
   library  ──pick script──▶  dry-run (no live calls)
                                      │
                              plan output + risk class
                                      │
                                      ▼
                          two-person approval ──tip──▶ execute
                                      │
                                  audit row
  `.trimEnd(),

  ai_workforce_overview: `
   engineer registry ──tool access──▶ approval rules
                              │              │
                          activity ─────▶ audit fabric (full closed-union)
  `.trimEnd(),

  pricing_and_usage: `
   UsageEvent rows ──aggregate──▶ quota gauge
                                        │
                              70/90/100% alert thresholds
                                        │
                                ▼              ▼
                          email alert    in-app banner
  `.trimEnd(),

  internal_growth_automation: `
   platform activity ──summarize──▶ draft (admin only)
                                          │
                                  human approval (always)
                                          │
                                  scheduled post
  `.trimEnd(),
};

/**
 * Closing knowledge nugget per scenario — a short paragraph rendered
 * at the bottom of the walkthrough. Aimed at someone who finished the
 * steps and wants the "what's the engineering principle behind all
 * this" takeaway.
 */
export const SCENARIO_CLOSERS: Record<DemoScenarioId, string> = {
  first_time_workspace_setup:
    "Setup is intentionally narrow: workspace, team, connector, scan, policy, engineer, report. Each step is reversible from the same surface you set it up on. No multi-page wizards, no irreversible 'configure once' switches.",

  cloud_operations:
    "The whole loop — connector to apply — is gated by two human approvers and a verified rollback. Cost optimization, IAM hardening, drift correction all use the same kernel; the only thing that changes is which engineer proposed it.",

  devops_pipeline:
    "DevOps Engineer is read-only by default. Modifying the pipeline (yaml, secrets, branch protection) is always change-class — same approval rule as a Terraform apply, same audit fabric.",

  security_finding:
    "Security findings travel with provenance: which scan, which rule, which resource, which compliance binding. The recommendation is a separate kernel from the detection — easier to evolve them independently.",

  monitoring_alert:
    "Alert → incident promotion is a closed-union state machine, not a thresholded heuristic. The Monitoring Engineer correlates with recent deploys + config changes + logs joined on correlationId — no opaque ML model in the path.",

  incident_response:
    "Incidents persist their timeline + their root-cause hypothesis as Prisma rows, not in-memory state. A process restart never loses a postmortem in flight. Approval-gated mitigations show up in the same approvals queue as everything else.",

  database_health:
    "Database Engineer is the only AI engineer with NO write tools by default. Every DDL proposal generates a sample HCL + rollback + the migration's expected impact on connected services before the approval packet is minted.",

  desktop_app_pairing:
    "Pairing = pasting an API key. There's no separate auth flow, no special pairing protocol. The desktop is a thin Tauri shell around the same v1 surface you'd hit from a CI runner, with the OS keychain caching credentials.",

  developer_tools:
    "The VS Code extension authenticates with the same API key as the desktop. No separate IDE login, no copy-paste of session cookies. The DevOps Engineer cites back to specific log lines so suggestions are verifiable, not hand-wavy.",

  automation_dry_run:
    "Every automation has two modes: dry-run (default, no side effects, just plan output) and live. Live mode requires approval for any change-class step, and the runner is durable — a process restart resumes from the last stage row.",

  ai_workforce_overview:
    "The five panels (registry, tool access, approval rules, activity, audit) ALL read from the same canonical state. There's no separate 'agent dashboard' or hidden ops view — what you see here is what compliance auditors see in the audit logs.",

  pricing_and_usage:
    "Quota is enforced at the API boundary with a fail-open guarantee on the billing-DB path. The 70/90/100% alert thresholds run on the same UsageEvent rows you see in the gauge — no separate cron, no separate aggregation.",

  internal_growth_automation:
    "Internal-only. Drafts always require explicit human approval before any post fires. The audience='internal_only' tag on the scenario is enforced by listScenarios() — a real workspace can NEVER see this surface.",
};
