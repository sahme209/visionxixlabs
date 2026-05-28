/**
 * /handbook — the engineering handbook.
 *
 * Long-form essays on the technical choices that built Axiom. Not blog
 * posts (those are timely + product-focused). Handbook entries are
 * timeless practice notes — the things a new engineer would read on
 * day one to understand how we work.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Engineering Handbook — VisionXIXLabs",
  description:
    "How we build Axiom. Long-form notes on closed-union safety, approval-gated deploys, audit trails as a feature, and the engineering practices a small team uses to ship serious AI ops software.",
};

interface Section {
  num: string;
  topic: string;
  title: string;
  body: string;
  bullets?: readonly string[];
}

const SECTIONS: readonly Section[] = [
  {
    num: "01",
    topic: "Type safety",
    title: "Closed unions over runtime checks.",
    body: "Every state machine, every event payload, every outcome lives in a closed-union TypeScript type. The compiler is the first reviewer — if a switch statement doesn't cover every case, the build fails. This is the cheapest insurance against the most common production bug: an unexpected category we forgot to handle.",
    bullets: [
      "`type DraftStatus = \"drafted\" | \"in_review\" | \"approved\" | ...`",
      "Exhaustive switch + `assertNever()` helper at every endpoint",
      "No `any` in production code. `unknown` at boundaries, then narrowed",
    ],
  },
  {
    num: "02",
    topic: "Architecture",
    title: "Pure kernels + thin IO boundary.",
    body: "Decision logic lives in pure functions with no side effects — easy to test, easy to reason about, no need to mock anything. Database calls, network requests, file I/O all live in a single thin file per feature that composes the pure kernel with the outside world. When something breaks, it's almost always in the IO file.",
    bullets: [
      "lib/growth/autopilot.ts — pure decision kernel (40 lines of logic)",
      "app/api/cron/linkedin-daily-drafts/route.ts — IO orchestrator (200 lines)",
      "Unit tests cover the kernel. Integration tests cover the IO boundary",
    ],
  },
  {
    num: "03",
    topic: "Observability",
    title: "Best-effort audit. Never blocking.",
    body: "Every business event writes an audit row. But audit writes never block the business event itself — they're wrapped in try/catch that silently absorbs DB outages. If the audit store is down, we don't refuse to approve a draft. Audit is a side-effect; the business event is the goal.",
    bullets: [
      "writeGrowthAudit() is always async + always best-effort",
      "Closed-union GrowthAuditAction so audit typos are compile errors",
      "Retention ≥ 365 days. Sha-256 signed. Never edited, only appended",
    ],
  },
  {
    num: "04",
    topic: "Deployment",
    title: "Two switches between staging and production.",
    body: "Posting to LinkedIn requires LINKEDIN_POSTING_ENABLED=true AND a live LinkedInAccountConnection AND a draft in status=approved|scheduled. Three independent gates. If any one is missing, the operation returns a typed `skipped_*` outcome and writes a run record. Defense in depth — flipping any one switch is reversible in a single env-var edit.",
  },
  {
    num: "05",
    topic: "Defaults",
    title: "Safe defaults. Loud opt-outs.",
    body: "Autopilot defaults to off. Posting defaults to off. Cron jobs refuse to run without CRON_SECRET set. The system ships in the most conservative state and gets more aggressive only via explicit env-var flips. Production safety is a property of the default, not the carefulness of the operator.",
  },
  {
    num: "06",
    topic: "Schema",
    title: "Migrations as the source of truth.",
    body: "The Prisma schema file is the design surface; the migrations directory is the contract with the production database. We never edit production tables manually. If a schema change isn't in a migration file checked into source control, it didn't happen. (We learned this the hard way — see Phase 470.)",
  },
  {
    num: "07",
    topic: "Hallmarks",
    title: "Hallmarks of code we'd merge.",
    body: "Tight scope. Comments explain WHY, not WHAT. No dead code. No commented-out blocks. No `// TODO` markers older than the sprint. Names that disambiguate from neighbors, not just describe their referent. Functions short enough that the entire signature fits on one line.",
  },
];

export default function HandbookPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ambient-drift absolute top-0 left-1/2 -translate-x-1/2 w-[820px] h-[480px] rounded-full bg-brand-violet/[0.07] blur-[150px]" />
        <div className="ambient-drift absolute top-[40%] right-[5%] w-[460px] h-[400px] rounded-full bg-brand-coral/[0.06] blur-[140px]" style={{ animationDelay: "-9s" }} />
        <div className="ambient-drift absolute bottom-0 left-[5%] w-[380px] h-[300px] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-15s" }} />
      </div>

      <Navigation />

      <main className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-32">
        <p className="mono-label inline-flex items-center gap-3 mb-6">
          <span className="text-brand-coral/90 tabular-nums">HB</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Engineering handbook
        </p>

        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.02] mb-8 tracking-[-0.045em]">
          How we{" "}
          <span className="relative inline-block">
            build it.
            <span aria-hidden className="absolute left-0 -bottom-1 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </h1>

        <p className="text-[17px] text-zinc-400 max-w-2xl leading-relaxed mb-16">
          Seven practices a small team uses to ship serious AI-operations software.
          Not theory &mdash; what&apos;s in source control, what we&apos;ll defend in
          a PR review, what we&apos;ve learned to do (sometimes the hard way).
        </p>

        <div className="space-y-20">
          {SECTIONS.map((s) => (
            <article key={s.num} className="relative">
              <div className="hairline-soft mb-10" />
              <p className="mono-label mb-5 inline-flex items-center gap-3">
                <span className="text-brand-coral/90 tabular-nums text-[11px]">{s.num}</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                <span className="text-zinc-500">{s.topic}</span>
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-[1.06] tracking-[-0.035em] mb-5">
                {s.title}
              </h2>
              <p className="text-[16px] text-zinc-300 leading-[1.78] mb-6">{s.body}</p>
              {s.bullets && s.bullets.length > 0 && (
                <ul className="surface-glass rounded-xl p-5 space-y-2.5">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-[13.5px] text-zinc-300 leading-relaxed">
                      <span className="text-brand-coral/70 mt-1 shrink-0">·</span>
                      <span dangerouslySetInnerHTML={{ __html: b.replace(/`([^`]+)`/g, '<code class="font-mono text-brand-coral/90 bg-white/[0.04] px-1.5 py-0.5 rounded text-[12.5px]">$1</code>') }} />
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        <div className="mt-32 pt-12 border-t border-white/[0.06] grid sm:grid-cols-2 gap-6">
          <div>
            <p className="mono-label mb-2">Companion pieces</p>
            <p className="font-display text-xl font-semibold text-white mb-3 leading-tight">More of the same posture.</p>
            <ul className="space-y-1.5 text-[13.5px] text-zinc-300">
              <li><Link href="/manifesto" className="hover:text-brand-coral transition-colors">/manifesto &mdash; what we believe →</Link></li>
              <li><Link href="/principles" className="hover:text-brand-coral transition-colors">/principles &mdash; how we make visual decisions →</Link></li>
              <li><Link href="/team" className="hover:text-brand-coral transition-colors">/team &mdash; how we work →</Link></li>
            </ul>
          </div>
          <div className="flex flex-col items-start sm:items-end justify-end gap-3">
            <Link
              href="/docs"
              className="btn-ghost-press inline-flex items-center gap-2 px-5 py-3 rounded-full text-[13.5px] font-medium tracking-tight"
            >
              Read the product docs
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="https://github.com/sahme209/axiom-releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-zinc-500 hover:text-brand-coral transition-colors font-mono"
            >
              github.com/sahme209/axiom-releases →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
