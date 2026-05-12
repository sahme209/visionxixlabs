import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
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
import { CloudSolutionsAnimatedGrid } from "@/components/CloudSolutionsAnimatedGrid";
import { CloudHeroCTAs } from "@/components/CloudHeroCTAs";
import { CloudMethodologyGrid } from "@/components/CloudMethodologyGrid";
import { CloudUseCasesGrid } from "@/components/CloudUseCasesGrid";
import { CloudIndustriesGrid } from "@/components/CloudIndustriesGrid";
import { CloudTrustGrid } from "@/components/CloudTrustGrid";
import { PackageCard } from "@/components/PackageCard";
import { FAQAccordion } from "@/components/FAQAccordion";
import { CloudProviderTabs } from "@/components/CloudProviderTabs";
import { CTASection } from "@/components/CTASection";
import { Navigation } from "@/components/Navigation";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
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
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

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
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none" />
      <div className="bg-dots absolute inset-0 pointer-events-none" />
      <BackgroundBlobs />
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-6 text-xs text-zinc-500"
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
                Cloud Solutions
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <Reveal direction="up" blur>
            <section className="mb-16">
              <div className="text-left">
                <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-[-0.04em] text-gradient">
                  {cloudSolutionsHero.title}
                </h1>
                <p className="text-lg md:text-xl text-zinc-400 max-w-3xl">
                  {cloudSolutionsHero.subtitle}
                </p>
                <CloudHeroCTAs />
                <div className="mt-8 flex flex-wrap gap-2">
                  {cloudSolutionsHero.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="huly-badge inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-zinc-300"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </Reveal>

          <div className="section-divider my-16" />

          {/* Overview */}
          <Reveal direction="up" delay={0.1}>
            <section id="solutions-grid" className="mb-16" aria-labelledby="overview-heading">
              <h2 id="overview-heading" className="sr-only">
                Overview
              </h2>
              <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-[-0.04em]">
                    Cloud solutions from <span className="text-gradient">foundation to operations</span>
                  </h2>
                  <p className="text-sm md:text-base text-zinc-400 max-w-3xl">
                    A structured set of services that cover landing zones,
                    automation, cost optimization, reliability, security, and
                    day-to-day operations on AWS, Azure, and GCP.
                  </p>
                </div>
                <div className="hidden md:block text-xs text-zinc-500">
                  <p>
                    Need AWS, Azure, or GCP specifics? Visit{" "}
                    <Link
                      href="/cloud-solutions/aws"
                      className="text-violet-400 hover:underline"
                    >
                      AWS Cloud Solutions
                    </Link>
                    ,{" "}
                    <Link
                      href="/cloud-solutions/azure"
                      className="text-violet-400 hover:underline"
                    >
                      Azure Cloud Solutions
                    </Link>
                    , or{" "}
                    <Link
                      href="/cloud-solutions/gcp"
                      className="text-violet-400 hover:underline"
                    >
                      GCP Cloud Solutions
                    </Link>
                    .
                  </p>
                </div>
              </div>
              <CloudSolutionsAnimatedGrid solutions={cloudSolutionCards} />
            </section>
          </Reveal>

          <div className="section-divider my-16" />

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

          <div className="section-divider my-16" />

          {/* Cloud Provider Tabs */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16">
              <div className="mb-6 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-[-0.04em]">
                  AWS, Azure, and GCP delivery, <span className="text-gradient">unified approach</span>
                </h2>
                <p className="text-sm md:text-base text-zinc-400 max-w-3xl mx-auto">
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
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-zinc-400">
                <Link
                  href="/cloud-solutions/aws"
                  className="underline underline-offset-4 hover:text-violet-400"
                >
                  View AWS Cloud Solutions
                </Link>
                <Link
                  href="/cloud-solutions/azure"
                  className="underline underline-offset-4 hover:text-violet-400"
                >
                  View Azure Cloud Solutions
                </Link>
                <Link
                  href="/cloud-solutions/gcp"
                  className="underline underline-offset-4 hover:text-violet-400"
                >
                  View GCP Cloud Solutions
                </Link>
              </div>
            </section>
          </Reveal>

          <div className="section-divider my-16" />

          {/* Implementation Methodology */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16" aria-labelledby="methodology-heading">
              <div className="mb-8 text-center">
                <h2 id="methodology-heading" className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-[-0.04em]">
                  Implementation <span className="text-gradient">methodology</span>
                </h2>
                <p className="text-sm md:text-base text-zinc-400 max-w-3xl mx-auto">
                  A structured, outcome-focused approach that keeps delivery
                  predictable while giving you clear visibility at every step.
                </p>
              </div>
              <CloudMethodologyGrid />
            </section>
          </Reveal>

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

          <div className="section-divider my-16" />

          {/* Engagement Model */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16">
              <div className="mb-8 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-[-0.04em]">
                  Engagement <span className="text-gradient">model</span>
                </h2>
                <p className="text-sm md:text-base text-zinc-400 max-w-3xl mx-auto">
                  Structured ways to work together—whether you need a quick
                  assessment, a solid foundation, or ongoing optimization and
                  support.
                </p>
              </div>
              <Stagger className="grid gap-6 md:grid-cols-3">
                {engagementPackages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    name={pkg.name}
                    duration={pkg.duration}
                    includes={pkg.includes}
                    bestFor={pkg.bestFor}
                  />
                ))}
              </Stagger>
            </section>
          </Reveal>

          {/* Ideal Clients */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-[-0.04em]">
                Ideal clients
              </h2>
              <p className="text-zinc-400 mb-6 max-w-3xl">
                We work best with teams that have clear goals and are ready to invest in platform quality.
              </p>
              <ul className="space-y-2 text-zinc-300">
                {idealClientsCloud.map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="text-violet-500 mr-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          {/* Use Cases */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-[-0.04em]">
                Use cases
              </h2>
              <p className="text-zinc-400 mb-8 max-w-3xl">
                Problem → approach → outcome. Representative scenarios we are set up to address.
              </p>
              <CloudUseCasesGrid useCases={useCases} />
            </section>
          </Reveal>

          {/* Provider Comparison */}
          <ComparisonTable title="Provider comparison (high-level)" rows={providerComparison} />

          {/* Scope and boundaries */}
          <WhatWeDoNotDo focusItems={whatWeFocusOn} notDoItems={whatWeDoNotDo} />

          <div className="section-divider my-16" />

          {/* Industries */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16">
              <div className="mb-6 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-[-0.04em]">
                  Industries
                </h2>
                <p className="text-sm md:text-base text-zinc-400 max-w-3xl mx-auto">
                  We work with a range of teams and products. These examples are
                  representative, not exhaustive.
                </p>
              </div>
              <CloudIndustriesGrid industries={industries} />
            </section>
          </Reveal>

          {/* Trust & Compliance */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16">
              <div className="mb-6 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-[-0.04em]">
                  Trust, security, and <span className="text-gradient">operational discipline</span>
                </h2>
                <p className="text-sm md:text-base text-zinc-400 max-w-3xl mx-auto">
                  We focus on building platforms you can trust—without making
                  claims we can&apos;t stand behind.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <CloudTrustGrid principles={trustPrinciples} />
                </div>
                <div className="animated-border card-inner-glow card-hover bg-white/[0.02] text-slate-100 rounded-2xl p-6 shadow-xl border border-white/[0.06] flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Tools we work with
                    </h3>
                    <p className="text-sm text-zinc-300">{toolsWeWorkWith}</p>
                  </div>
                  <p className="mt-4 text-xs text-zinc-500">
                    We can also work with adjacent tools in your stack where it
                    makes sense. The goal is to improve your platform, not force a
                    specific toolset.
                  </p>
                </div>
              </div>
            </section>
          </Reveal>

          <div className="section-divider my-16" />

          {/* FAQ */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16">
              <div className="mb-6 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-[-0.04em]">
                  Frequently asked questions
                </h2>
                <p className="text-sm md:text-base text-zinc-400 max-w-3xl mx-auto">
                  If you don&apos;t see your question here, we&apos;re happy to
                  cover it in a quick call.
                </p>
              </div>
              <FAQAccordion items={cloudFAQ} />
            </section>
          </Reveal>

          {/* Link to AI Solutions */}
          <div className="mb-16 text-center">
            <p className="text-sm text-zinc-400 mb-2">
              Building AI on top of your cloud? Explore our AI Solutions practice.
            </p>
            <Link
              href="/ai-solutions"
              className="text-sm font-semibold text-violet-400 hover:underline"
            >
              AI Solutions →
            </Link>
          </div>

          {/* Link to Cloud Review Session */}
          <div className="mb-16 text-center">
            <p className="text-sm text-zinc-400 mb-2">
              Want a short, structured walkthrough before deciding on scope?
            </p>
            <Link
              href="/cloud-review"
              className="text-sm font-semibold text-violet-400 hover:underline"
            >
              Cloud &amp; AI Infrastructure Review Session →
            </Link>
          </div>

          {/* CTA Footer */}
          <CTASection
            title="Let's build a cloud platform you can trust."
            subtitle="Talk to us about where you are today and where you want your AWS or Azure platform to be. We'll help you chart a practical path forward."
            primaryLabel="Book a Call"
            primaryHref="/contact"
            secondaryLabel="Email Us"
            secondaryHref="mailto:support@visionxixlabs.com"
            plansHref="/visionxix-ai/pricing"
          />
        </div>
      </main>

      <Footer />

      {/* Floating blur orbs */}
      <div className="absolute bottom-1/4 left-10 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-fuchsia-600/8 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
