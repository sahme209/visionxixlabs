"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  CloudIcon,
  CommandLineIcon,
  CpuChipIcon,
  DocumentTextIcon,
  LockClosedIcon,
  PuzzlePieceIcon,
  QuestionMarkCircleIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  MapIcon,
} from "@heroicons/react/24/outline";

interface DocLink {
  href: string;
  label: string;
  icon?: typeof BookOpenIcon;
  status?: "coming-soon";
}

interface DocSection {
  title: string;
  items: DocLink[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    title: "Start here",
    items: [
      { href: "/docs", label: "Overview", icon: BookOpenIcon },
      { href: "/docs/getting-started", label: "Getting started", icon: RocketLaunchIcon },
      { href: "/docs/architecture", label: "Architecture overview", icon: MapIcon, status: "coming-soon" },
    ],
  },
  {
    title: "Connect a cloud",
    items: [
      { href: "/docs/aws-setup", label: "AWS setup", icon: CloudIcon },
      { href: "/docs/azure-setup", label: "Azure setup", icon: CloudIcon, status: "coming-soon" },
      { href: "/docs/gcp-setup", label: "GCP setup", icon: CloudIcon, status: "coming-soon" },
    ],
  },
  {
    title: "Operate",
    items: [
      { href: "/docs/scanning", label: "Infrastructure scanning", icon: CpuChipIcon },
      { href: "/docs/approval-workflow", label: "Approval workflow", icon: LockClosedIcon },
      { href: "/docs/execution-plans", label: "Execution plans", icon: PuzzlePieceIcon },
      { href: "/docs/terraform-export", label: "Terraform & CLI export", icon: CommandLineIcon },
      { href: "/docs/rollback", label: "Rollback strategy", icon: WrenchScrewdriverIcon },
    ],
  },
  {
    title: "ReleaseOps",
    items: [
      { href: "/docs/releaseops", label: "ReleaseOps overview", icon: ShieldCheckIcon },
      { href: "/docs/releaseops/connectors", label: "CI/CD connectors", icon: PuzzlePieceIcon },
      { href: "/docs/releaseops/readiness", label: "Readiness scoring", icon: ShieldCheckIcon },
    ],
  },
  {
    title: "Desktop",
    items: [
      { href: "/docs/desktop-install", label: "Install the desktop app", icon: CommandLineIcon },
      { href: "/docs/desktop-architecture", label: "Desktop architecture", icon: MapIcon },
    ],
  },
  {
    title: "Trust & security",
    items: [
      { href: "/docs/security-model", label: "Security model", icon: ShieldCheckIcon },
      { href: "/docs/permissions-model", label: "Permissions model", icon: LockClosedIcon, status: "coming-soon" },
      { href: "/docs/audit-logs", label: "Audit logs", icon: DocumentTextIcon, status: "coming-soon" },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/docs/troubleshooting", label: "Troubleshooting", icon: WrenchScrewdriverIcon },
      { href: "/docs/faq", label: "FAQ", icon: QuestionMarkCircleIcon },
      { href: "/docs/glossary", label: "Glossary", icon: BookOpenIcon },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation navigation" className="space-y-6">
      {DOC_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="px-3 mb-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon ?? BookOpenIcon;
              const isActive = pathname === item.href;
              const isComing = item.status === "coming-soon";
              return (
                <li key={item.href}>
                  {isComing ? (
                    <span
                      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-600 cursor-not-allowed"
                      aria-disabled="true"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-700 bg-white/[0.02] border border-white/[0.04] rounded-full px-1.5 py-px">
                        soon
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                          : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-violet-400" : ""}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Look up the next/previous doc page based on the current pathname. */
export function getDocAdjacent(pathname: string): { prev?: DocLink; next?: DocLink } {
  const flat: DocLink[] = DOC_SECTIONS.flatMap((s) => s.items).filter((l) => l.status !== "coming-soon");
  const idx = flat.findIndex((l) => l.href === pathname);
  if (idx === -1) return {};
  return {
    prev: idx > 0 ? flat[idx - 1] : undefined,
    next: idx < flat.length - 1 ? flat[idx + 1] : undefined,
  };
}
