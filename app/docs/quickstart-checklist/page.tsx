import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircleIcon,
  CloudIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  CommandLineIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { DocHeader, Callout, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Quickstart Checklist — Axiom Agent | VisionXIXLabs",
  description: "The exact 7 steps from signup to your first scan in under 5 minutes. Read-only IAM, validated in seconds, no credentials stored.",
};

interface ChecklistItem {
  num: string;
  title: string;
  body: string;
  estimate: string;
  link?: { href: string; label: string };
}

const STEPS: readonly ChecklistItem[] = [
  {
    num: "01",
    title: "Create your account",
    body: "Sign in with Google or GitHub. No credit card. No verification email round-trip. A workspace is provisioned for you on first login.",
    estimate: "20 sec",
    link: { href: "/auth/signin", label: "Sign in" },
  },
  {
    num: "02",
    title: "Pick a cloud provider",
    body: "Start with the one that has the most spend — usually AWS. You can connect Azure and GCP afterwards. We never store long-lived secrets; every connector uses the provider's native trust model.",
    estimate: "10 sec",
  },
  {
    num: "03",
    title: "Run the CloudFormation one-click connector",
    body: "We give you a CloudFormation template URL. Open it in your AWS console, accept the read-only IAM role, copy the Role ARN back. Total clicks: 4.",
    estimate: "90 sec",
    link: { href: "/docs/aws-setup", label: "AWS setup guide" },
  },
  {
    num: "04",
    title: "Validate the connection",
    body: "Axiom calls STS GetCallerIdentity to prove it can assume the role. Green tick + region count appears in the dashboard. If it fails, the error tells you exactly which IAM permission to add.",
    estimate: "5 sec",
  },
  {
    num: "05",
    title: "Run your first scan",
    body: "Click 'Scan environment'. Cloud Agent inventories ~400 resources across all enabled regions in under a minute. You see findings appear in real time — cost waste, security drift, misconfigurations.",
    estimate: "60 sec",
    link: { href: "/docs/scanning", label: "How scanning works" },
  },
  {
    num: "06",
    title: "Review the findings report",
    body: "Findings are ranked by severity + estimated impact. Each one has a one-click 'Generate fix' button that drafts a Terraform diff. Nothing executes yet — every change requires your explicit approval.",
    estimate: "varies",
    link: { href: "/docs/approval-workflow", label: "Approval workflow" },
  },
  {
    num: "07",
    title: "Approve your first fix (optional)",
    body: "Pick a low-risk finding. Click 'Approve'. Axiom runs the Terraform plan with blast radius limits + verified rollback ready. The full audit trail (who, what, when, sha-256 rationale) is written to your immutable audit log.",
    estimate: "30 sec",
    link: { href: "/docs/execution-plans", label: "Execution plans" },
  },
];

export default function QuickstartChecklistPage() {
  return (
    <>
      <DocHeader
        number="02"
        kicker="Quickstart"
        title="From signup to your first scan in five minutes."
        summary="Seven concrete steps. The longest one (running the AWS connector) takes ninety seconds. Nothing here uses a long-lived secret, and every action is reversible from your own cloud console without telling us first."
      />

      <Callout variant="safe" title="What this checklist guarantees">
        Every step below is <strong>idempotent and read-only by default</strong>. You can run them in order, stop at any point, and nothing in your cloud is modified. The only mutation in the entire flow is when YOU explicitly click "Approve" on a draft fix in step 7 — and even that gets blast-radius-limited execution with a pre-verified rollback.
      </Callout>

      {/* Big checklist — numbered Huly-style */}
      <ol className="relative space-y-3 mb-12">
        {/* Vertical coral hairline running down the left */}
        <span aria-hidden className="absolute left-[26px] top-3 bottom-3 w-px bg-gradient-to-b from-brand-coral/40 via-brand-violet/30 to-transparent" />
        {STEPS.map((step) => (
          <li key={step.num} className="relative rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 pl-16 hover:border-brand-coral/25 hover:bg-brand-coral/[0.02] transition-all">
            <span className="absolute left-4 top-5 w-9 h-9 rounded-full bg-gradient-to-br from-brand-coral/15 to-brand-violet/15 border border-brand-coral/30 flex items-center justify-center text-[11px] font-mono font-semibold text-brand-coral tabular-nums">
              {step.num}
            </span>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-[15px] font-semibold text-white leading-tight">{step.title}</h3>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 whitespace-nowrap mt-1">≈ {step.estimate}</span>
            </div>
            <p className="text-[13.5px] text-zinc-400 leading-relaxed mb-3">{step.body}</p>
            {step.link && (
              <Link
                href={step.link.href}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-coral/90 hover:text-brand-coral transition-colors"
              >
                {step.link.label}
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            )}
          </li>
        ))}
      </ol>

      {/* What you'll have at the end */}
      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6 mb-12">
        <header className="flex items-center gap-2 mb-3">
          <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400">
            After five minutes
          </p>
        </header>
        <ul className="space-y-2 text-[13.5px] text-zinc-300 leading-relaxed">
          <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> A connected, validated read-only AWS account.</li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> A full infrastructure inventory across every enabled region.</li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> A prioritized findings report with cost + security recommendations.</li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> An approval queue with draft Terraform fixes waiting on your sign-off.</li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Zero stored credentials. Zero long-lived secrets. One revocable IAM role.</li>
        </ul>
      </section>

      {/* Quick links to next reads */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500 mb-4">
          Read next
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { href: "/docs/security-model", icon: ShieldCheckIcon, title: "Security model", desc: "What Axiom accesses, what gets stored, what's read-only." },
            { href: "/docs/best-practices", icon: CpuChipIcon, title: "Best practices", desc: "Production-readiness checklist. Tune autonomy, set up alerts." },
            { href: "/docs/scanning", icon: CloudIcon, title: "Scanning deep dive", desc: "How the 12-step cognitive loop reasons about your cloud." },
            { href: "/download", icon: CommandLineIcon, title: "Open product access", desc: "TAURI is delivered as a web application; no supported desktop installer is available." },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 hover:border-brand-coral/25 hover:bg-brand-coral/[0.03] transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-brand-coral/70 group-hover:text-brand-coral transition-colors" />
                  <p className="text-[14px] font-semibold text-white">{card.title}</p>
                </div>
                <p className="text-[12.5px] text-zinc-400 leading-snug">{card.desc}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <DocFeedback />
    </>
  );
}
