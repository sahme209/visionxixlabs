import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { PackageCard } from "@/components/PackageCard";
import { ProcessStep } from "@/components/ProcessStep";
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
    <div className="min-h-screen bg-[#09090b]">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
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
          <header className="mb-16 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {growingTeamsHero.title}
            </h1>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              {growingTeamsHero.subtitle}
            </p>
          </header>

          {/* Packages */}
          <section
            className="mb-20"
            aria-labelledby="packages-heading"
          >
            <h2 id="packages-heading" className="text-2xl font-bold text-white mb-6">
              Starter packages
            </h2>
            <p className="text-zinc-400 mb-8 max-w-2xl">
              Fixed-scope engagements with clear deliverables. Choose the package that matches your priority.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              {growingTeamsPackages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  name={pkg.name}
                  description={pkg.description}
                  includes={pkg.includes}
                  bestFor={pkg.bestFor}
                  duration="Fixed scope"
                  ctaHref="/contact"
                  ctaLabel="Discuss this package"
                />
              ))}
            </div>
          </section>

          {/* Pricing positioning */}
          <section
            className="mb-20 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
            aria-labelledby="pricing-heading"
          >
            <h2 id="pricing-heading" className="text-xl font-bold text-white mb-4">
              Pricing
            </h2>
            <ul className="space-y-2 text-zinc-400">
              <li>{growingTeamsPricingCopy.line1}</li>
              <li>{growingTeamsPricingCopy.line2}</li>
              <li>{growingTeamsPricingCopy.line3}</li>
            </ul>
          </section>

          {/* Process */}
          <section
            className="mb-20"
            aria-labelledby="process-heading"
          >
            <h2 id="process-heading" className="text-2xl font-bold text-white mb-6">
              How we work with growing teams
            </h2>
            <div className="space-y-6">
              {growingTeamsProcessSteps.map((item) => (
                <ProcessStep
                  key={item.step}
                  step={item.step}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </section>

          {/* Trust */}
          <section
            className="mb-16 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
            aria-labelledby="trust-heading"
          >
            <h2 id="trust-heading" className="text-xl font-bold text-white mb-4">
              How we operate
            </h2>
            <ul className="space-y-2 text-sm text-zinc-400">
              {growingTeamsTrustItems.map((item) => (
                <li key={item} className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* CTA */}
          <div className="text-center">
            <p className="text-zinc-400 mb-4">
              Not sure which package fits? We can help you choose in a short call.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center px-6 py-3 bg-white text-zinc-900 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
