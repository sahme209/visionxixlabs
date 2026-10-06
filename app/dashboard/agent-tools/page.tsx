/**
 * /dashboard/agent-tools — Agent Tool Access Matrix.
 *
 * For every agent role, declares the read/write/approval permissions
 * across every developer tool. This is the canonical authority surface
 * — the matrix that engineers + operators review and refine.
 *
 * Today the matrix is a curated typed catalog; future phases will let
 * operators edit per-agent capabilities and persist overrides.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import type {
  AgentToolAccess,
  AgentToolPermission,
} from "@/lib/platform/native/developerTools";

export const metadata: Metadata = {
  title: "Agent tool access · Axiom",
  description:
    "Per-agent read / write / approval matrix across every tool. The canonical authority surface for what AGI can do in your workspace.",
};

export const dynamic = "force-dynamic";

// Curated catalog. In a follow-up phase operators edit and persist
// overrides; for now this is the typed source of truth.
const ACCESS_CATALOG: ReadonlyArray<Omit<AgentToolAccess, "organizationId" | "lastUsedAt" | "humanSupervisorUserId">> = [
  {
    agentId: "developer_assistant",
    agentName: "Developer Assistant",
    role: "developer",
    workspaceScope: "this_workspace_only",
    perTool: [
      {
        toolKind: "vscode_extension",
        capabilities: [
          { action: "Read selected code context",  read: "allowed",            write: "blocked",            risk: "low",      requiresDesktopApp: false },
          { action: "Read full repo",              read: "approval_required",  write: "blocked",            risk: "medium",   requiresDesktopApp: false },
          { action: "Suggest code changes",        read: "allowed",            write: "allowed",            risk: "low",      requiresDesktopApp: false },
          { action: "Commit code",                 read: "allowed",            write: "approval_required",  risk: "high",     requiresDesktopApp: false },
          { action: "Push branch",                 read: "allowed",            write: "approval_required",  risk: "high",     requiresDesktopApp: false },
          { action: "Merge pull request",          read: "allowed",            write: "blocked",            risk: "critical", requiresDesktopApp: false },
        ],
      },
    ],
  },
  {
    agentId: "devops_agent",
    agentName: "DevOps Agent",
    role: "devops",
    workspaceScope: "this_workspace_only",
    perTool: [
      {
        toolKind: "pipeline_helper",
        capabilities: [
          { action: "Read GitHub Actions",         read: "allowed",            write: "blocked",            risk: "low",      requiresDesktopApp: false },
          { action: "Analyze failed builds",       read: "allowed",            write: "blocked",            risk: "low",      requiresDesktopApp: false },
          { action: "Trigger non-prod pipeline",   read: "allowed",            write: "approval_required",  risk: "medium",   requiresDesktopApp: false },
          { action: "Trigger prod deployment",     read: "allowed",            write: "approval_required",  risk: "critical", requiresDesktopApp: false },
          { action: "Modify workflow file",        read: "allowed",            write: "approval_required",  risk: "high",     requiresDesktopApp: false },
        ],
      },
    ],
  },
  {
    agentId: "security_agent",
    agentName: "Security Agent",
    role: "security",
    workspaceScope: "this_workspace_only",
    perTool: [
      {
        toolKind: "vscode_extension",
        capabilities: [
          { action: "Scan selected files",         read: "allowed",            write: "blocked",            risk: "low",      requiresDesktopApp: false },
          { action: "Scan repo",                   read: "approval_required",  write: "blocked",            risk: "medium",   requiresDesktopApp: false },
        ],
      },
      {
        toolKind: "cli",
        capabilities: [
          { action: "Rotate secret",               read: "allowed",            write: "approval_required",  risk: "critical", requiresDesktopApp: true  },
          { action: "Modify IAM policy",           read: "allowed",            write: "approval_required",  risk: "critical", requiresDesktopApp: false },
        ],
      },
    ],
  },
  {
    agentId: "cloud_agent",
    agentName: "Cloud Agent",
    role: "cloud",
    workspaceScope: "this_workspace_only",
    perTool: [
      {
        toolKind: "terraform_helper",
        capabilities: [
          { action: "Read inventory",              read: "allowed",            write: "blocked",            risk: "low",      requiresDesktopApp: false },
          { action: "Generate Terraform plan",     read: "allowed",            write: "allowed",            risk: "low",      requiresDesktopApp: false },
          { action: "Apply Terraform",             read: "allowed",            write: "approval_required",  risk: "critical", requiresDesktopApp: false },
          { action: "Delete resource",             read: "allowed",            write: "blocked",            risk: "critical", requiresDesktopApp: false },
        ],
      },
    ],
  },
  {
    agentId: "database_agent",
    agentName: "Database Agent",
    role: "database",
    workspaceScope: "this_workspace_only",
    perTool: [
      {
        toolKind: "cli",
        capabilities: [
          { action: "Read schema",                 read: "allowed",            write: "blocked",            risk: "low",      requiresDesktopApp: false },
          { action: "Run EXPLAIN / slow-query",    read: "allowed",            write: "blocked",            risk: "low",      requiresDesktopApp: false },
          { action: "Suggest index migration",     read: "allowed",            write: "allowed",            risk: "low",      requiresDesktopApp: false },
          { action: "Apply migration",             read: "allowed",            write: "approval_required",  risk: "critical", requiresDesktopApp: false },
          { action: "DROP table / column",         read: "allowed",            write: "blocked",            risk: "critical", requiresDesktopApp: false },
        ],
      },
    ],
  },
];

const TONE: Record<AgentToolPermission, string> = {
  allowed:           "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  approval_required: "text-zinc-300 bg-white/10 border-white/30",
  blocked:           "text-rose-300 bg-rose-500/10 border-rose-500/30",
};

export default function AgentToolsPage() {
  return (
    <div className="relative">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CpuChipIcon className="h-4 w-4 text-emerald-400" />
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Agent tool access matrix</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          What AGI can do <span className="text-gradient">in your workspace.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Per-agent, per-tool, per-action permissions. Read / write / approval-required / blocked. Green is fine; amber requires human approval; rose is blocked at the policy gate.
        </p>
      </div>

      {/* Legend */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono uppercase tracking-wider">
          <span className="inline-flex items-center gap-1.5"><span className={`px-1.5 py-0.5 rounded border ${TONE.allowed}`}>Allowed</span><span className="text-zinc-500">runs without prompt</span></span>
          <span className="inline-flex items-center gap-1.5"><span className={`px-1.5 py-0.5 rounded border ${TONE.approval_required}`}>Approval</span><span className="text-zinc-500">human signs off first</span></span>
          <span className="inline-flex items-center gap-1.5"><span className={`px-1.5 py-0.5 rounded border ${TONE.blocked}`}>Blocked</span><span className="text-zinc-500">never, even with approval</span></span>
        </div>
      </section>

      <div className="space-y-6">
        {ACCESS_CATALOG.map((agent) => (
          <section key={agent.agentId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <header className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <CpuChipIcon className="h-4 w-4 text-emerald-300 shrink-0" />
                <p className="text-[13px] font-semibold text-white truncate">{agent.agentName}</p>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">role · {agent.role}</span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                scope · {agent.workspaceScope.replace(/_/g, " ")}
              </span>
            </header>
            <div className="divide-y divide-white/[0.04]">
              {agent.perTool.map((toolBlock) => (
                <div key={toolBlock.toolKind} className="px-5 py-3">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/80 mb-2">{toolBlock.toolKind.replace(/_/g, " ")}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px]">
                      <thead className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                        <tr>
                          <th className="text-left font-normal py-1.5 pr-3">Action</th>
                          <th className="text-left font-normal py-1.5 pr-3">Read</th>
                          <th className="text-left font-normal py-1.5 pr-3">Write</th>
                          <th className="text-left font-normal py-1.5 pr-3">Risk</th>
                          <th className="text-left font-normal py-1.5">Desktop?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {toolBlock.capabilities.map((cap) => (
                          <tr key={cap.action} className="border-t border-white/[0.04]">
                            <td className="py-2 pr-3 text-zinc-200 align-top">{cap.action}</td>
                            <td className="py-2 pr-3 align-top">
                              <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${TONE[cap.read]}`}>{cap.read.replace(/_/g, " ")}</span>
                            </td>
                            <td className="py-2 pr-3 align-top">
                              <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${TONE[cap.write]}`}>{cap.write.replace(/_/g, " ")}</span>
                            </td>
                            <td className="py-2 pr-3 align-top">
                              <span className={`text-[10px] font-mono uppercase tracking-wider ${
                                cap.risk === "critical" ? "text-rose-300"  :
                                cap.risk === "high"     ? "text-zinc-300" :
                                cap.risk === "medium"   ? "text-cyan-300"  :
                                                          "text-emerald-300"
                              }`}>{cap.risk}</span>
                            </td>
                            <td className="py-2 align-top">
                              {cap.requiresDesktopApp ? (
                                <span className="text-[10px] font-mono text-fuchsia-300">required</span>
                              ) : (
                                <span className="text-[10px] font-mono text-zinc-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Why this matrix matters</p>
        </header>
        <ul className="text-[12.5px] text-emerald-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-emerald-400/80">
          <li>Every agent action passes through this gate before reaching any connector.</li>
          <li>"Blocked" is policy-enforced — even with operator approval, the loop refuses to run.</li>
          <li>"Approval required" actions stage in <Link href="/dashboard/approvals" className="underline text-emerald-200">/dashboard/approvals</Link> with full context.</li>
          <li>Risk band drives the approval policy (1 approver vs 2 approvers vs incident-commander).</li>
          <li>Operator overrides (per-workspace) ship in a follow-up phase.</li>
        </ul>
      </section>

      <section className="mt-6 grid sm:grid-cols-3 gap-3">
        <Link href="/dashboard/developer-tools" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/25 transition-colors">
          <CodeBracketIcon className="h-4 w-4 text-emerald-400 mb-2" />
          <p className="text-sm font-semibold text-white">Developer tools</p>
          <p className="text-[11px] text-zinc-500 mt-1">VS Code, JetBrains, CLI, desktop, repo bridge.</p>
        </Link>
        <Link href="/dashboard/approvals" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/25 transition-colors">
          <ExclamationTriangleIcon className="h-4 w-4 text-emerald-400 mb-2" />
          <p className="text-sm font-semibold text-white">Approvals queue</p>
          <p className="text-[11px] text-zinc-500 mt-1">Where "approval required" actions stage.</p>
        </Link>
        <Link href="/dashboard/audit" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/25 transition-colors">
          <CheckCircleIcon className="h-4 w-4 text-emerald-400 mb-2" />
          <p className="text-sm font-semibold text-white">Audit log</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every gate decision recorded.</p>
        </Link>
      </section>

      <p className="mt-6 text-[10.5px] font-mono text-zinc-500 inline-flex items-center gap-1.5">
        <ArrowRightIcon className="h-3 w-3" />
        Operator override editor + per-action history ship in the next phase.
      </p>
    </div>
  );
}
