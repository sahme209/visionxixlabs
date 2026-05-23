/**
 * StepVisual — renders a mock UI panel for one demo step.
 *
 * The "kind" of visual is detected from the step's text + metadata
 * (connector, agent, approval gate). Closed-union StepKind means a
 * future-added kind has to register a template here — no silent
 * fallthrough to a generic card.
 *
 * Visuals are stylized mocks (not real platform screenshots) so they
 * stay accurate as the product evolves. Each panel shows what the
 * step LOOKS like, not the real production data.
 */

import type { DemoStep } from "@/lib/demo/demoScenarios";

type StepKind =
  | "connector"
  | "scan"
  | "risk"
  | "recommendation"
  | "approval"
  | "engineer"
  | "report"
  | "audit"
  | "incident"
  | "quota"
  | "pipeline"
  | "database"
  | "desktop"
  | "automation"
  | "generic";

function detectStepKind(step: DemoStep): StepKind {
  const t = (step.title + " " + step.description).toLowerCase();
  // Order matters — approval beats connector even when both apply.
  if (step.approval === "two_person" || t.includes("approval gate") || t.includes("approval packet") || t.includes("approves")) return "approval";
  if (t.includes("incident") || t.includes("alert") || t.includes("timeline")) return "incident";
  if (t.includes("database") || t.includes("ddl") || t.includes("query") || t.includes("backup") || t.includes("schema")) return "database";
  if (t.includes("desktop") || t.includes("pair") || step.route === "/dashboard/desktop") return "desktop";
  if (t.includes("dry-run") || t.includes("dry run") || t.includes("automation") || t.includes("execute")) return "automation";
  if (t.includes("pipeline") || t.includes("ci ") || t.includes("github workflow") || t.includes("build")) return "pipeline";
  if (t.includes("audit")) return "audit";
  if (t.includes("quota") || t.includes("billing") || t.includes("usage") || t.includes("upgrade")) return "quota";
  if (t.includes("report") || t.includes("postmortem")) return "report";
  if (t.includes("recommend") || t.includes("terraform") || t.includes("diff") || t.includes("rollback")) return "recommendation";
  if (t.includes("risk") || t.includes("finding") || t.includes("detected") || t.includes("severity")) return "risk";
  if (t.includes("scan")) return "scan";
  if (step.relatedConnector || t.includes("connect")) return "connector";
  if (step.relatedAgent || t.includes("engineer") || t.includes("agent")) return "engineer";
  return "generic";
}

export function StepVisual({ step, ord }: { step: DemoStep; ord: number }) {
  const kind = detectStepKind(step);
  // Desktop-kind steps render inside a Tauri window frame; every other
  // step that targets a /dashboard/* route renders inside a web-app
  // frame with sidebar + topbar. The rest (homepage, /demo, /download)
  // get the simple browser chrome.
  if (kind === "desktop") {
    return (
      <MockDesktopFrame route={step.route}>
        {render(kind, step, ord)}
      </MockDesktopFrame>
    );
  }
  if (step.route?.startsWith("/dashboard/")) {
    return (
      <MockDashboardFrame route={step.route}>
        {render(kind, step, ord)}
      </MockDashboardFrame>
    );
  }
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/60 to-zinc-950/60 backdrop-blur-sm overflow-hidden">
      <MockBrowserChrome route={step.route} />
      <div className="p-5 sm:p-6">
        {render(kind, step, ord)}
      </div>
    </div>
  );
}

function render(kind: StepKind, step: DemoStep, ord: number) {
  switch (kind) {
    case "connector":      return <ConnectorMock step={step} />;
    case "scan":           return <ScanMock step={step} />;
    case "risk":           return <RiskMock step={step} ord={ord} />;
    case "recommendation": return <RecommendationMock step={step} />;
    case "approval":       return <ApprovalMock step={step} />;
    case "engineer":       return <EngineerMock step={step} />;
    case "report":         return <ReportMock step={step} />;
    case "audit":          return <AuditMock step={step} />;
    case "incident":       return <IncidentMock step={step} />;
    case "quota":          return <QuotaMock step={step} />;
    case "pipeline":       return <PipelineMock step={step} />;
    case "database":       return <DatabaseMock step={step} />;
    case "desktop":        return <DesktopMock step={step} />;
    case "automation":     return <AutomationMock step={step} />;
    case "generic":        return <GenericMock step={step} ord={ord} />;
  }
}

// ─── Browser chrome (shared) ─────────────────────────────────────────

function MockBrowserChrome({ route }: { route?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05] bg-black/30">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
      </div>
      <div className="flex-1 mx-3 px-3 py-1 rounded-md bg-black/40 text-[11px] font-mono text-zinc-500 truncate">
        visionxixlabs.com{route ?? ""}
      </div>
    </div>
  );
}

// ─── Web dashboard frame ─────────────────────────────────────────────
//
// Stylized HTML "screenshot" of the real /dashboard layout: header strip
// (workspace label · email · sign-out) + 7-group sidebar nav + main
// content area. The sidebar entry whose href matches step.route lights
// up in violet so the user instantly sees WHERE in the app this happens.

interface SidebarItem { label: string; route: string }
interface SidebarGroup { kind: string; label: string; items: ReadonlyArray<SidebarItem> }

const DASHBOARD_NAV: ReadonlyArray<SidebarGroup> = [
  { kind: "start_here",   label: "Start here",   items: [
    { label: "Start Here",        route: "/dashboard/start-here"     },
    { label: "Command Center",    route: "/dashboard/command-center" },
    { label: "Onboarding",        route: "/dashboard/onboarding"     },
  ]},
  { kind: "operations",   label: "Operations",   items: [
    { label: "AWS",               route: "/dashboard/aws"            },
    { label: "Cloud Security",    route: "/dashboard/cloud-security" },
    { label: "Security",          route: "/dashboard/security"       },
    { label: "Observability",     route: "/dashboard/observability"  },
    { label: "Incidents",         route: "/dashboard/incidents"      },
  ]},
  { kind: "automation",   label: "Automation",   items: [
    { label: "Pipelines",         route: "/dashboard/workforce/pipelines" },
    { label: "Approvals",         route: "/dashboard/approvals"     },
    { label: "Automation",        route: "/dashboard/automation"    },
    { label: "Policies",          route: "/dashboard/policies"      },
    { label: "Audit log",         route: "/dashboard/audit"         },
  ]},
  { kind: "workforce",    label: "AI workforce", items: [
    { label: "Workforce",         route: "/dashboard/workforce"     },
    { label: "Agent tools",       route: "/dashboard/agent-tools"   },
    { label: "Agent activity",    route: "/dashboard/agent-activity"},
  ]},
  { kind: "integrations", label: "Integrations", items: [
    { label: "Connectors",        route: "/dashboard/connectors"    },
    { label: "GitHub",            route: "/dashboard/integrations/github" },
    { label: "CI/CD",             route: "/dashboard/cicd"          },
    { label: "Desktop",           route: "/dashboard/desktop"       },
  ]},
  { kind: "business",     label: "Business",     items: [
    { label: "Billing",           route: "/dashboard/billing"       },
    { label: "AI Usage",          route: "/dashboard/ai-usage"      },
    { label: "Settings",          route: "/dashboard/settings/workspace" },
    { label: "Executive Summary", route: "/dashboard/executive-summary"  },
  ]},
];

function MockDashboardFrame({ route, children }: { route?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/60 to-zinc-950/70 backdrop-blur-sm overflow-hidden shadow-[0_20px_60px_-30px_rgba(139,92,246,0.25)]">
      <MockBrowserChrome route={route} />
      {/* Dashboard top header */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2 bg-white/[0.015]">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold text-white">A</span>
          <span className="text-[12px] font-semibold text-white tracking-tight">Axiom</span>
          <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">· ws_acme_prod</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-500 hidden md:inline">alice@acme.com</span>
          <span className="text-[10px] font-mono text-zinc-600 px-2 py-0.5 rounded border border-white/[0.08] bg-white/[0.02]">Sign out</span>
        </div>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden sm:block w-44 shrink-0 border-r border-white/[0.05] bg-black/20 p-2 space-y-2">
          {DASHBOARD_NAV.map((g) => (
            <div key={g.kind}>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.18em] px-2 mb-0.5">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = it.route === route;
                  return (
                    <li key={it.route}>
                      <div className={`text-[10.5px] px-2 py-0.5 rounded ${active ? "bg-violet-500/15 text-violet-200 font-medium" : "text-zinc-400"}`}>
                        {it.label}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>
        {/* Main content */}
        <div className="flex-1 min-w-0 p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Desktop (Tauri) frame ───────────────────────────────────────────
//
// Stylized HTML "screenshot" of the real Axiom Agent desktop window:
// macOS traffic-light dots + title bar showing a "3 awaiting" tray
// badge + left sidebar mirroring desktop/src/components/Sidebar.tsx +
// content area on the right.

const DESKTOP_NAV: ReadonlyArray<{ kind: string; label: string; items: ReadonlyArray<{ label: string; active?: boolean }> }> = [
  { kind: "start_here",   label: "Start here",   items: [
    { label: "Start Here" }, { label: "Dashboard" }, { label: "Docs" },
  ]},
  { kind: "operations",   label: "Operations",   items: [
    { label: "Multi-cloud" }, { label: "Security" }, { label: "Scans" },
  ]},
  { kind: "automation",   label: "Automation",   items: [
    { label: "Activity" }, { label: "Workflows" }, { label: "Approvals" },
    { label: "Orchestration" }, { label: "Remediation" }, { label: "Audit log" },
  ]},
  { kind: "integrations", label: "Integrations", items: [
    { label: "Connectors" },
  ]},
  { kind: "business",     label: "Business",     items: [
    { label: "Billing" }, { label: "Trust" }, { label: "Settings" },
  ]},
];

function MockDesktopFrame({ route: _route, children }: { route?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.10] bg-gradient-to-br from-zinc-900/70 to-zinc-950/80 overflow-hidden shadow-[0_25px_70px_-30px_rgba(139,92,246,0.30)]">
      {/* Tauri window title bar */}
      <div className="relative flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-black/40">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <div className="flex-1 text-center text-[11px] font-mono text-zinc-400 truncate">
          Axiom Agent
        </div>
        {/* Tray-badge hint at the right edge */}
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">⌘ 3 awaiting</span>
      </div>
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden sm:block w-40 shrink-0 border-r border-white/[0.05] bg-black/30 p-2 space-y-2">
          {DESKTOP_NAV.map((g) => (
            <div key={g.kind}>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.18em] px-2 mb-0.5">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((it) => (
                  <li key={it.label}>
                    <div className={`text-[10.5px] px-2 py-0.5 rounded ${it.active ? "bg-violet-500/15 text-violet-200 font-medium" : "text-zinc-400"}`}>
                      {it.label}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
        {/* Main content */}
        <div className="flex-1 min-w-0 p-4 sm:p-5">
          {children}
        </div>
      </div>
      {/* Honest footer that ties back to the real Tauri app */}
      <div className="px-3 py-1.5 border-t border-white/[0.06] bg-black/30 flex items-center justify-between text-[9px] font-mono text-zinc-600">
        <span>Tauri 2 · React 19 · ~95kB gzipped</span>
        <span>menubar · notifications · offline-vote queue · hide-to-tray</span>
      </div>
    </div>
  );
}

// ─── Per-kind mock panels ────────────────────────────────────────────

function ConnectorMock({ step }: { step: DemoStep }) {
  const providers = (step.relatedConnector ?? "AWS").split("|").map((p) => p.trim());
  const details: Record<string, { auth: string; region: string; resources: string }> = {
    AWS:      { auth: "cross-account IAM role · sts:AssumeRole · externalId set",      region: "us-east-1",      resources: "142 resources visible" },
    Azure:    { auth: "service principal · Reader role on subscription",                 region: "eastus",         resources: "—" },
    GCP:      { auth: "service account · roles/iam.securityReviewer",                    region: "us-central1",    resources: "—" },
    GitHub:   { auth: "OAuth app · repo + workflow scopes (read-only at install)",       region: "—",              resources: "12 repos linked" },
    Postgres: { auth: "read-only DB user · pg_monitor + pg_read_server_files",           region: "—",              resources: "142 tables" },
    MySQL:    { auth: "read-only DB user · SELECT on information_schema.*",              region: "—",              resources: "—" },
    MongoDB:  { auth: "read-only DB user · listDatabases + collStats",                    region: "—",              resources: "—" },
    "VS Code":{ auth: "API key (same as desktop) · workspace-scoped",                    region: "—",              resources: "1 repo open" },
    CloudWatch:{auth: "ingest webhook · HMAC-SHA256 signed",                              region: "us-east-1",      resources: "—" },
    Grafana:  { auth: "ingest webhook · HMAC-SHA256 signed",                              region: "—",              resources: "—" },
    Dynatrace:{ auth: "ingest webhook · HMAC-SHA256 signed",                              region: "—",              resources: "—" },
  };
  return (
    <div className="space-y-4">
      <SectionLabel>connectors · {providers[0]} primary</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {providers.slice(0, 4).map((p, i) => {
          const d = details[p] ?? { auth: "—", region: "—", resources: "—" };
          return (
            <div key={p} className={`rounded-lg border ${i === 0 ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-white/[0.06] bg-white/[0.015]"} p-3`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-zinc-100">{p}</span>
                <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${i === 0 ? "bg-emerald-500/20 text-emerald-100" : "bg-zinc-700/40 text-zinc-400"}`}>
                  {i === 0 ? "live" : "ready"}
                </span>
              </div>
              <div className="space-y-1 text-[10px] font-mono text-zinc-500">
                <div>· auth · <span className="text-zinc-300">{d.auth}</span></div>
                <div>· region · <span className="text-zinc-300">{d.region}</span></div>
                <div>· {d.resources}</div>
                <div>· last sync · <span className="text-zinc-300">{i === 0 ? "12s ago" : "—"}</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <CalloutLine label="invariant" body="No long-lived access keys stored. AWS assumes a role you create with an externalId we generate; Azure uses a service principal you control. You can revoke from the provider console without telling us." />
    </div>
  );
}

function ScanMock({ step: _step }: { step: DemoStep }) {
  const findings = [
    { id: "iam-001",   svc: "IAM",  title: "Role 'ci-deploy' has AdministratorAccess",      sev: "critical", cls: "text-rose-200 bg-rose-500/20" },
    { id: "sg-022",    svc: "EC2",  title: "Security group sg-022 allows 0.0.0.0/0 on :22", sev: "critical", cls: "text-rose-200 bg-rose-500/20" },
    { id: "s3-public", svc: "S3",   title: "Bucket 'acme-logs-prod' grants public-read",    sev: "high",     cls: "text-red-200 bg-red-500/15" },
    { id: "kms-rot",   svc: "KMS",  title: "Customer key 'data-at-rest' has rotation off",  sev: "medium",   cls: "text-amber-200 bg-amber-500/15" },
    { id: "rds-noenc", svc: "RDS",  title: "Instance prod-orders-db missing at-rest encryption", sev: "high", cls: "text-red-200 bg-red-500/15" },
    { id: "ec2-untag", svc: "EC2",  title: "12 instances missing CostCenter tag",           sev: "low",      cls: "text-zinc-400 bg-white/5" },
  ];
  return (
    <div className="space-y-4">
      <SectionLabel>scan results · prod-acct-001 · us-east-1</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Resources" value="142" />
        <Stat label="Findings"  value="14" tone="amber" />
        <Stat label="Critical"  value="2"  tone="red" />
        <Stat label="High"      value="4"  tone="amber" />
        <Stat label="Pass"      value="128" tone="emerald" />
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-black/30 overflow-hidden">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-white/[0.02] text-zinc-500">
            <tr>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider w-14">svc</th>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider">finding</th>
              <th className="text-right px-3 py-1.5 uppercase tracking-wider w-20">severity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {findings.map((f) => (
              <tr key={f.id} className="text-zinc-300">
                <td className="px-3 py-2 text-zinc-500">{f.svc}</td>
                <td className="px-3 py-2 truncate">{f.title}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${f.cls}`}>{f.sev}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CalloutLine label="next" body="Findings travel with provenance: rule id, scan id, resource arn. Severity is computed by a pure kernel — same inputs, same severity, always." />
    </div>
  );
}

function RiskMock({ step, ord }: { step: DemoStep; ord: number }) {
  const sev = step.description.toLowerCase().includes("admin") ? "critical" : "high";
  const score = sev === "critical" ? "9.4" : "7.1";
  return (
    <div className="space-y-4">
      <SectionLabel>risk #{ord}</SectionLabel>
      <div className={`rounded-lg border p-4 ${sev === "critical" ? "border-rose-500/25 bg-rose-500/[0.04]" : "border-amber-500/25 bg-amber-500/[0.04]"}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${sev === "critical" ? "bg-rose-500/25 text-rose-100" : "bg-amber-500/25 text-amber-100"}`}>{sev}</span>
          <span className="text-[10px] font-mono text-zinc-500">CVSS-style score · {score} / 10</span>
          <span className="text-[10px] font-mono text-zinc-500">·</span>
          <span className="text-[10px] font-mono text-zinc-500">rule · iam-admin-access</span>
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">{step.title}</h4>
        <p className="text-[12px] text-zinc-400 leading-relaxed">{step.description}</p>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] font-mono text-zinc-500">
          <div>· evidence rows: <span className="text-zinc-300">4</span></div>
          <div>· blast radius: <span className="text-zinc-300">prod account</span></div>
          <div>· compliance: <span className="text-zinc-300">SOC2 CC6.1</span></div>
          <div>· owner team: <span className="text-zinc-300">platform-sec</span></div>
          <div>· exploit reachability: <span className="text-zinc-300">high</span></div>
          <div>· first seen: <span className="text-zinc-300">14 days ago</span></div>
        </div>
      </div>
      <CalloutLine label="kernel" body="Severity is a pure function of (exposure, blast radius, compliance binding, exploit reachability). Same inputs always yield the same severity; the function is unit-tested against a fixture set." />
    </div>
  );
}

function RecommendationMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>recommendation · terraform diff · plan-only</SectionLabel>
      <pre className="rounded-lg bg-black/50 border border-white/[0.06] p-3 text-[11px] font-mono leading-relaxed overflow-x-auto">
{`# proposed by: Security Engineer · 30s ago
# rule: iam-admin-access · CIS 1.16 · SOC2 CC6.1
# blast radius: 1 IAM role · prod account

resource "aws_iam_role_policy" "deploy" {
  role = aws_iam_role.ci_deploy.name
- policy = data.aws_iam_policy_document.admin.json
+ policy = data.aws_iam_policy_document.scoped.json
}

# scoped policy details:
+   actions: ["s3:GetObject", "s3:PutObject", "ecr:*", "ecs:UpdateService"]
+   resources: ["arn:aws:s3:::acme-artifacts/*", "arn:aws:ecr:*:123:*"]
-   actions: ["*"]
-   resources: ["*"]

# rollback plan
+   rollback action: terraform apply -target=aws_iam_role_policy.deploy \\
+                    -var-file=rollback.tfvars
+   verified against digital twin: ✓ (60s ago)`}
      </pre>
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Risk tier"     value="medium" tone="amber" />
        <Stat label="Confidence"    value="92%"    tone="emerald" />
        <Stat label="Rollback"      value="ready"  tone="emerald" />
        <Stat label="Blast radius"  value="1 res"  tone="emerald" />
      </div>
      <CalloutLine label="kernel" body="The diff is generated by a pure kernel that takes the current state + the rule's desired state and emits HCL. The runner refuses to enable Apply until the rollback plan has been validated against the digital twin." />
    </div>
  );
}

function ApprovalMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>two-person approval packet · awaiting review</SectionLabel>
      <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.04] p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] font-mono text-violet-200/90 uppercase tracking-wider">apr_pipe_ck98zxm…</span>
          <span className="text-[9px] font-mono text-amber-200 px-1.5 py-0.5 rounded bg-amber-500/15 uppercase tracking-wider">awaiting</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <ApproverRow name="alice@acme.com" role="security-lead"     state="approved" />
          <ApproverRow name="bob@acme.com"   role="platform-on-call"  state="pending"  />
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/30 p-2 space-y-1 text-[10px] font-mono text-zinc-500">
          <div><span className="text-zinc-400">scope · </span>pipeline:trigger · change-class</div>
          <div><span className="text-zinc-400">runId · </span>cm2pipe_ck98zxm9q · ai_coding</div>
          <div><span className="text-zinc-400">effective rule · </span>two_step_approval · requiredApprovers=2</div>
          <div><span className="text-zinc-400">correlationId · </span>corr_ck98zxa9 (joins audit + webhook + run)</div>
        </div>
        <div className="text-[10px] font-mono text-zinc-500">1 / 2 approved · second vote tips the gate</div>
        <div className="flex gap-2 pt-1">
          <button disabled className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-500/25 cursor-not-allowed">✓ Approve</button>
          <button disabled className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-200 border border-red-500/25 cursor-not-allowed">✗ Reject</button>
        </div>
      </div>
      <CalloutLine label="lock" body="DB-unique constraint on (snapshotId, approverUserId) is the authoritative double-vote lock. Same user voting twice returns already_voted (409); no race between desktop, web, CLI." />
    </div>
  );
}

function ApproverRow({ name, role, state }: { name: string; role: string; state: "approved" | "pending" }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-black/30 px-2.5 py-2">
      <div className="text-[10px] font-mono text-zinc-300 truncate">{name}</div>
      <div className="text-[9px] font-mono text-zinc-500 truncate">{role}</div>
      <span className={`text-[9px] font-mono uppercase tracking-wider mt-1 inline-block px-1.5 py-0.5 rounded ${state === "approved" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{state}</span>
    </div>
  );
}

function EngineerMock({ step }: { step: DemoStep }) {
  const engineers = [
    { name: "Cloud Engineer",      scope: "scan · plan · recommend",     tools: 7, last: "12m ago", state: "active"  },
    { name: "DevOps Engineer",     scope: "ci · build · explain",        tools: 5, last: "2h ago",  state: "active"  },
    { name: "Security Engineer",   scope: "iam · findings · advise",     tools: 6, last: "30m ago", state: "active"  },
    { name: "Database Engineer",   scope: "schema · slow query · index", tools: 4, last: "1d ago",  state: "preview" },
    { name: "Monitoring Engineer", scope: "alerts · correlations",       tools: 4, last: "—",       state: "preview" },
    { name: "Incident Engineer",   scope: "timeline · root cause",       tools: 5, last: "—",       state: "preview" },
  ];
  const focused = (step.relatedAgent ?? "").toLowerCase();
  return (
    <div className="space-y-4">
      <SectionLabel>AI engineer registry · {engineers.length} engineers</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {engineers.map((e) => {
          const hot = focused !== "all" && e.name.toLowerCase().includes(focused.replace(" engineer", ""));
          return (
            <div key={e.name} className={`rounded-lg border ${hot ? "border-violet-500/35 bg-violet-500/[0.05]" : "border-white/[0.06] bg-white/[0.015]"} p-3`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-white">{e.name}</span>
                <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${e.state === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400"}`}>{e.state}</span>
              </div>
              <p className="text-[10px] font-mono text-zinc-500 mb-1">{e.scope}</p>
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
                <span>{e.tools} tools</span>
                <span>last action · {e.last}</span>
              </div>
            </div>
          );
        })}
      </div>
      <CalloutLine label="invariant" body="Each engineer's tool list is a closed set. The runtime gate checks every call against the engineer's scope BEFORE the model can see the tool definition — typos can't widen authority." />
    </div>
  );
}

function ReportMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>executive summary · auto-generated · sharable</SectionLabel>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">Acme Corp · cloud posture</h4>
            <p className="text-[10px] font-mono text-zinc-500">covers · last 30 days · all 3 providers</p>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Spend MTD"     value="$48k"    />
          <Stat label="Optimizations" value="$11k/mo" tone="emerald" />
          <Stat label="Findings"      value="14"      tone="amber" />
          <Stat label="Approved"      value="22"      tone="emerald" />
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/30 p-3 space-y-2">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">top 3 risks</p>
          <ul className="space-y-1 text-[11px]">
            {[
              { sev: "critical", svc: "IAM",   txt: "Role 'ci-deploy' has AdministratorAccess",   pill: "bg-rose-500/20 text-rose-100" },
              { sev: "high",     svc: "S3",    txt: "Bucket 'acme-logs-prod' grants public-read", pill: "bg-red-500/15 text-red-100"   },
              { sev: "high",     svc: "RDS",   txt: "prod-orders-db backup gap · 36h",            pill: "bg-red-500/15 text-red-100"   },
            ].map((r) => (
              <li key={r.txt} className="flex items-center gap-2">
                <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${r.pill}`}>{r.sev}</span>
                <span className="text-zinc-500 w-10 font-mono">{r.svc}</span>
                <span className="text-zinc-300 truncate">{r.txt}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
          <span className="px-2 py-0.5 rounded border border-white/[0.06] bg-white/[0.02]">Export PDF</span>
          <span className="px-2 py-0.5 rounded border border-white/[0.06] bg-white/[0.02]">Export Markdown</span>
          <span className="px-2 py-0.5 rounded border border-white/[0.06] bg-white/[0.02]">Share link</span>
        </div>
      </div>
    </div>
  );
}

function AuditMock({ step: _step }: { step: DemoStep }) {
  const rows = [
    { actor: "alice@acme.com",          action: "approval.grant",            outcome: "success", t: "2m ago",  corr: "corr_ck98zxa9" },
    { actor: "system",                  action: "pipeline.run_completed",    outcome: "success", t: "3m ago",  corr: "corr_ck98zxa9" },
    { actor: "api_key:vxlk_live_a1b…",  action: "engineer.approval_voted",   outcome: "success", t: "5m ago",  corr: "corr_ck98zxa9" },
    { actor: "bob@acme.com",            action: "execution_plan.execute",    outcome: "success", t: "11m ago", corr: "corr_ck98zw3p" },
    { actor: "system",                  action: "workforce.api_key_authenticated", outcome: "success", t: "12m ago", corr: "corr_ck98zw3p" },
    { actor: "system",                  action: "pipeline.run_started",      outcome: "success", t: "12m ago", corr: "corr_ck98zw3p" },
    { actor: "system",                  action: "scan.success",              outcome: "success", t: "23m ago", corr: "corr_ck98zsr1" },
    { actor: "alice@acme.com",          action: "recommendation.generated",  outcome: "success", t: "25m ago", corr: "corr_ck98zsr1" },
  ];
  return (
    <div className="space-y-3">
      <SectionLabel>audit log · last 8 · scoped to your org</SectionLabel>
      <div className="rounded-lg border border-white/[0.06] bg-black/30 overflow-hidden">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-white/[0.02] text-zinc-500">
            <tr>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider">actor</th>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider">action</th>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider hidden sm:table-cell">correlationId</th>
              <th className="text-right px-3 py-1.5 uppercase tracking-wider">when</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((r, i) => (
              <tr key={i} className="text-zinc-300">
                <td className="px-3 py-2 truncate text-zinc-300">{r.actor}</td>
                <td className="px-3 py-2 text-violet-300/90">{r.action}</td>
                <td className="px-3 py-2 text-zinc-500 hidden sm:table-cell truncate">{r.corr}</td>
                <td className="px-3 py-2 text-zinc-500 text-right whitespace-nowrap">{r.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CalloutLine label="schema" body="Each row: { organizationId, actorUserId, actorKind, action (closed-union), outcome, entityRef, correlationId, source, detail }. Detail is JSONB for action-specific context." />
    </div>
  );
}

function IncidentMock({ step: _step }: { step: DemoStep }) {
  const rows: Array<{ t: string; label: string; src: string; dot: string }> = [
    { t: "T-0",    label: "Alert fired · cpu_p95 > 92% for 5m",                src: "cloudwatch",   dot: "bg-red-400"    },
    { t: "T+12s",  label: "Promoted to incident · severity=high",              src: "platform",     dot: "bg-amber-400"  },
    { t: "T+22s",  label: "Recent deploys queried · 3 in last 30m",            src: "github",       dot: "bg-zinc-400"   },
    { t: "T+34s",  label: "Deploy correlation hit · sha 4a2b8c (12m ago)",     src: "incident eng", dot: "bg-violet-400" },
    { t: "T+58s",  label: "Trace surge identified · /orders @ 4.1s p95",       src: "incident eng", dot: "bg-violet-400" },
    { t: "T+1m",   label: "Root-cause hypothesis · missing index on user_id",  src: "incident eng", dot: "bg-violet-400" },
    { t: "T+2m",   label: "Mitigation proposed · awaiting approval",           src: "platform",     dot: "bg-amber-400"  },
  ];
  return (
    <div className="space-y-4">
      <SectionLabel>incident timeline · corr_ck98zxa9</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Severity"       value="high"      tone="amber" />
        <Stat label="Duration"       value="2m 14s"    tone="amber" />
        <Stat label="Hypothesis"     value="83% conf"  tone="emerald" />
      </div>
      <ol className="space-y-2">
        {rows.map((r) => (
          <li key={r.t} className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-2">
            <span className="text-[10px] font-mono text-zinc-500 w-14 tabular-nums">{r.t}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
            <span className="text-[12px] text-zinc-200 flex-1 min-w-0 truncate">{r.label}</span>
            <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">{r.src}</span>
          </li>
        ))}
      </ol>
      <CalloutLine label="stitched" body="Timelines are built from real platform rows — alert ingestion, deploys, configs, traces — joined on correlationId. The hypothesis cites the specific rows it's built from, not a hand-wavy summary." />
    </div>
  );
}

function QuotaMock({ step: _step }: { step: DemoStep }) {
  const dims = [
    { label: "v1 API calls",    used: "7,420",  cap: "10,000",  pct: 74, tone: "amber"   },
    { label: "AI credits",      used: "$214",   cap: "$300",    pct: 71, tone: "amber"   },
    { label: "Scans / month",   used: "48",     cap: "120",     pct: 40, tone: "emerald" },
    { label: "Connected repos", used: "12",     cap: "25",      pct: 48, tone: "emerald" },
  ];
  return (
    <div className="space-y-4">
      <SectionLabel>plan · pro · billing period day 23/30</SectionLabel>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4 space-y-3">
        {dims.map((d) => {
          const barCls =
            d.tone === "amber"   ? "bg-gradient-to-r from-violet-500/70 to-amber-500/70" :
            d.tone === "emerald" ? "bg-gradient-to-r from-violet-500/70 to-emerald-500/70" :
                                   "bg-violet-500/70";
          return (
            <div key={d.label} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-300">{d.label}</span>
                <span className="text-zinc-500">{d.used} / {d.cap} <span className={d.tone === "amber" ? "text-amber-300" : "text-emerald-300"}>· {d.pct}%</span></span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                <div className={`h-full ${barCls}`} style={{ width: `${d.pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-zinc-500">
        <div>· nearLimit fires at 90%</div>
        <div>· billing-DB outage = fail-open</div>
        <div>· reset · 1st of month UTC</div>
      </div>
    </div>
  );
}

function PipelineMock({ step: _step }: { step: DemoStep }) {
  const rows: Array<{ id: string; pid: string; st: string; dot: string; pill: string; stages: string; trig: string; t: string }> = [
    { id: "ck98zxa", pid: "ai_coding",       st: "succeeded",         dot: "bg-emerald-400", pill: "bg-emerald-500/15 text-emerald-300", stages: "6/6", trig: "alice@acme.com", t: "2m" },
    { id: "ck98zwb", pid: "deploy_pipeline", st: "awaiting_approval", dot: "bg-amber-400",   pill: "bg-amber-500/15 text-amber-300",     stages: "4/7", trig: "bob@acme.com",   t: "5m" },
    { id: "ck98zvc", pid: "infra_update",    st: "running",           dot: "bg-cyan-400",    pill: "bg-cyan-500/15 text-cyan-300",       stages: "2/5", trig: "api_key:vxlk…", t: "8m" },
    { id: "ck98zud", pid: "deploy_pipeline", st: "failed",            dot: "bg-red-400",     pill: "bg-red-500/15 text-red-300",         stages: "3/7", trig: "alice@acme.com", t: "27m"},
    { id: "ck98zte", pid: "ai_coding",       st: "succeeded",         dot: "bg-emerald-400", pill: "bg-emerald-500/15 text-emerald-300", stages: "6/6", trig: "api_key:vxlk…", t: "41m"},
  ];
  return (
    <div className="space-y-4">
      <SectionLabel>pipeline runs · scoped to your org</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="In flight"  value="2"  tone="amber" />
        <Stat label="Succeeded"  value="14" tone="emerald" />
        <Stat label="Failed"     value="1"  tone="red" />
        <Stat label="Awaiting"   value="1"  tone="amber" />
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-black/30 overflow-hidden">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-white/[0.02] text-zinc-500">
            <tr>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider">pipeline</th>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider hidden sm:table-cell">triggered by</th>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider">stages</th>
              <th className="text-right px-3 py-1.5 uppercase tracking-wider">status</th>
              <th className="text-right px-3 py-1.5 uppercase tracking-wider">age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((r) => (
              <tr key={r.id} className="text-zinc-300">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dot}`} />
                    <span className="truncate">{r.pid} · {r.id}…</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-zinc-500 hidden sm:table-cell truncate">{r.trig}</td>
                <td className="px-3 py-2 text-zinc-400">{r.stages}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${r.pill}`}>{r.st}</span>
                </td>
                <td className="px-3 py-2 text-zinc-500 text-right">{r.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CalloutLine label="durability" body="Every stage transition is persisted before the next stage runs. A process restart resumes from the last PipelineStageRun row — no in-memory state can silently drop a run." />
    </div>
  );
}

function DatabaseMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>database · prod-orders-db · postgres 15</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Schema"        value="142 tables" />
        <Stat label="Slow query"    value="2.4s avg"   tone="amber" />
        <Stat label="Last backup"   value="36h ago"    tone="red" />
        <Stat label="Connections"   value="48/100"     tone="emerald" />
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3 space-y-2">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">slow query · /orders endpoint</p>
        <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto text-zinc-300">
{`SELECT id, status, total_cents, created_at
FROM orders
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;

-- explain (analyze, buffers):
--   Seq Scan on orders  (cost=0..198432.10 rows=49 width=46)
--     (actual time=2387.40..2392.05 rows=12 loops=1)
--     Filter: (user_id = '...'::uuid)`}
        </pre>
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 space-y-2">
        <p className="text-[10px] font-mono text-emerald-300/90 uppercase tracking-wider">proposed index · DDL preview</p>
        <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto text-emerald-100">
{`CREATE INDEX CONCURRENTLY idx_orders_user_created
  ON orders (user_id, created_at DESC);

-- expected impact: seq scan → index scan
-- expected latency: 2.4s → ~12ms
-- rollback: DROP INDEX CONCURRENTLY idx_orders_user_created;
-- two-person approval required before this runs.`}
        </pre>
      </div>
      <CalloutLine label="invariant" body="Database Engineer has NO write tools by default. Every DDL proposal generates a sample HCL + rollback + projected impact on connected services before the approval packet is minted." />
    </div>
  );
}

function DesktopMock({ step: _step }: { step: DemoStep }) {
  // The outer MockDesktopFrame already provides window chrome + sidebar.
  // The content here is the right-hand panel of the desktop — pairing
  // state + approvals queue snapshot.
  return (
    <div className="space-y-4">
      <SectionLabel>approvals queue · live · polling every 5s</SectionLabel>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <span className="text-[11px] font-mono text-emerald-200">paired · ws_acme_prod · alice@acme.com</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">scopes · pipeline:trigger, pipeline:read</span>
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-black/30 overflow-hidden">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-white/[0.02] text-zinc-500">
            <tr>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider">run</th>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider hidden sm:table-cell">started</th>
              <th className="text-right px-3 py-1.5 uppercase tracking-wider w-40">decide</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {[
              { id: "ck98zxm9q", pid: "ai_coding",       t: "2m ago"  },
              { id: "ck98zw3py", pid: "deploy_pipeline", t: "11m ago" },
              { id: "ck98ztr5h", pid: "infra_update",    t: "1h ago"  },
            ].map((r) => (
              <tr key={r.id} className="text-zinc-300">
                <td className="px-3 py-2 truncate">{r.pid} · {r.id}…</td>
                <td className="px-3 py-2 text-zinc-500 hidden sm:table-cell">{r.t}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-500/25">✓ approve</span>
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-red-500/15 text-red-200 border border-red-500/25">✗ reject</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        <Stat label="Tray badge"     value="3 awaiting" tone="amber" />
        <Stat label="Notifications"  value="enabled"    tone="emerald" />
        <Stat label="Offline queue"  value="0"          tone="emerald" />
        <Stat label="Last vote"      value="14s ago"    tone="emerald" />
      </div>
      <CalloutLine label="native" body="Hide-to-tray on window close · OS notifications on new arrivals · quick-approve from the tray submenu · offline vote queue with 30s back-off retry · window state restored across launches." />
    </div>
  );
}

function AutomationMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>automation · dry-run output · no side effects</SectionLabel>
      <pre className="rounded-lg bg-black/50 border border-emerald-500/20 p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-emerald-200">
{`# script: tag_untagged_ec2.py (curated · lastReviewed: 2026-05-23)
# mode: dry-run (default)
# scope: aws/ec2:Tag (read-only describe + simulated tag)

[ 1/4] describing 142 EC2 instances...                      ✓ 142 found
[ 2/4] filtering untagged...                                ✓ 12 missing CostCenter
[ 3/4] computing tag plan...                                ✓ 12 actions queued
[ 4/4] writing dry-run report...                            ✓ done

DRY-RUN SUMMARY
  · would tag 12 instances with CostCenter=platform
  · would emit 12 audit rows: execution_plan.create
  · would notify slack #platform-ops (12-line summary)
  · estimated cost: $0 (read-only + simulated)
  · risk class: low · blast radius: 12 metadata-only writes

NO live API calls made. To execute, click Promote → Live.`}
      </pre>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Mode"        value="dry-run" tone="emerald" />
        <Stat label="Risk class"  value="low"     tone="emerald" />
        <Stat label="Audit rows"  value="0 / 12 planned" tone="amber" />
      </div>
      <CalloutLine label="default-safe" body="Every automation defaults to dry-run. The plan output enumerates every side-effect. Live mode requires explicit promotion and emits a stage of awaiting_approval if any action is change-class." />
    </div>
  );
}

function GenericMock({ step, ord }: { step: DemoStep; ord: number }) {
  return (
    <div className="space-y-3">
      <SectionLabel>step {ord} · preview</SectionLabel>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4">
        <h4 className="text-sm font-semibold text-white mb-1">{step.title}</h4>
        <p className="text-[12px] text-zinc-400 leading-relaxed">{step.description}</p>
      </div>
    </div>
  );
}

// ─── Small atoms ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.22em]">{children}</p>
  );
}

function CalloutLine({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2">
      <span className="text-[10px] font-mono text-violet-300 uppercase tracking-wider mr-2">{label}</span>
      <span className="text-[11px] text-zinc-300">{body}</span>
    </div>
  );
}

function Stat({
  label, value, tone = "neutral",
}: { label: string; value: string; tone?: "neutral" | "amber" | "red" | "emerald" }) {
  const cls =
    tone === "amber"   ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-100" :
    tone === "red"     ? "border-red-500/30 bg-red-500/[0.06] text-red-100" :
    tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-100" :
                         "border-white/[0.06] bg-white/[0.02] text-zinc-300";
  return (
    <div className={`rounded-md border ${cls} px-2.5 py-1.5`}>
      <div className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-[12px] font-mono mt-0.5 truncate">{value}</div>
    </div>
  );
}
