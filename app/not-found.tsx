/**
 * /not-found — Apple-grade error state.
 *
 * 404 isn't a stub. It's a brand surface. Same design system as the
 * rest of the site — coral aurora, mono-label eyebrow, .font-display
 * headline, tactile buttons. The "every state matters" principle from
 * /principles applied to the most-overlooked page.
 */

import Link from "next/link";
import { ArrowLeftIcon, HomeIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      {/* Aurora — coral × violet × cyan, same restraint as /manifesto */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ambient-drift absolute top-0 left-1/2 -translate-x-1/2 w-[820px] h-[480px] rounded-full bg-brand-violet/[0.08] blur-[150px]" />
        <div className="ambient-drift absolute top-[30%] right-[5%] w-[460px] h-[400px] rounded-full bg-brand-coral/[0.07] blur-[140px]" style={{ animationDelay: "-9s" }} />
        <div className="ambient-drift absolute bottom-0 left-[5%] w-[380px] h-[300px] rounded-full bg-cyan-500/[0.05] blur-[120px]" style={{ animationDelay: "-15s" }} />
      </div>

      <Navigation />

      <main className="relative max-w-6xl mx-auto px-6 md:px-10 pt-32 pb-32">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20 items-start">
          {/* Left — content */}
          <div>
            <p className="mono-label inline-flex items-center gap-3 mb-6">
              <span className="text-brand-coral/90 tabular-nums">404</span>
              <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
              Page not found
            </p>

            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.02] mb-8 tracking-[-0.045em]">
              This page didn&apos;t{" "}
              <span className="relative inline-block">
                make the cut.
                <span aria-hidden className="absolute left-0 -bottom-1 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
              </span>
            </h1>

            <p className="text-[16.5px] text-zinc-400 max-w-xl leading-relaxed mb-10">
              The URL you visited doesn&apos;t exist on the site. It might have moved,
              the link might be stale, or this could be a typo. None of these is
              catastrophic &mdash; here are five places that are.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-12">
              <Link
                href="/"
                className="btn-press inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14.5px] font-semibold tracking-tight"
              >
                <HomeIcon className="h-4 w-4" />
                Home
              </Link>
              <Link
                href="/docs"
                className="btn-ghost-press inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-medium tracking-tight"
              >
                Documentation
              </Link>
            </div>

            <div className="hairline-soft mb-8" />

            <p className="mono-label mb-4">Five places to start instead</p>
            <ul className="space-y-2.5 text-[14px]">
              {[
                { href: "/demo",      label: "/demo",      desc: "Scripted walkthrough — no signup" },
                { href: "/plans",     label: "/plans",     desc: "Pricing — based on actual cloud usage" },
                { href: "/manifesto", label: "/manifesto", desc: "What we believe about the product" },
                { href: "/handbook",  label: "/handbook",  desc: "How we build it" },
                { href: "/status",    label: "/status",    desc: "Live system status" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group inline-flex items-baseline gap-3 hover:text-brand-coral transition-colors"
                  >
                    <span className="font-mono text-[12px] text-brand-coral/80 group-hover:text-brand-coral tabular-nums">{link.label}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors">{link.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — quiet diagnostic card */}
          <aside className="surface-frost rounded-2xl p-7 hidden lg:block">
            <header className="mb-5">
              <p className="mono-label text-brand-coral/85">Diagnostic</p>
              <h2 className="font-display text-xl font-bold text-white mt-2 tracking-tight">What just happened.</h2>
            </header>
            <dl className="space-y-3 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-3">
                <dt className="mono-label text-zinc-500">Status</dt>
                <dd className="font-mono text-brand-coral tabular-nums">HTTP 404</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-3">
                <dt className="mono-label text-zinc-500">Reason</dt>
                <dd className="text-zinc-300 text-right max-w-[60%]">Route not found in app/ directory</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-3">
                <dt className="mono-label text-zinc-500">Action</dt>
                <dd className="text-zinc-300 text-right max-w-[60%]">No retry attempted. Static response served.</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-3">
                <dt className="mono-label text-zinc-500">Audit</dt>
                <dd className="text-zinc-300 text-right">Not logged (404 = no event)</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="mono-label text-zinc-500">Approval</dt>
                <dd className="text-emerald-300/85 text-right">N/A — read-only path</dd>
              </div>
            </dl>

            <div className="hairline-soft mt-7 mb-5" />

            <p className="text-[11.5px] text-zinc-500 leading-relaxed">
              Yes, even our 404 page reads as a typed system state.
              That&apos;s by design &mdash; see{" "}
              <Link href="/principles" className="text-brand-coral hover:underline">/principles &middot; 08 Honesty</Link>.
            </p>
          </aside>
        </div>

        {/* Bottom — quiet back link */}
        <div className="mt-20 pt-10 border-t border-white/[0.06]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.22em] text-zinc-500 hover:text-brand-coral transition-colors"
          >
            <ArrowLeftIcon className="h-3 w-3" />
            Back to visionxixlabs.com
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
