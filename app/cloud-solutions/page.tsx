import type { Metadata } from "next";
import Link from "next/link";
import {
  cloudSolutionsHero,
  cloudSolutionCards,
  engagementPackages,
  industries,
  trustPrinciples,
  toolsWeWorkWith,
  cloudFAQ,
  awsSummaryBullets,
  azureSummaryBullets,
  gcpSummaryBullets,
} from "@/lib/cloudContent";
import {
  engineeringPrinciples,
  cloudArchitectureSection,
  devOpsSection,
  finOpsSection,
  reliabilitySection,
  securitySection,
  coreDeliverables,
  useCases,
  providerComparison,
  whatWeFocusOn,
  whatWeDoNotDo,
  idealClientsCloud,
  techStackGroups,
  howWeWorkPhases,
  securityAccessWeDoNot,
  securityAccessWeOperateUsing,
  securityAccessBlocks,
  clientCollaborationItems,
} from "@/lib/engineeringContent";
import { SolutionCard } from "@/components/SolutionCard";
import { PackageCard } from "@/components/PackageCard";
import { FAQAccordion } from "@/components/FAQAccordion";
import { CloudProviderTabs } from "@/components/CloudProviderTabs";
import { CTASection } from "@/components/CTASection";
import { Navigation } from "@/components/Navigation";
import { TechnicalSection } from "@/components/TechnicalSection";
import { DeliverableList } from "@/components/DeliverableList";
import { ArchitectureBlock } from "@/components/ArchitectureBlock";
import { ComparisonTable } from "@/components/ComparisonTable";
import { UseCaseCard } from "@/components/UseCaseCard";
import { TechStackSection } from "@/components/TechStackSection";
import { WhatWeDoNotDo } from "@/components/WhatWeDoNotDo";
import { HowWeWorkSection } from "@/components/HowWeWorkSection";
import { SecurityAccessSection } from "@/components/SecurityAccessSection";
import { ClientCollaborationSection } from "@/components/ClientCollaborationSection";
import { EnterpriseTrustSignals } from "@/components/EnterpriseTrustSignals";

export const metadata: Metadata = {
  title: "Cloud Solutions",
  description:
    "Cloud solutions on AWS, Azure, and GCP that help teams ship faster, run reliably, and control costs. Infrastructure, CI/CD, FinOps, reliability, and security services.",
  keywords: [
    "cloud solutions",
    "AWS",
    "Azure",
    "GCP",
    "Infrastructure as Code",
    "CI/CD",
    "FinOps",
    "landing zone",
    "cloud consulting",
  ],
  openGraph: {
    title: "Cloud Solutions | AWS, Azure, GCP | Vision XIX Labs",
    description:
      "Cloud solutions on AWS, Azure, and GCP. Infrastructure, CI/CD, FinOps, reliability, security.",
    url: "https://visionxixlabs.com/cloud-solutions",
  },
  alternates: { canonical: "https://visionxixlabs.com/cloud-solutions" },
};

export default function CloudSolutionsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-6 text-xs text-slate-500 dark:text-slate-400"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link
                  href="/"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Cloud Solutions
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <section className="mb-16">
            <div className="text-left">
              <h1 className="text-3xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                {cloudSolutionsHero.title}
              </h1>
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl">
                {cloudSolutionsHero.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  Book a Call
                </Link>
                <a
                  href="#solutions-grid"
                  className="inline-flex items-center px-6 py-3 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm font-semibold shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 hover:-translate-y-0.5 transition-all"
                >
                  View Solutions
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                {cloudSolutionsHero.capabilities.map((capability) => (
                  <span
                    key={capability}
                    className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Overview */}
          <section id="solutions-grid" className="mb-16" aria-labelledby="overview-heading">
            <h2 id="overview-heading" className="sr-only">
              Overview
            </h2>
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Cloud solutions from foundation to operations
                </h2>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
                  A structured set of services that cover landing zones,
                  automation, cost optimization, reliability, security, and
                  day-to-day operations on AWS, Azure, and GCP.
                </p>
              </div>
              <div className="hidden md:block text-xs text-slate-500 dark:text-slate-400">
                <p>
                  Need AWS, Azure, or GCP specifics? Visit{" "}
                  <Link
                    href="/cloud-solutions/aws"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    AWS Cloud Solutions
                  </Link>
                  ,{" "}
                  <Link
                    href="/cloud-solutions/azure"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Azure Cloud Solutions
                  </Link>
                  , or{" "}
                  <Link
                    href="/cloud-solutions/gcp"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    GCP Cloud Solutions
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {cloudSolutionCards.map((solution) => (
                <SolutionCard key={solution.id} {...solution} />
              ))}
            </div>
          </section>

          {/* Technical Scope */}
          <TechnicalSection {...cloudArchitectureSection} />
          <TechnicalSection {...devOpsSection} />
          <TechnicalSection {...finOpsSection} />
          <TechnicalSection {...reliabilitySection} />
          <TechnicalSection {...securitySection} />

          {/* Architecture Approach / Engineering Principles */}
          <ArchitectureBlock
            title="Engineering principles"
            principles={engineeringPrinciples}
          />

          {/* Enterprise trust signals */}
          <EnterpriseTrustSignals />

          {/* Tooling & Stack */}
          <TechStackSection title="Tooling & stack" groups={techStackGroups} />

          {/* Cloud Provider Tabs */}
          <section className="mb-16">
            <div className="mb-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                AWS, Azure, and GCP delivery, unified approach
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                We work across AWS, Azure, and Google Cloud Platform with a consistent way of designing,
                automating, and operating platforms—while respecting each
                provider&apos;s strengths.
              </p>
            </div>
            <CloudProviderTabs
              awsBullets={awsSummaryBullets}
              azureBullets={azureSummaryBullets}
              gcpBullets={gcpSummaryBullets}
            />
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <Link
                href="/cloud-solutions/aws"
                className="underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                View AWS Cloud Solutions
              </Link>
              <Link
                href="/cloud-solutions/azure"
                className="underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                View Azure Cloud Solutions
              </Link>
              <Link
                href="/cloud-solutions/gcp"
                className="underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                View GCP Cloud Solutions
              </Link>
            </div>
          </section>

          {/* Implementation Methodology */}
          <section className="mb-16" aria-labelledby="methodology-heading">
            <div className="mb-8 text-center">
              <h2 id="methodology-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Implementation methodology
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                A structured, outcome-focused approach that keeps delivery
                predictable while giving you clear visibility at every step.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Discovery",
                  description:
                    "Understand your products, teams, constraints, and current AWS/Azure landscape.",
                },
                {
                  title: "Architecture & Roadmap",
                  description:
                    "Define target architectures and a prioritized roadmap that balances risk and impact.",
                },
                {
                  title: "Implementation",
                  description:
                    "Deliver changes in small, safe increments with your teams involved throughout.",
                },
                {
                  title: "Hardening & Automation",
                  description:
                    "Bake reliability, security, and automation into the platform and pipelines.",
                },
                {
                  title: "Handover & Documentation",
                  description:
                    "Document decisions, patterns, and runbooks so your teams can own the platform.",
                },
                {
                  title: "Optimization & Support",
                  description:
                    "Refine cost, performance, and processes based on real usage and business feedback.",
                },
              ].map((step, index) => (
                <div
                  key={step.title}
                  className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {step.title}
                    </h3>
                    <span className="text-xs font-semibold text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* How We Work */}
          <HowWeWorkSection phases={howWeWorkPhases} />

          {/* Security & Access Model */}
          <SecurityAccessSection
            weDoNot={securityAccessWeDoNot}
            weOperateUsing={securityAccessWeOperateUsing}
            blocks={securityAccessBlocks}
          />

          {/* Client Collaboration Model */}
          <ClientCollaborationSection items={clientCollaborationItems} />

          {/* Deliverables */}
          <DeliverableList title="Deliverables" items={coreDeliverables} />

          {/* Engagement Model */}
          <section className="mb-16">
            <div className="mb-8 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Engagement model
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                Structured ways to work together—whether you need a quick
                assessment, a solid foundation, or ongoing optimization and
                support.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {engagementPackages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  name={pkg.name}
                  duration={pkg.duration}
                  includes={pkg.includes}
                  bestFor={pkg.bestFor}
                />
              ))}
            </div>
          </section>

          {/* Ideal Clients */}
          <section className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Ideal clients
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
              We work best with teams that have clear goals and are ready to invest in platform quality.
            </p>
            <ul className="space-y-2 text-slate-700 dark:text-slate-300">
              {idealClientsCloud.map((item) => (
                <li key={item} className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Use Cases */}
          <section className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Use cases
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-3xl">
              Problem → approach → outcome. Representative scenarios we are set up to address.
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {useCases.map((uc) => (
                <UseCaseCard key={uc.title} {...uc} />
              ))}
            </div>
          </section>

          {/* Provider Comparison */}
          <ComparisonTable title="Provider comparison (high-level)" rows={providerComparison} />

          {/* Scope and boundaries */}
          <WhatWeDoNotDo focusItems={whatWeFocusOn} notDoItems={whatWeDoNotDo} />

          {/* Industries */}
          <section className="mb-16">
            <div className="mb-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Industries
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                We work with a range of teams and products. These examples are
                representative, not exhaustive.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {industries.map((industry) => (
                <div
                  key={industry}
                  className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 text-center"
                >
                  {industry}
                </div>
              ))}
            </div>
          </section>

          {/* Trust & Compliance */}
          <section className="mb-16">
            <div className="mb-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Trust, security, and operational discipline
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                We focus on building platforms you can trust—without making
                claims we can&apos;t stand behind.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                {trustPrinciples.map((principle) => (
                  <div
                    key={principle}
                    className="card-hover bg-white dark:bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300"
                  >
                    {principle}
                  </div>
                ))}
              </div>
              <div className="card-hover bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xl border border-slate-700 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Tools we work with
                  </h3>
                  <p className="text-sm text-slate-300">{toolsWeWorkWith}</p>
                </div>
                <p className="mt-4 text-xs text-slate-400">
                  We can also work with adjacent tools in your stack where it
                  makes sense. The goal is to improve your platform, not force a
                  specific toolset.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-16">
            <div className="mb-6 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Frequently asked questions
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                If you don&apos;t see your question here, we&apos;re happy to
                cover it in a quick call.
              </p>
            </div>
            <FAQAccordion items={cloudFAQ} />
          </section>

          {/* Link to AI Solutions */}
          <div className="mb-16 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Building AI on top of your cloud? Explore our AI Solutions practice.
            </p>
            <Link
              href="/ai-solutions"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              AI Solutions →
            </Link>
          </div>

          {/* Link to Cloud Review Session */}
          <div className="mb-16 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Want a short, structured walkthrough before deciding on scope?
            </p>
            <Link
              href="/cloud-review"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Cloud &amp; AI Infrastructure Review Session →
            </Link>
          </div>

          {/* CTA Footer */}
          <CTASection
            title="Let’s build a cloud platform you can trust."
            subtitle="Talk to us about where you are today and where you want your AWS or Azure platform to be. We’ll help you chart a practical path forward."
            primaryLabel="Book a Call"
            primaryHref="/contact"
            secondaryLabel="Email Us"
            secondaryHref="mailto:support@visionxixlabs.com"
          />
        </div>
      </main>
    </div>
  );
}

