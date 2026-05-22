/**
 * /dashboard/developer-tools/cli — Axiom CLI setup.
 *
 * Surfaces the install command, login flow, the most common commands,
 * and the safety contract. The CLI binary ships in a follow-up phase;
 * this page is the install/onboarding surface clients land on.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  CommandLineIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
  CheckCircleIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "Axiom CLI · Axiom",
  description:
    "Terminal interface to VisionXIXLabs. Login, connect repo, ask agents, list approvals — all from the shell.",
};

export const dynamic = "force-dynamic";

const INSTALL_VARIANTS: ReadonlyArray<{ label: string; command: string }> = [
  { label: "macOS · Homebrew",            command: "brew install visionxixlabs/tap/axiom" },
  { label: "Linux · curl",                command: "curl -fsSL https://visionxixlabs.com/install.sh | sh" },
  { label: "Windows · winget",            command: "winget install VisionXIXLabs.AxiomCLI" },
  { label: "Any · npm",                   command: "npm i -g @visionxixlabs/cli" },
];

const COMMANDS: ReadonlyArray<{ cmd: string; explainer: string }> = [
  { cmd: "axiom login",                         explainer: "Opens browser, signs you in, exchanges a short-lived pairing code." },
  { cmd: "axiom connect repo",                  explainer: "Pairs the local repo at $PWD with this workspace (selected-folder-only)." },
  { cmd: "axiom status",                        explainer: "Shows your workspace, connected tools, and recent agent activity." },
  { cmd: 'axiom agent ask devops "why is my pipeline failing?"', explainer: "Routes the question to the DevOps Agent with audit logging." },
  { cmd: "axiom scan repo --dry-run",           explainer: "Runs the security scanner against the connected repo without writing anything." },
  { cmd: "axiom pipeline status",               explainer: "GitHub Actions / Azure DevOps state for the current branch." },
  { cmd: "axiom approvals list",                explainer: "Shows risky actions waiting for human approval." },
  { cmd: "axiom desktop status",                explainer: "Reports desktop-app pairing + capability list (requires the desktop app installed)." },
];

export default function CliPage() {
  return (
    <div className="relative">
      <div className="mb-6">
        <Link href="/dashboard/developer-tools" className="text-[11px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to developer tools
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CommandLineIcon className="h-4 w-4 text-cyan-400" />
          <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest">Axiom CLI</p>
          <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">Coming soon</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          The terminal interface for <span className="text-gradient">your AI engineering team.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Login once, then ask agents, scan repos, check approvals, and trigger safe actions — all without leaving the shell. Built for engineers who live in the terminal.
        </p>
      </div>

      {/* Install variants */}
      <section className="mb-8">
        <h2 className="text-[13px] font-semibold text-zinc-200 mb-3">Install</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {INSTALL_VARIANTS.map((v) => (
            <article key={v.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500 mb-2">{v.label}</p>
              <pre className="rounded-lg border border-white/[0.06] bg-black/40 p-2.5 text-[11.5px] font-mono text-emerald-200 overflow-x-auto">
{v.command}
              </pre>
            </article>
          ))}
        </div>
        <p className="text-[10.5px] font-mono text-zinc-500 mt-3">
          Install scripts publish at GA. Until then, the CLI is on the roadmap as <span className="text-zinc-300">coming soon</span>.
        </p>
      </section>

      {/* Common commands */}
      <section className="mb-8">
        <h2 className="text-[13px] font-semibold text-zinc-200 mb-3">Commands you'll use</h2>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
          {COMMANDS.map((c) => (
            <div key={c.cmd} className="p-3 md:p-4">
              <pre className="text-[12px] font-mono text-cyan-200 overflow-x-auto">$ {c.cmd}</pre>
              <p className="text-[11.5px] text-zinc-400 mt-1 leading-snug">{c.explainer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Safety contract */}
      <section className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">CLI safety contract</p>
        </header>
        <ul className="text-[12.5px] text-emerald-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-emerald-400/80">
          <li>Login uses OAuth — your password never touches the CLI.</li>
          <li>API tokens are scoped per workspace + per host. Revoke any time from <Link href="/dashboard/developer-tools" className="underline text-emerald-200">/developer-tools</Link>.</li>
          <li>Writes (commits, deploys, scans-with-changes) always require dashboard approval — the CLI surfaces the link.</li>
          <li>Local execution (kubectl apply, terraform apply, file mutation) is routed through the desktop app for on-device approval.</li>
          <li>Every CLI invocation writes a row to your workspace audit log.</li>
        </ul>
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <Link href="/dashboard/developer-tools/vscode" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-cyan-500/25 transition-colors">
          <CodeBracketIcon className="h-4 w-4 text-cyan-400 mb-2" />
          <p className="text-sm font-semibold text-white">VS Code extension</p>
          <p className="text-[11px] text-zinc-500 mt-1">Same surface, inside the editor.</p>
        </Link>
        <Link href="/download" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-cyan-500/25 transition-colors">
          <ComputerDesktopIcon className="h-4 w-4 text-cyan-400 mb-2" />
          <p className="text-sm font-semibold text-white">Desktop app</p>
          <p className="text-[11px] text-zinc-500 mt-1">Local execution under per-action approval.</p>
        </Link>
        <Link href="/dashboard/agent-tools" className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-cyan-500/25 transition-colors">
          <CheckCircleIcon className="h-4 w-4 text-cyan-400 mb-2" />
          <p className="text-sm font-semibold text-white">Agent tool access</p>
          <p className="text-[11px] text-zinc-500 mt-1">Per-agent read/write/approval matrix.</p>
        </Link>
      </section>
    </div>
  );
}
