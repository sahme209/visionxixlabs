/**
 * /dashboard/developer-tools/vscode — VS Code extension setup wizard.
 *
 * Walks the user through installing the extension and pairing it to
 * this workspace. The extension itself ships in a follow-up phase;
 * this page is the setup surface clients land on from the developer-
 * tools index and from "Connect VS Code" CTAs across the product.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  CodeBracketIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ShieldCheckIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "VS Code extension · Axiom",
  description:
    "Connect VS Code to your VisionXIXLabs workspace. Selected-code-only by default. Approval-gated, audit-logged.",
};

export const dynamic = "force-dynamic";

const STEPS: ReadonlyArray<{ n: number; title: string; detail: string }> = [
  { n: 1, title: "Install the extension",       detail: "Once published, install from the VS Code Marketplace or via the .vsix bundle linked here." },
  { n: 2, title: "Authenticate with VisionXIXLabs", detail: "The extension opens your browser, signs you in, and exchanges a short-lived pairing code with the workspace." },
  { n: 3, title: "Pick your workspace",          detail: "If you belong to multiple workspaces, choose which one this VS Code window is bound to." },
  { n: 4, title: "Approve folder scope",         detail: "Select which folders the extension may read. Default: selected-files-only. Workspace-folder and full-repo require explicit per-folder approval." },
  { n: 5, title: "Review agent capabilities",    detail: "Confirm which agents may see selected code, draft changes, or open PR drafts. Anything risky stays in the approval queue." },
  { n: 6, title: "Test the connection",          detail: "Run the built-in “Hello agent” command. The extension prints back a confirmation with the workspace label." },
];

export default function VsCodePage() {
  return (
    <div className="relative">
      <div className="mb-6">
        <Link href="/dashboard/developer-tools" className="text-[11px] text-zinc-300 hover:text-white inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to developer tools
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CodeBracketIcon className="h-4 w-4 text-zinc-500" />
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">VS Code extension</p>
          <span className="text-[9px] font-semibold text-zinc-300 bg-white/10 border border-white/30 rounded-full px-2 py-0.5 uppercase tracking-wider">Coming soon</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Bring AGI into the editor — <span className="text-gradient">safely.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Agent context inside VS Code, scoped to the folders you approve. Never uploads full repos. Triggers safe checks; PR drafts always come back to you for review before they touch the remote.
        </p>
      </div>

      {/* Setup wizard */}
      <section className="mb-8 rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.02] p-6">
        <header className="mb-4">
          <p className="text-[10px] font-semibold text-violet-300 uppercase tracking-widest">Setup wizard · 6 steps</p>
          <h2 className="text-lg font-bold text-white mt-1">Get your IDE connected in under 90 seconds.</h2>
        </header>
        <ol className="space-y-2">
          {STEPS.map((s) => (
            <li key={s.n} className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-violet-400/40 bg-violet-500/10 text-[11px] font-mono text-white shrink-0 mt-0.5">{s.n}</span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-white">{s.title}</p>
                <p className="text-[11.5px] text-zinc-400 mt-0.5 leading-snug">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What you can do with it */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        <CapabilityCard
          tone="text-violet-300"
          title="Read context only when asked"
          detail="No background upload. The extension reads files you explicitly select. Whole-folder scans require per-folder approval."
        />
        <CapabilityCard
          tone="text-violet-300"
          title="Agent suggestions inline"
          detail="Spec writer, test coverage proposer, refactor sequencer, security scanner — all available with one keystroke."
        />
        <CapabilityCard
          tone="text-violet-300"
          title="Pipeline status from the editor"
          detail="See GitHub Actions / Azure DevOps state for the current branch. Failed-build explainer one click away."
        />
        <CapabilityCard
          tone="text-violet-300"
          title="Approval-gated mutations"
          detail="PR drafts, commits, and pushes only happen after you click Approve in the dashboard. No silent writes."
        />
      </section>

      {/* Safety contract */}
      <section className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Extension safety contract</p>
        </header>
        <ul className="text-[12.5px] text-emerald-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-emerald-400/80">
          <li>Never uploads files beyond what you explicitly select.</li>
          <li>Folder-scope and full-repo access require per-folder approval, captured in the workspace audit log.</li>
          <li>Selected context is redacted before any LLM call (secrets, tokens, sensitive identifiers).</li>
          <li>Commit / push / merge happen only after dashboard approval — never autonomously.</li>
          <li>Workspace policies (e.g. "no extension on tier-1 services") override per-user settings.</li>
          <li>Revoke access at any time from /dashboard/developer-tools — sessions terminate within 60 seconds.</li>
        </ul>
      </section>

      {/* Notify CTA */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ArrowDownTrayIcon className="h-5 w-5 text-violet-300" />
          <div>
            <p className="text-[13px] font-semibold text-white">Get notified at launch</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">We'll email you when the marketplace listing goes live.</p>
          </div>
        </div>
        <Link
          href="/contact?ref=vscode-extension"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-white/[0.12] hover:bg-violet-500/25 transition"
        >
          <ClipboardDocumentIcon className="h-3.5 w-3.5" />
          Notify me
        </Link>
      </section>

      <p className="mt-6 text-[10.5px] font-mono text-zinc-500 inline-flex items-center gap-1.5">
        <CommandLineIcon className="h-3 w-3" />
        Prefer the terminal? The CLI ships first — see <Link href="/dashboard/developer-tools/cli" className="text-zinc-300 hover:text-white underline">CLI install</Link>.
      </p>
    </div>
  );
}

function CapabilityCard({ tone, title, detail }: { tone: string; title: string; detail: string }) {
  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <CheckCircleIcon className={`h-4 w-4 ${tone} mb-2`} />
      <p className="text-[13px] font-semibold text-white">{title}</p>
      <p className="text-[11.5px] text-zinc-400 mt-1 leading-snug">{detail}</p>
    </article>
  );
}
