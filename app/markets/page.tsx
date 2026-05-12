import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ExclamationTriangleIcon,
  LightBulbIcon,
  CpuChipIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { SITE_URL } from "@/lib/seo";
import { adoptionGaps, whereCompaniesNeedAI, sectorNeeds, aiMarketContext } from "@/lib/needsContent";
import {
  AIAdoptionFlowDiagram,
  SectorMatrixDiagram,
  SolutionArchitectureDiagram,
  DataFlowDiagram,
  DeliveryProcessFlowchart,
  UseCaseDecisionFlow,
} from "@/components/diagrams";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

export const metadata: Metadata = {
  title: "Where Companies Need AI | Vision XIX Labs",
  description:
    "AI adoption gaps and where companies need AI: customer support, automation, analytics, internal AI, DevOps. How Vision XIX Labs helps close those gaps.",
  alternates: { canonical: `${SITE_URL}/markets` },
  openGraph: {
    title: "Where Companies Need AI | Vision XIX Labs",
    description: "Research on AI adoption gaps and needs. How we help companies deploy practical, production-grade AI.",
    url: `${SITE_URL}/markets`,
  },
};

export default function MarketsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-mesh opacity-10 pointer-events-none" aria-hidden />
      <div className="spotlight-orb absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-600/[0.06] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute top-1/2 right-0 w-80 h-80 rounded-full bg-fuchsia-600/[0.04] blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-40 left-10 w-64 h-64 rounded-full bg-violet-500/[0.03] blur-[100px] pointer-events-none" aria-hidden />

      <Navigation />
      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-8 text-xs text-zinc-500"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link
                  href="/"
                  className="hover:text-violet-400"
                >
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Where Companies Need AI
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <Reveal direction="up" blur delay={0.05}>
            <header className="mb-16 text-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-[-0.04em]">
                Where companies need <span className="text-gradient">AI</span>—and how we help
              </h1>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                Research on adoption gaps and where AI delivers value. We help companies identify needs, choose the right use cases, and deploy practical, production-ready solutions.
              </p>
            </header>
          </Reveal>

          {/* Market context */}
          <Reveal direction="up" blur delay={0.1}>
            <section className="mb-16 glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="text-lg font-bold text-white mb-4 tracking-[-0.04em]">
                Why this matters now
              </h2>
              <ul className="space-y-2 text-sm text-zinc-400">
                {aiMarketContext.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="text-violet-500 shrink-0">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <div className="section-divider mb-16" />

          {/* Adoption gaps */}
          <section className="mb-20">
            <Reveal direction="up" blur delay={0.1}>
              <div className="flex items-center gap-3 mb-6">
                <ExclamationTriangleIcon className="h-8 w-8 text-violet-400" />
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.04em]">
                  Common adoption <span className="text-gradient">gaps</span>
                </h2>
              </div>
            </Reveal>
            <Reveal direction="up" blur delay={0.15}>
              <div className="glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 mb-8">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  AI adoption journey
                </h3>
                <AIAdoptionFlowDiagram />
              </div>
            </Reveal>
            <Stagger delay={0.15} interval={0.06}>
              <div className="grid sm:grid-cols-2 gap-4">
                {adoptionGaps.map((gap) => (
                  <div
                    key={gap.title}
                    className="glow-border-card card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
                  >
                    <h3 className="font-semibold text-white mb-2">
                      {gap.title}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      {gap.description}
                    </p>
                  </div>
                ))}
              </div>
            </Stagger>
          </section>

          <div className="section-divider mb-16" />

          {/* Where companies need AI */}
          <section className="mb-20">
            <Reveal direction="up" blur delay={0.1}>
              <h2 className="text-2xl font-bold text-white mb-6 tracking-[-0.04em]">
                Where companies need <span className="text-gradient">AI</span>
              </h2>
            </Reveal>
            <Reveal direction="up" blur delay={0.15}>
              <div className="glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 mb-8">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  Use case decision flow
                </h3>
                <UseCaseDecisionFlow />
              </div>
            </Reveal>
            <Reveal direction="up" blur delay={0.2}>
              <div className="glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <div className="grid sm:grid-cols-2 gap-3">
                  {whereCompaniesNeedAI.map((need) => (
                    <div
                      key={need}
                      className="flex gap-3 p-3 rounded-lg bg-white/[0.02] hover-lift"
                    >
                      <CheckCircleIcon className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-zinc-400">
                        {need}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </section>

          <div className="section-divider mb-16" />

          {/* Sector needs */}
          <section className="mb-20">
            <Reveal direction="up" blur delay={0.1}>
              <h2 className="text-2xl font-bold text-white mb-6 tracking-[-0.04em]">
                Needs by <span className="text-gradient">sector</span>
              </h2>
            </Reveal>
            <Reveal direction="up" blur delay={0.15}>
              <div className="glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 mb-8">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  Sector x AI needs matrix
                </h3>
                <SectorMatrixDiagram />
              </div>
            </Reveal>
            <Stagger delay={0.15} interval={0.06}>
              <div className="grid sm:grid-cols-2 gap-4">
                {sectorNeeds.map(({ sector, needs }) => (
                  <div
                    key={sector}
                    className="glow-border-card card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
                  >
                    <h3 className="font-semibold text-white mb-3">
                      {sector}
                    </h3>
                    <ul className="space-y-1 text-sm text-zinc-400">
                      {needs.map((n) => (
                        <li key={n}>• {n}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Stagger>
          </section>

          <div className="section-divider mb-16" />

          {/* How we help */}
          <Reveal direction="up" blur delay={0.1}>
            <section className="glass-card rounded-xl border-2 border-violet-500/20 bg-violet-500/10 p-8 mb-16">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 tracking-[-0.04em]">
                <LightBulbIcon className="h-6 w-6 text-violet-400" />
                How we <span className="text-gradient">help</span>
              </h2>
              <div className="rounded-xl border border-violet-500/20 bg-white/[0.02] p-6 mb-6">
                <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide mb-3">
                  Solution architecture
                </h3>
                <SolutionArchitectureDiagram />
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-white/[0.02] p-6 mb-6">
                <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide mb-3">
                  Data flow pipeline
                </h3>
                <DataFlowDiagram />
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-white/[0.02] p-6 mb-6">
                <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide mb-3">
                  Delivery process
                </h3>
                <DeliveryProcessFlowchart />
              </div>
              <p className="text-zinc-400 mb-4">
                We focus on practical AI that fits existing workflows. No data scientists or heavy infrastructure required. We start with a{" "}
                <Link href="/free-review" className="text-violet-400 hover:underline">
                  free cloud and AI review
                </Link>
                , identify quick wins, and deliver fixed-scope packages for{" "}
                <Link href="/solutions-for-growing-teams" className="text-violet-400 hover:underline">
                  growing teams
                </Link>
                . For larger organizations, we follow{" "}
                <Link href="/enterprise-readiness" className="text-violet-400 hover:underline">
                  enterprise-ready
                </Link>{" "}
                governance and delivery. We deploy cloud infrastructure (AWS, Azure, GCP), internal AI and LLM systems, automation, and security—so you move from pilots to production with clear deliverables.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-violet-400 font-semibold hover:underline"
              >
                Discuss your needs
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </section>
          </Reveal>

          {/* CTA */}
          <Reveal direction="up" blur delay={0.15}>
            <section className="glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <CpuChipIcon className="h-12 w-12 text-violet-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2 tracking-[-0.04em]">
                Ready to close your <span className="text-gradient">AI gap</span>?
              </h2>
              <p className="text-zinc-400 mb-6 max-w-xl mx-auto">
                We help companies identify where AI delivers value and implement it with clear deliverables.
              </p>
              <AnimatedButton variant="primary" href="/contact">
                Get started
              </AnimatedButton>
            </section>
          </Reveal>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8 mt-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-6 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Image
                  src="/vision-xix-logo.png"
                  alt="Vision XIX Labs"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-lg font-bold text-white">Vision XIX Labs</span>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                Cloud &amp; AI engineering for modern infrastructure. AWS, Azure, GCP — design, automate, optimize, secure.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">AWS</span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">Azure</span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">GCP</span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">AI/ML</span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Cloud</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/cloud-solutions" className="hover:text-white transition-colors">Cloud Solutions</Link></li>
                <li><Link href="/cloud-solutions/aws" className="hover:text-white transition-colors">AWS</Link></li>
                <li><Link href="/cloud-solutions/azure" className="hover:text-white transition-colors">Azure</Link></li>
                <li><Link href="/cloud-solutions/gcp" className="hover:text-white transition-colors">GCP</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Solutions</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/ai-solutions" className="hover:text-white transition-colors">AI Solutions</Link></li>
                <li><Link href="/ai-engineering" className="hover:text-white transition-colors">AI Engineering</Link></li>
                <li><Link href="/markets" className="hover:text-white transition-colors">Where Companies Need AI</Link></li>
                <li><Link href="/enterprise-readiness" className="hover:text-white transition-colors">Enterprise Readiness</Link></li>
                <li><Link href="/solutions-for-growing-teams" className="hover:text-white transition-colors">Growing Teams</Link></li>
                <li><Link href="/cloud-security" className="hover:text-white transition-colors">Cloud Security</Link></li>
                <li><Link href="/case-studies" className="hover:text-white transition-colors">Case Studies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/#about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/apps" className="hover:text-white transition-colors">Products</Link></li>
                <li><Link href="/press" className="hover:text-white transition-colors">Press &amp; Media</Link></li>
                <li><Link href="/insights" className="hover:text-white transition-colors">Insights</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Connect</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/request" className="hover:text-white transition-colors">Website Request / Get a Quote</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="mailto:support@visionxixlabs.com" className="hover:text-white transition-colors">support@visionxixlabs.com</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8">
            <p className="text-slate-400 text-sm">© {new Date().getFullYear()} Vision XIX Labs LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
