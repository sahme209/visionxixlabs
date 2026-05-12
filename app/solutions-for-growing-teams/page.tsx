import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { PackageCard } from "@/components/PackageCard";
import { ProcessStep } from "@/components/ProcessStep";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import {
  growingTeamsHero,
  growingTeamsPackages,
  growingTeamsProcessSteps,
  growingTeamsTrustItems,
  growingTeamsPricingCopy,
} from "@/lib/growingTeamsContent";

export const metadata: Metadata = {
  title: "Solutions for Growing Teams",
  description:
    "Fixed-scope cloud and AI packages for startups and small businesses: Cloud Health Check, DevOps & CI/CD Setup, AI Automation Starter, Cost Optimization Sprint.",
  openGraph: {
    title: "Cloud & AI Solutions for Growing Teams | Vision XIX Labs",
    description: "Outcome-focused packages for startups and SMBs. Fixed scope, clear deliverables.",
    url: "https://visionxixlabs.com/solutions-for-growing-teams",
  },
  alternates: { canonical: "https://visionxixlabs.com/solutions-for-growing-teams" },
};

export default function SolutionsForGrowingTeamsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
      <div className="spotlight-orb absolute -top-40 right-1/4 w-[450px] h-[450px] rounded-full bg-indigo-600/[0.06] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-40 -left-20 w-72 h-72 rounded-full bg-blue-600/[0.04] blur-[100px] pointer-events-none" aria-hidden />

      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-8 text-xs text-zinc-500"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/" className="hover:text-violet-400">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Solutions for Growing Teams
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <Reveal direction="up" blur delay={0.05}>
            <header className="mb-16 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-[-0.04em]">
                <span className="text-gradient">{growingTeamsHero.title}</span>
              </h1>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                {growingTeamsHero.subtitle}
              </p>
            </header>
          </Reveal>

          {/* Packages */}
          <section
            className="mb-20"
            aria-labelledby="packages-heading"
          >
            <Reveal direction="up" blur delay={0.1}>
              <h2 id="packages-heading" className="text-2xl font-bold text-white mb-6 tracking-[-0.04em]">
                Starter <span className="text-gradient">packages</span>
              </h2>
              <p className="text-zinc-400 mb-8 max-w-2xl">
                Fixed-scope engagements with clear deliverables. Choose the package that matches your priority.
              </p>
            </Reveal>
            <Stagger delay={0.12} interval={0.08}>
              <div className="grid gap-6 sm:grid-cols-2">
                {growingTeamsPackages.map((pkg) => (
                  <div key={pkg.id} className="animated-border card-inner-glow card-hover card-shine-sweep card-reactive rounded-xl">
                    <PackageCard
                      name={pkg.name}
                      description={pkg.description}
                      includes={pkg.includes}
                      bestFor={pkg.bestFor}
                      duration="Fixed scope"
                      ctaHref="/contact"
                      ctaLabel="Discuss this package"
                    />
                  </div>
                ))}
              </div>
            </Stagger>
          </section>

          <div className="section-divider mb-16" />

          {/* Pricing positioning */}
          <Reveal direction="up" blur delay={0.1}>
            <section
              className="mb-20 glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
              aria-labelledby="pricing-heading"
            >
              <h2 id="pricing-heading" className="text-xl font-bold text-white mb-4 tracking-[-0.04em]">
                Pricing
              </h2>
              <ul className="space-y-2 text-zinc-400">
                <li>{growingTeamsPricingCopy.line1}</li>
                <li>{growingTeamsPricingCopy.line2}</li>
                <li>{growingTeamsPricingCopy.line3}</li>
              </ul>
            </section>
          </Reveal>

          <div className="section-divider mb-16" />

          {/* Process */}
          <section
            className="mb-20"
            aria-labelledby="process-heading"
          >
            <Reveal direction="up" blur delay={0.1}>
              <h2 id="process-heading" className="text-2xl font-bold text-white mb-6 tracking-[-0.04em]">
                How we work with <span className="text-gradient">growing teams</span>
              </h2>
            </Reveal>
            <Stagger delay={0.12} interval={0.08}>
              <div className="space-y-6">
                {growingTeamsProcessSteps.map((item) => (
                  <div key={item.step} className="hover-lift">
                    <ProcessStep
                      step={item.step}
                      title={item.title}
                      description={item.description}
                    />
                  </div>
                ))}
              </div>
            </Stagger>
          </section>

          <div className="section-divider mb-16" />

          {/* Trust */}
          <Reveal direction="up" blur delay={0.1}>
            <section
              className="mb-16 glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
              aria-labelledby="trust-heading"
            >
              <h2 id="trust-heading" className="text-xl font-bold text-white mb-4 tracking-[-0.04em]">
                How we operate
              </h2>
              <ul className="space-y-2 text-sm text-zinc-400">
                {growingTeamsTrustItems.map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="text-violet-500 mr-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          {/* CTA */}
          <Reveal direction="up" blur delay={0.15}>
            <div className="text-center">
              <p className="text-zinc-400 mb-4">
                Not sure which package fits? We can help you choose in a short call.
              </p>
              <AnimatedButton variant="primary" href="/contact">
                Get in touch
              </AnimatedButton>
            </div>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
