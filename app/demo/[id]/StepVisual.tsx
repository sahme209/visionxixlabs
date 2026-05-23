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

// ─── Per-kind mock panels ────────────────────────────────────────────

function ConnectorMock({ step }: { step: DemoStep }) {
  const providers = (step.relatedConnector ?? "AWS").split("|");
  return (
    <div className="space-y-4">
      <SectionLabel>connectors</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {providers.slice(0, 3).map((p, i) => (
          <div key={p} className={`rounded-lg border ${i === 0 ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-white/[0.06] bg-white/[0.015]"} p-3`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider">{p.trim()}</span>
              {i === 0 ? (
                <span className="text-[9px] font-mono text-emerald-300 uppercase tracking-wider">live</span>
              ) : (
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">ready</span>
              )}
            </div>
            <div className="space-y-1 text-[10px] font-mono text-zinc-500">
              <div>· cross-account role: {i === 0 ? "assumed ✓" : "pending"}</div>
              <div>· scopes: read-only</div>
              <div>· region: us-east-1</div>
            </div>
          </div>
        ))}
      </div>
      <CalloutLine label="next" body="Connector flips from preview → connected. Inventory scan starts read-only." />
    </div>
  );
}

function ScanMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>scan results</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Resources" value="142" />
        <Stat label="Findings"  value="14" tone="amber" />
        <Stat label="Critical"  value="4"  tone="red" />
        <Stat label="Pass"      value="128" tone="emerald" />
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-black/30 divide-y divide-white/[0.04]">
        {[
          { id: "iam-001",    title: "IAM role with AdministratorAccess",   sev: "high",     cls: "text-red-300 bg-red-500/15" },
          { id: "s3-public",  title: "S3 bucket allows public-read",        sev: "high",     cls: "text-red-300 bg-red-500/15" },
          { id: "ec2-untag",  title: "12 EC2 instances missing CostCenter", sev: "low",      cls: "text-zinc-400 bg-white/5" },
          { id: "sg-022",     title: "Security group open to 0.0.0.0/0",    sev: "critical", cls: "text-rose-300 bg-rose-500/20" },
        ].map((f) => (
          <div key={f.id} className="flex items-center justify-between px-3 py-2">
            <div className="text-[11px] font-mono text-zinc-300 truncate">{f.title}</div>
            <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${f.cls}`}>{f.sev}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskMock({ step, ord }: { step: DemoStep; ord: number }) {
  const sev = step.description.toLowerCase().includes("admin") ? "critical" : "high";
  return (
    <div className="space-y-4">
      <SectionLabel>risk #{ord}</SectionLabel>
      <div className={`rounded-lg border p-4 ${sev === "critical" ? "border-rose-500/30 bg-rose-500/[0.05]" : "border-amber-500/30 bg-amber-500/[0.05]"}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${sev === "critical" ? "bg-rose-500/30 text-rose-100" : "bg-amber-500/30 text-amber-100"}`}>{sev}</span>
          <span className="text-[10px] font-mono text-zinc-500">scored 9.1 / 10</span>
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">{step.title}</h4>
        <p className="text-[12px] text-zinc-400 leading-relaxed">{step.description}</p>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] font-mono text-zinc-500">
          <div>· evidence rows: 4</div>
          <div>· blast radius: prod-network</div>
          <div>· compliance: SOC2 CC6.1</div>
          <div>· owner: platform team</div>
        </div>
      </div>
    </div>
  );
}

function RecommendationMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>recommendation · terraform diff</SectionLabel>
      <pre className="rounded-lg bg-black/50 border border-white/[0.06] p-3 text-[11px] font-mono leading-relaxed overflow-x-auto">
{`resource "aws_iam_role_policy" "deploy" {
  role = aws_iam_role.ci_deploy.name
- policy = data.aws_iam_policy_document.admin.json
+ policy = data.aws_iam_policy_document.scoped.json
}

# rollback ready · 1 atomic change · blast radius ≤ 1 resource`}
      </pre>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Risk tier"  value="medium" tone="amber" />
        <Stat label="Confidence" value="92%" tone="emerald" />
        <Stat label="Rollback"   value="ready" tone="emerald" />
      </div>
    </div>
  );
}

function ApprovalMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>two-person approval packet</SectionLabel>
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/[0.05] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-violet-200 uppercase tracking-wider">apr_pipe_ck98zxm…</span>
          <span className="text-[9px] font-mono text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/15 uppercase tracking-wider">awaiting</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <ApproverRow name="alice@acme.com"    role="security-lead"   state="approved" />
          <ApproverRow name="bob@acme.com"      role="platform-on-call" state="pending"  />
        </div>
        <div className="text-[10px] font-mono text-zinc-500">1/2 approved · second vote tips the gate</div>
        <div className="flex gap-2 pt-1">
          <button disabled className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-not-allowed">✓ Approve</button>
          <button disabled className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 cursor-not-allowed">✗ Reject</button>
        </div>
      </div>
      <CalloutLine label="safety" body="Platform NEVER applies a change without two distinct approver votes for change-class actions." />
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
    { name: "Cloud Engineer",      scope: "scan · plan · recommend",  state: "active" },
    { name: "DevOps Engineer",     scope: "ci · build · explain",     state: "active" },
    { name: "Security Engineer",   scope: "iam · findings · advise",  state: "active" },
    { name: "Database Engineer",   scope: "schema · slow query",      state: "preview" },
    { name: "Monitoring Engineer", scope: "alerts · correlations",    state: "preview" },
    { name: "Incident Engineer",   scope: "timeline · root cause",    state: "preview" },
  ];
  const focused = (step.relatedAgent ?? "").toLowerCase();
  return (
    <div className="space-y-4">
      <SectionLabel>AI engineer registry</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {engineers.map((e) => {
          const hot = focused !== "all" && e.name.toLowerCase().includes(focused.replace(" engineer", ""));
          return (
            <div key={e.name} className={`rounded-lg border ${hot ? "border-violet-500/40 bg-violet-500/[0.06]" : "border-white/[0.06] bg-white/[0.015]"} p-3`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-white">{e.name}</span>
                <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${e.state === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400"}`}>{e.state}</span>
              </div>
              <p className="text-[10px] font-mono text-zinc-500">{e.scope}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>executive summary · preview</SectionLabel>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Acme Corp · cloud posture</h4>
          <span className="text-[10px] font-mono text-zinc-500">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Spend MTD"  value="$48k" />
          <Stat label="Findings"   value="14"  tone="amber" />
          <Stat label="Approved"   value="22"  tone="emerald" />
          <Stat label="Pending"    value="3"   tone="amber" />
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Top 3 risks: <span className="text-zinc-200">public S3 bucket</span> ·{" "}
          <span className="text-zinc-200">over-privileged IAM role</span> ·{" "}
          <span className="text-zinc-200">backup gap on prod-db</span>. Remediation plans ready,
          awaiting human approval.
        </p>
      </div>
    </div>
  );
}

function AuditMock({ step: _step }: { step: DemoStep }) {
  const rows = [
    { actor: "alice@acme.com",       action: "approval.grant",        outcome: "success", t: "2m ago"  },
    { actor: "system",               action: "pipeline.run_completed", outcome: "success", t: "3m ago"  },
    { actor: "api_key:vxlk_live_…",  action: "engineer.approval_voted", outcome: "success", t: "5m ago"  },
    { actor: "bob@acme.com",         action: "execution_plan.execute", outcome: "success", t: "11m ago" },
    { actor: "system",               action: "scan.success",          outcome: "success", t: "23m ago" },
  ];
  return (
    <div className="space-y-3">
      <SectionLabel>audit log · last 5</SectionLabel>
      <div className="rounded-lg border border-white/[0.06] bg-black/30 overflow-hidden">
        <table className="w-full text-[11px] font-mono">
          <thead className="bg-white/[0.02] text-zinc-500">
            <tr>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider">actor</th>
              <th className="text-left px-3 py-1.5 uppercase tracking-wider">action</th>
              <th className="text-right px-3 py-1.5 uppercase tracking-wider">when</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((r, i) => (
              <tr key={i} className="text-zinc-300">
                <td className="px-3 py-2 truncate">{r.actor}</td>
                <td className="px-3 py-2 text-violet-300">{r.action}</td>
                <td className="px-3 py-2 text-zinc-500 text-right whitespace-nowrap">{r.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncidentMock({ step: _step }: { step: DemoStep }) {
  // Static class names so Tailwind's purge keeps them — never use
  // template-literal class concatenation here, the safelist would drop it.
  const rows = [
    { t: "T-0",   label: "Alert fired",                              dot: "bg-red-400"    },
    { t: "T+12s", label: "Promoted to incident",                     dot: "bg-amber-400"  },
    { t: "T+34s", label: "Deploy correlation hit",                   dot: "bg-violet-400" },
    { t: "T+1m",  label: "Root-cause hypothesis",                    dot: "bg-violet-400" },
    { t: "T+2m",  label: "Mitigation proposed · awaiting approval", dot: "bg-amber-400"  },
  ];
  return (
    <div className="space-y-4">
      <SectionLabel>incident timeline</SectionLabel>
      <ol className="space-y-2">
        {rows.map((r) => (
          <li key={r.t} className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-2">
            <span className="text-[10px] font-mono text-zinc-500 w-12 tabular-nums">{r.t}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
            <span className="text-[12px] text-zinc-200">{r.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuotaMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>monthly quota · v1 API calls</SectionLabel>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-mono text-zinc-300">7,420 / 10,000 calls</span>
          <span className="text-[10px] font-mono text-amber-300">74% used</span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500" style={{ width: "74%" }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-zinc-500">
          <div>· tier: pro</div>
          <div>· nearLimit: 90% trigger</div>
          <div>· reset: 1st of month</div>
        </div>
      </div>
    </div>
  );
}

function PipelineMock({ step: _step }: { step: DemoStep }) {
  // Static class strings per status — Tailwind purges anything it can't
  // see as a literal, so don't build these with template literals.
  const rows: Array<{ id: string; pid: string; st: string; dot: string; pill: string }> = [
    { id: "ck98zxa", pid: "ai_coding",       st: "succeeded",         dot: "bg-emerald-400", pill: "bg-emerald-500/15 text-emerald-300" },
    { id: "ck98zwb", pid: "deploy_pipeline", st: "awaiting_approval", dot: "bg-amber-400",   pill: "bg-amber-500/15 text-amber-300"     },
    { id: "ck98zvc", pid: "infra_update",    st: "running",           dot: "bg-cyan-400",    pill: "bg-cyan-500/15 text-cyan-300"       },
    { id: "ck98zud", pid: "deploy_pipeline", st: "failed",            dot: "bg-red-400",     pill: "bg-red-500/15 text-red-300"         },
    { id: "ck98zte", pid: "ai_coding",       st: "succeeded",         dot: "bg-emerald-400", pill: "bg-emerald-500/15 text-emerald-300" },
  ];
  return (
    <div className="space-y-4">
      <SectionLabel>pipeline runs · last 5</SectionLabel>
      <ul className="rounded-lg border border-white/[0.06] bg-black/30 divide-y divide-white/[0.04]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dot}`} />
              <span className="text-[11px] font-mono text-zinc-300 truncate">{r.pid} · {r.id}…</span>
            </div>
            <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${r.pill}`}>{r.st}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DatabaseMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>database · prod-orders-db</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Schema"     value="142 tables" />
        <Stat label="Slow query" value="2.4s avg"  tone="amber" />
        <Stat label="Backup"     value="36h ago"   tone="red" />
      </div>
      <pre className="rounded-lg bg-black/50 border border-white/[0.06] p-3 text-[11px] font-mono leading-relaxed overflow-x-auto">
{`-- Proposed index (sample DDL)
CREATE INDEX CONCURRENTLY idx_orders_user_created
  ON orders (user_id, created_at DESC);
-- Two-person approval required before any DDL runs.`}
      </pre>
    </div>
  );
}

function DesktopMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>axiom agent desktop</SectionLabel>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          <span className="text-[11px] font-mono text-emerald-300">paired</span>
          <span className="text-[10px] font-mono text-zinc-500">· macOS 14.4 · v0.1.0</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <Stat label="Workspace"  value="ws_acme_prod" />
          <Stat label="Scopes"     value="pipeline:trigger" />
          <Stat label="Last sync"  value="14s ago" tone="emerald" />
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Native menubar badge ({"3 awaiting"}) · OS notifications on new approvals ·
          quick-approve from the tray submenu · offline vote queue with auto-retry.
        </p>
      </div>
    </div>
  );
}

function AutomationMock({ step: _step }: { step: DemoStep }) {
  return (
    <div className="space-y-4">
      <SectionLabel>automation · dry-run output</SectionLabel>
      <pre className="rounded-lg bg-black/50 border border-emerald-500/20 p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-emerald-200">
{`[dry-run] would tag 12 EC2 instances with cost-center=platform
[dry-run] would notify slack #platform with 12-line summary
[dry-run] would write audit row: execution_plan.create
[dry-run] no live API calls made · review + approve to execute`}
      </pre>
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
