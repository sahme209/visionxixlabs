import type { Metadata } from "next";
import Link from "next/link";
import {
  RocketLaunchIcon,
  CloudIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  CpuChipIcon,
  LockClosedIcon,
  QuestionMarkCircleIcon,
  WrenchScrewdriverIcon,
  ArrowRightIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";
import { DocHeader, Callout, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Documentation — Axiom Agent | Vision XIX Labs",
  description: "Self-serve guides for connecting your cloud, running scans, generating Terraform, approving plans, rollback, ReleaseOps, and the Axiom desktop application.",
};

const QUICK_PATHS = [
  {
    href: "/docs/getting-started",
    icon: RocketLaunchIcon,
    title: "Getting started",
    desc: "Sign up, connect AWS, run your first scan — under 5 minutes end-to-end.",
    color: "violet",
  },
  {
    href: "/docs/aws-setup",
    icon: CloudIcon,
    title: "AWS setup",
    desc: "IAM role, External ID, read-only validation, region selection.",
    color: "amber",
  },
  {
    href: "/docs/security-model",
    icon: ShieldCheckIcon,
    title: "Security model",
    desc: "What Axiom accesses, what gets stored, what is read-only, how to revoke.",
    color: "emerald",
  },
  {
    href: "/docs/troubleshooting",
    icon: WrenchScrewdriverIcon,
    title: "Troubleshooting",
    desc: "Common errors and how to fix them — IAM, network, scan, approval, rollback.",
    color: "blue",
  },
];

const COLOR_MAP = {
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
} as const;

const TOPIC_GROUPS = [
  {
    title: "Connect a cloud",
    icon: CloudIcon,
    items: [
      { href: "/docs/aws-setup", label: "AWS · IAM role + External ID", available: true },
      { href: "/docs/azure-setup", label: "Azure · Service Principal", available: false },
      { href: "/docs/gcp-setup", label: "GCP · Service Account", available: false },
    ],
  },
  {
    title: "Operate",
    icon: CpuChipIcon,
    items: [
      { href: "/docs/scanning", label: "Infrastructure scanning", available: true },
      { href: "/docs/approval-workflow", label: "Approval workflow", available: true },
      { href: "/docs/execution-plans", label: "Execution plans", available: true },
      { href: "/docs/terraform-export", label: "Terraform & CLI export", available: true },
      { href: "/docs/rollback", label: "Rollback strategy", available: true },
    ],
  },
  {
    title: "ReleaseOps",
    icon: ShieldCheckIcon,
    items: [
      { href: "/docs/releaseops", label: "ReleaseOps overview", available: true },
      { href: "/docs/releaseops/connectors", label: "CI/CD connectors", available: true },
      { href: "/docs/releaseops/readiness", label: "Readiness scoring", available: true },
    ],
  },
  {
    title: "Desktop",
    icon: CommandLineIcon,
    items: [
      { href: "/docs/desktop-install", label: "Install the desktop app", available: true },
      { href: "/docs/desktop-architecture", label: "Desktop architecture", available: true },
    ],
  },
  {
    title: "Trust & security",
    icon: LockClosedIcon,
    items: [
      { href: "/docs/security-model", label: "Security model", available: true },
      { href: "/docs/permissions-model", label: "Permissions model", available: false },
      { href: "/docs/audit-logs", label: "Audit logs", available: false },
    ],
  },
  {
    title: "Reference",
    icon: QuestionMarkCircleIcon,
    items: [
      { href: "/docs/troubleshooting", label: "Troubleshooting", available: true },
      { href: "/docs/faq", label: "FAQ", available: true },
      { href: "/docs/glossary", label: "Glossary", available: true },
    ],
  },
];

export default function DocsIndexPage() {
  return (
    <>
      <DocHeader
        kicker="Axiom documentation"
        title="Self-serve guides for the entire platform."
        summary="Every flow Axiom supports — cloud onboarding, scanning, approval, execution, rollback, ReleaseOps, desktop — is documented here. No tickets required to understand how it works."
      />

      <Callout variant="safe" title="What this documentation covers">
        Every product flow answers the same questions: <strong>what is happening, why is it needed, what access is required, is it safe, what does Axiom store, can access be revoked, what happens next, what if it fails, how do I fix it.</strong> Look for these answers in every guide.
      </Callout>

      {/* Quick paths */}
      <div className="grid sm:grid-cols-2 gap-3 mb-12">
        {QUICK_PATHS.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.href}
              href={p.href}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${COLOR_MAP[p.color as keyof typeof COLOR_MAP]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRightIcon className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all mt-2.5" />
              </div>
              <p className="text-base font-bold text-white mb-1">{p.title}</p>
              <p className="text-sm text-zinc-400 leading-relaxed">{p.desc}</p>
            </Link>
          );
        })}
      </div>

      {/* Topic groups */}
      <div className="space-y-8">
        {TOPIC_GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">{group.title}</h2>
              </div>
              <ul className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                {group.items.map((item) => (
                  <li key={item.href}>
                    {item.available ? (
                      <Link href={item.href} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors group">
                        <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{item.label}</span>
                        <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ) : (
                      <span className="flex items-center justify-between px-4 py-3 cursor-not-allowed">
                        <span className="text-sm text-zinc-600">{item.label}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-px">
                          Doc coming
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Honest demo-state note */}
      <Callout variant="info" title="Where the platform is right now">
        AWS is the first fully-implemented provider — IAM-role onboarding, scan, reasoning, Terraform export, approval, and rollback are real. <strong>Azure and GCP have working connectors but the reasoning + execution layers are rolling out in Q2 and Q3 2026.</strong> ReleaseOps is in operational preview. The desktop app is in macOS preview. Documentation reflects each surface honestly — what works, what&apos;s coming, and when.
      </Callout>

      <DocFeedback />
    </>
  );
}
