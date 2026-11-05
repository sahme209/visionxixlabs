"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  CloudIcon,
  CommandLineIcon,
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
      { href: "/docs/quickstart-checklist", label: "Quickstart checklist", icon: RocketLaunchIcon },
      { href: "/docs/getting-started", label: "Getting started", icon: RocketLaunchIcon },
      { href: "/docs/architecture", label: "Architecture overview", icon: MapIcon },
      { href: "/docs/source-modes", label: "Source modes", icon: BookOpenIcon },
      { href: "/docs/surfaces", label: "Product surfaces", icon: MapIcon },
    ],
  },
  {
    title: "Configure delivery",
    items: [
      { href: "/docs/aws-setup", label: "AWS setup", icon: CloudIcon },
      { href: "/docs/azure-setup", label: "Azure setup", icon: CloudIcon },
      { href: "/docs/gcp-setup", label: "GCP setup", icon: CloudIcon },
    ],
  },
  {
    title: "Operate",
    items: [
      { href: "/docs/approval-workflow", label: "Approval workflow", icon: LockClosedIcon },
      { href: "/docs/execution-plans", label: "Execution plans", icon: RocketLaunchIcon },
      { href: "/docs/rollback", label: "AWS ECS rollback", icon: WrenchScrewdriverIcon },
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
      { href: "/docs/integration-setup", label: "Integration setup", icon: PuzzlePieceIcon },
    ],
  },
  {
    title: "Trust & security",
    items: [
      { href: "/docs/security-model", label: "Security model", icon: ShieldCheckIcon },
      { href: "/docs/permissions-model", label: "Permissions model", icon: LockClosedIcon },
      { href: "/docs/oauth-setup", label: "OAuth setup", icon: LockClosedIcon },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/docs/troubleshooting", label: "Troubleshooting", icon: WrenchScrewdriverIcon },
      { href: "/docs/audit-logs", label: "Audit evidence", icon: BookOpenIcon },
      { href: "/docs/faq", label: "FAQ", icon: QuestionMarkCircleIcon },
      { href: "/docs/glossary", label: "Glossary", icon: BookOpenIcon },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const prefix = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const sections = DOC_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => !normalizedQuery
      || section.title.toLocaleLowerCase().includes(normalizedQuery)
      || item.label.toLocaleLowerCase().includes(normalizedQuery)),
  })).filter(section => section.items.length > 0);
  const resultCount = sections.reduce((count, section) => count + section.items.length, 0);

  return (
    <nav aria-label="Documentation navigation" className="space-y-6">
      <div className="space-y-2 px-3">
        <label htmlFor={`${prefix}-query`} className="block text-sm font-medium text-zinc-200">Find a guide</label>
        <p id={`${prefix}-scope`} className="text-xs leading-5 text-zinc-400">Filters guide titles and section names in this navigation. It does not search article text or provide answers.</p>
        <input ref={field} id={`${prefix}-query`} type="search" value={query}
          aria-describedby={`${prefix}-scope`} aria-controls={`${prefix}-results`}
          onChange={event => setQuery(event.target.value)} placeholder="Guide title or section"
          className="min-h-11 w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300" />
        {query && <button type="button" onClick={() => { setQuery(""); field.current?.focus(); }} className="min-h-11 rounded-lg px-2 text-xs text-zinc-300 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300">Clear guide filter</button>}
        <p role="status" aria-live="polite" aria-atomic="true" className="text-xs leading-5 text-zinc-400">{resultCount ? `${resultCount} ${resultCount === 1 ? "guide" : "guides"} shown` : "No guide titles or sections match."}</p>
      </div>
      <div id={`${prefix}-results`} className="space-y-6">
      {sections.map((section) => (
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
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-orange-500/10 text-orange-300 border border-orange-500/20"
                          : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-orange-400" : ""}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      </div>
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
