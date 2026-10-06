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
  description: "Guides for Axiom Agent's governed deployment workflow, desktop installation, security boundaries, and verified integration states.",
};

const QUICK_PATHS = [
  {
    href: "/docs/quickstart-checklist",
    icon: RocketLaunchIcon,
    title: "Quickstart checklist",
    desc: "Seven steps from verified installer to a first non-production workflow.",
    color: "violet",
  },
  {
    href: "/docs/getting-started",
    icon: RocketLaunchIcon,
    title: "Getting started",
    desc: "Download, authenticate the desktop, configure integrations, and complete a workflow.",
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
      { href: "/docs/azure-setup", label: "Azure · Service Principal", available: true },
      { href: "/docs/gcp-setup", label: "GCP · Service Account", available: true },
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
      { href: "/docs/permissions-model", label: "Permissions model", available: true },
      { href: "/docs/audit-logs", label: "Audit logs", available: true },
    ],
  },
  {
    title: "Production guides",
    icon: ShieldCheckIcon,
    items: [
      { href: "/docs/quickstart-checklist", label: "Quickstart checklist · installed application", available: true },
      { href: "/docs/best-practices", label: "Best practices · production-readiness", available: true },
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
        number="01"
        kicker="Axiom documentation"
        title="Guides for the release you can explain."
        summary="Start with the installed Axiom Agent workflow, then use reference material for setup, readiness, security, and recovery. Documentation distinguishes recorded plans, preview work, and verified provider state."
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
              className="surface-glass rounded-2xl p-5 hover:border-white/[0.12] transition-all group"
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

      {/* Topic groups — Huly-style numbered chapters */}
      <div className="space-y-10">
        {TOPIC_GROUPS.map((group, gi) => {
          const Icon = group.icon;
          return (
            <div key={group.title}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-mono tabular-nums text-brand-coral/90">{String(gi + 1).padStart(2, "0")}</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                <Icon className="h-4 w-4 text-zinc-400" />
                <h2 className="text-[11px] font-mono font-semibold text-white uppercase tracking-[0.22em]">{group.title}</h2>
              </div>
              <ul className="surface-glass rounded-xl divide-y divide-white/[0.04] overflow-hidden">
                {group.items.map((item, ii) => (
                  <li key={item.href}>
                    {item.available ? (
                      <Link href={item.href} className="relative flex items-center justify-between px-5 py-3.5 hover:bg-brand-coral/[0.04] transition-colors group overflow-hidden">
                        {/* Coral hairline that appears on the left edge on hover */}
                        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-coral via-fuchsia-400 to-brand-violet opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-mono tabular-nums text-zinc-600 group-hover:text-brand-coral/80 transition-colors">
                            {String(ii + 1).padStart(2, "0")}
                          </span>
                          <span className="text-[13.5px] text-zinc-300 group-hover:text-white transition-colors">{item.label}</span>
                        </div>
                        <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-700 group-hover:text-brand-coral group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ) : (
                      <span className="flex items-center justify-between px-5 py-3.5 cursor-not-allowed">
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
        GitHub release evidence is the first read-only provider workflow. Cloud-provider setup guides explain the intended permission model, but a provider is not treated as connected until a tenant-scoped live validation succeeds. <strong>Azure and GCP remain preview until their inventory and provider paths are implemented and verified.</strong> Terraform and CLI artifacts can be reviewed; local Terraform apply remains disabled by the desktop safety contract.
      </Callout>

      <DocFeedback />
    </>
  );
}
