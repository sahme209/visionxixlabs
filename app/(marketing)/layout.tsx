/**
 * Marketing route-group layout.
 *
 * Wraps every page in app/(marketing)/* with a shared nav + footer.
 * Server component — the animated children are client islands inside
 * each page. Background is a single dark canvas so the page-level
 * aurora effects feel continuous.
 */

import type { ReactNode } from "react";
import Link from "next/link";

const NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/team-of-one",   label: "Overview" },
  { href: "/how-it-works",  label: "How it works" },
  { href: "/disciplines",   label: "Disciplines" },
  { href: "/capabilities",  label: "Capabilities" },
  { href: "/platforms",     label: "Platforms" },
  { href: "/trust",         label: "Trust" },
  { href: "/plans",         label: "Plans" },
  { href: "/compare",       label: "Compare" },
  { href: "/faq",           label: "FAQ" },
];

const FOOTER_GROUPS: ReadonlyArray<{
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}> = [
  {
    title: "Product",
    links: [
      { href: "/team-of-one",  label: "Overview" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/disciplines",  label: "Disciplines" },
      { href: "/capabilities", label: "Capabilities" },
      { href: "/platforms",    label: "Platforms" },
      { href: "/plans",        label: "Plans" },
    ],
  },
  {
    title: "Decide",
    links: [
      { href: "/compare",      label: "Compare" },
      { href: "/faq",          label: "FAQ" },
      { href: "/contact",      label: "Book a walkthrough" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/trust",        label: "Safety + compliance" },
      { href: "/status",       label: "Live status" },
      { href: "/changelog",    label: "Changelog" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/dashboard/command-center", label: "Open cockpit" },
      { href: "/dashboard/ai-settings",    label: "AI settings" },
    ],
  },
];

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070713] text-zinc-100">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#070713]/80 border-b border-white/[0.04]">
        <div className="mx-auto max-w-6xl px-6 md:px-10 h-14 flex items-center justify-between">
          <Link href="/team-of-one" className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-[13px] font-semibold tracking-tight">Axiom</span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 hidden sm:inline">
              · visionxixlabs
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-[12.5px] text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/[0.04] transition"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/auth/signin"
              className="hidden sm:inline-flex text-[12.5px] text-zinc-300 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/[0.04] transition"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard/command-center"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-3.5 py-1.5 text-[12.5px] font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
            >
              Open cockpit
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="relative z-10 border-t border-white/[0.04] mt-12">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="text-[13px] font-semibold">Axiom</span>
            </div>
            <p className="mt-3 text-[12px] text-zinc-500 leading-relaxed max-w-[24ch]">
              An AI-assisted operations platform for cloud, DevOps, security, and
              business operations. Human approval required for every action.
            </p>
          </div>

          {FOOTER_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">{g.title}</p>
              <ul className="space-y-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[13px] text-zinc-300 hover:text-white transition">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.04]">
          <div className="mx-auto max-w-6xl px-6 md:px-10 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
            <span>© visionxixlabs · approval_only_no_execution</span>
            <span>Free AI providers · web + mobile + desktop · 25+ disciplines</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
