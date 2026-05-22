/**
 * /dashboard/developer-tools — index of every engineer-facing integration.
 *
 * Cards for VS Code, JetBrains, CLI, Desktop App, Local Repo Bridge,
 * Pipeline Helper, Terraform Helper, Docker Helper, Kubernetes Helper.
 * Each card surfaces status, purpose, supported OS, connected agents,
 * required permissions, and the right Connect action.
 *
 * This page is the foundation — actual install flows + per-tool pages
 * land in follow-up phases.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  CodeBracketIcon,
  CommandLineIcon,
  ComputerDesktopIcon,
  ServerStackIcon,
  CubeTransparentIcon,
  RocketLaunchIcon,
  CircleStackIcon,
  PuzzlePieceIcon,
  WrenchScrewdriverIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import type {
  DeveloperToolKind,
  ToolStatus,
  SupportedOs,
} from "@/lib/platform/native/developerTools";

export const metadata: Metadata = {
  title: "Developer tools · Axiom",
  description:
    "VS Code, JetBrains, CLI, desktop app, local repo bridge — the engineer-facing integration layer.",
};

export const dynamic = "force-dynamic";

interface ToolCard {
  kind: DeveloperToolKind;
  name: string;
  status: ToolStatus;
  supportedOs: readonly SupportedOs[];
  purpose: string;
  requiredPermissions: readonly string[];
  connectedAgents: readonly string[];
  installRoute?: string;
  docsRoute?: string;
  setupRoute?: string;
  icon: typeof CodeBracketIcon;
  tone: string;
  riskNote: string;
}

const TOOLS: readonly ToolCard[] = [
  {
    kind: "vscode_extension",
    name: "VS Code extension",
    status: "coming_soon",
    supportedOs: ["macos", "windows", "linux"],
    purpose: "AI agent context inside your editor. Selected-code-only by default. Triggers safe checks; PR drafts after approval.",
    requiredPermissions: ["workspace:read (user-selected files)", "workspace:reflect (paths only)"],
    connectedAgents: ["Spec Writer", "Test Coverage Proposer", "Security Agent", "DevOps Agent"],
    setupRoute: "/dashboard/developer-tools/vscode",
    icon: CodeBracketIcon,
    tone: "text-violet-300",
    riskNote: "Never uploads full repos without explicit per-folder approval.",
  },
  {
    kind: "jetbrains_plugin",
    name: "JetBrains plugin",
    status: "coming_soon",
    supportedOs: ["macos", "windows", "linux"],
    purpose: "Same surface as VS Code — IntelliJ / WebStorm / PyCharm / GoLand.",
    requiredPermissions: ["workspace:read (user-selected files)"],
    connectedAgents: ["Spec Writer", "Security Agent", "DevOps Agent"],
    docsRoute: "/docs/jetbrains",
    icon: CodeBracketIcon,
    tone: "text-violet-300",
    riskNote: "Same boundaries as the VS Code extension.",
  },
  {
    kind: "cli",
    name: "Axiom CLI",
    status: "coming_soon",
    supportedOs: ["macos", "windows", "linux"],
    purpose: "Terminal interface. Login, connect repo, ask agents, list approvals — all from the shell.",
    requiredPermissions: ["workspace:read", "agent:invoke (read-only)"],
    connectedAgents: ["All agents the workspace allows"],
    setupRoute: "/dashboard/developer-tools/cli",
    icon: CommandLineIcon,
    tone: "text-cyan-300",
    riskNote: "Writes are approval-gated. Local execution requires the desktop app.",
  },
  {
    kind: "desktop_app",
    name: "Axiom desktop app",
    status: "available",
    supportedOs: ["macos", "windows", "linux"],
    purpose: "Local execution layer — git, docker, kubectl, terraform, local AI models. Approval-gated for risky actions on-device.",
    requiredPermissions: ["local_execute (per-action)", "audit_emit"],
    connectedAgents: ["DevOps Agent", "Cloud Agent", "Database Agent", "Security Agent"],
    installRoute: "/download",
    icon: ComputerDesktopIcon,
    tone: "text-fuchsia-300",
    riskNote: "Every local execution is staged, scoped, time-boxed, and audit-logged.",
  },
  {
    kind: "local_repo_bridge",
    name: "Local Repo Bridge",
    status: "requires_desktop_app",
    supportedOs: ["macos", "windows", "linux"],
    purpose: "Connects an on-disk repo to your workspace via the desktop app. Repo path, remote, default branch.",
    requiredPermissions: ["workspace:read (selected-only)", "git:metadata-read"],
    connectedAgents: ["Spec Writer", "Refactor Sequencer", "Test Coverage Proposer"],
    icon: ServerStackIcon,
    tone: "text-emerald-300",
    riskNote: "File contents only read after per-path approval. No background upload.",
  },
  {
    kind: "pipeline_helper",
    name: "Pipeline Helper",
    status: "requires_admin_approval",
    supportedOs: ["macos", "windows", "linux"],
    purpose: "Reads GitHub Actions / Azure DevOps state, explains failures, drafts fixes.",
    requiredPermissions: ["github:actions:read", "ci:logs:read"],
    connectedAgents: ["DevOps Agent", "GitHub Pipeline Repairer"],
    docsRoute: "/docs/pipeline-helper",
    icon: RocketLaunchIcon,
    tone: "text-cyan-300",
    riskNote: "Triggers + rollbacks require approval. Non-prod first by default.",
  },
  {
    kind: "terraform_helper",
    name: "Terraform Helper",
    status: "available",
    supportedOs: ["macos", "windows", "linux"],
    purpose: "Plan / lint / drift analysis against your Terraform state. Apply requires high-risk approval.",
    requiredPermissions: ["iac:plan:read", "iac:state:read"],
    connectedAgents: ["Cloud Agent"],
    docsRoute: "/docs/terraform",
    icon: CubeTransparentIcon,
    tone: "text-violet-300",
    riskNote: "Apply is high-risk approval-gated. Destroys are blocked by default.",
  },
  {
    kind: "docker_helper",
    name: "Docker Helper",
    status: "requires_desktop_app",
    supportedOs: ["macos", "windows", "linux"],
    purpose: "Read local Docker state — running containers, images, networks — through the desktop app.",
    requiredPermissions: ["docker:daemon:read"],
    connectedAgents: ["DevOps Agent", "Container Detector"],
    icon: PuzzlePieceIcon,
    tone: "text-blue-300",
    riskNote: "Container starts/stops are approval-gated.",
  },
  {
    kind: "kubernetes_helper",
    name: "Kubernetes Helper",
    status: "coming_soon",
    supportedOs: ["macos", "windows", "linux"],
    purpose: "kubectl-style read access. Inventory pods, services, deployments. Apply requires high-risk approval.",
    requiredPermissions: ["k8s:get", "k8s:list", "k8s:watch"],
    connectedAgents: ["DevOps Agent", "Cloud Agent"],
    icon: WrenchScrewdriverIcon,
    tone: "text-blue-300",
    riskNote: "All mutations are approval-gated. Default kubeconfig context only.",
  },
];

const STATUS_DISPLAY: Record<ToolStatus, { label: string; tone: string }> = {
  available:                 { label: "Available",         tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  connected:                 { label: "Connected",         tone: "text-emerald-300 bg-emerald-500/15 border-emerald-500/40" },
  not_connected:             { label: "Not connected",     tone: "text-zinc-300 bg-white/[0.04] border-white/[0.10]" },
  coming_soon:               { label: "Coming soon",       tone: "text-zinc-300 bg-white/[0.04] border-white/[0.10]" },
  requires_desktop_app:      { label: "Requires desktop",  tone: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30" },
  requires_admin_approval:   { label: "Admin approval",    tone: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
  setup_incomplete:          { label: "Setup incomplete",  tone: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
};

export default function DeveloperToolsPage() {
  return (
    <div className="relative">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CodeBracketIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Developer tools</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          The engineer-facing <span className="text-gradient">integration layer.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          VS Code, JetBrains, CLI, desktop app, local repo bridge — all wire to the same workspace. Agents only see what you explicitly approve. Risky actions are approval-gated, audited, and never run autonomously.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const statusD = STATUS_DISPLAY[t.status];
          const primaryRoute = t.setupRoute ?? t.installRoute;
          return (
            <article key={t.kind} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col">
              <header className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`h-4 w-4 ${t.tone} shrink-0`} />
                  <p className="text-[13px] font-semibold text-white truncate">{t.name}</p>
                </div>
                <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px whitespace-nowrap ${statusD.tone}`}>
                  {statusD.label}
                </span>
              </header>

              <p className="text-[11.5px] text-zinc-400 leading-snug mb-3 flex-1">{t.purpose}</p>

              <div className="mb-3 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex flex-wrap gap-1">
                {t.supportedOs.map((os) => (
                  <span key={os} className="rounded-full border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-zinc-300">{os}</span>
                ))}
              </div>

              <div className="mb-3">
                <p className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 mb-1">Connects agents</p>
                <p className="text-[11px] text-zinc-300 leading-snug">{t.connectedAgents.slice(0, 3).join(" · ")}{t.connectedAgents.length > 3 && ` · +${t.connectedAgents.length - 3}`}</p>
              </div>

              <div className="mb-3 rounded-lg border border-white/[0.04] bg-black/30 p-2.5">
                <p className="text-[10px] text-zinc-400 leading-snug">
                  <span className="font-semibold text-zinc-200">Safety:</span> {t.riskNote}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-auto">
                {primaryRoute && (
                  <Link
                    href={primaryRoute}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/30 hover:bg-violet-500/25 transition"
                  >
                    {t.status === "available" ? "Set up" : t.status === "coming_soon" ? "Notify me" : "Configure"}
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                )}
                {t.docsRoute && (
                  <Link href={t.docsRoute} className="text-[11px] text-zinc-400 hover:text-zinc-200 transition">Docs</Link>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* Workflow explainer */}
      <section className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5 mb-8">
        <header className="flex items-center gap-2 mb-3">
          <SparklesIcon className="h-4 w-4 text-violet-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">How web + desktop + IDE talk to each other</p>
        </header>
        <ol className="grid sm:grid-cols-2 gap-2 text-[12px] text-zinc-300">
          {[
            "Browser opens VS Code / IDE auth handshake.",
            "User picks the workspace + the folders to approve.",
            "Extension paires with workspace via short-lived code.",
            "Desktop app handles local execution under per-action approval.",
            "Agents only see what the user explicitly opted in to share.",
            "Risky actions stage in /dashboard/approvals — never auto-applied.",
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-violet-400/40 bg-violet-500/10 text-[10px] font-mono text-violet-200 shrink-0 mt-0.5">{i + 1}</span>
              <span className="leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <Link href="/dashboard/agent-tools" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <CheckCircleIcon className="h-4 w-4 text-violet-400 mb-2" />
          <p className="text-sm font-semibold text-white">Agent tool access matrix</p>
          <p className="text-[11px] text-zinc-500 mt-1">Per-agent read / write / approval rules.</p>
        </Link>
        <Link href="/dashboard/approvals" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <CircleStackIcon className="h-4 w-4 text-violet-400 mb-2" />
          <p className="text-sm font-semibold text-white">Approvals queue</p>
          <p className="text-[11px] text-zinc-500 mt-1">Risky agent actions stage here.</p>
        </Link>
        <Link href="/dashboard/audit" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/25 transition-colors">
          <CommandLineIcon className="h-4 w-4 text-violet-400 mb-2" />
          <p className="text-sm font-semibold text-white">Audit log</p>
          <p className="text-[11px] text-zinc-500 mt-1">Every tool action recorded.</p>
        </Link>
      </section>
    </div>
  );
}
