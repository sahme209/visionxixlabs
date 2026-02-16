import type { Metadata } from "next";
import Link from "next/link";
import {
  aiHero,
  aiWhatWeBuild,
  aiProcessSteps,
  aiCloudExpertise,
  aiWhyNow,
  aiGovernance,
  aiPackages,
  aiFAQ,
} from "@/lib/aiContent";
import {
  aiTechnicalSection,
  engineeringPrinciples,
  techStackGroups,
  implementationMethodologyShort,
  aiDeliverables,
  idealClientsAI,
  whatWeFocusOn,
  whatWeDoNotDo,
  useCases,
  howWeWorkPhases,
  securityAccessWeDoNot,
  securityAccessWeOperateUsing,
  securityAccessBlocks,
  clientCollaborationItems,
} from "@/lib/engineeringContent";
import { AISolutionCard } from "@/components/AISolutionCard";
import { AIProcessStep } from "@/components/AIProcessStep";
import { AIPackageCard } from "@/components/AIPackageCard";
import { FAQAccordion } from "@/components/FAQAccordion";
import { CTASection } from "@/components/CTASection";
import { Navigation } from "@/components/Navigation";
import { TechnicalSection } from "@/components/TechnicalSection";
import { ArchitectureBlock } from "@/components/ArchitectureBlock";
import { DeliverableList } from "@/components/DeliverableList";
import { TechStackSection } from "@/components/TechStackSection";
import { WhatWeDoNotDo } from "@/components/WhatWeDoNotDo";
import { UseCaseCard } from "@/components/UseCaseCard";
import { HowWeWorkSection } from "@/components/HowWeWorkSection";
import { SecurityAccessSection } from "@/components/SecurityAccessSection";
import { ClientCollaborationSection } from "@/components/ClientCollaborationSection";

export const metadata: Metadata = {
  title: "AI Solutions | Vision XIX Labs",
  description:
    "Cloud-native AI implementation, secure AI integration, and production-grade AI deployment. Enterprise AI consulting on AWS, Azure, and GCP.",
  keywords: [
    "AI consulting",
    "Cloud AI deployment",
    "Secure AI infrastructure",
    "AI automation",
    "Internal AI assistant",
    "Enterprise AI integration",
    "AI DevOps",
  ],
};

export default function AISolutionsPage() {
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
                AI Solutions
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <section className="mb-20">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                {aiHero.title}
              </h1>
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10">
                {aiHero.subtitle}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  {aiHero.ctaPrimary}
                </Link>
                <a
                  href="#what-we-build"
                  className="inline-flex items-center px-6 py-3 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 hover:-translate-y-0.5 transition-all"
                >
                  {aiHero.ctaSecondary}
                </a>
              </div>
            </div>
          </section>

          {/* What We Actually Build (Overview continued) */}
          <section id="what-we-build" className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                What we actually build
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Practical AI solutions deployed inside your cloud, with security and governance built in.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {aiWhatWeBuild.map((card) => (
                <AISolutionCard key={card.id} {...card} />
              ))}
            </div>
          </section>

          {/* Technical Scope — Production AI depth */}
          <TechnicalSection {...aiTechnicalSection} />

          {/* How We Deploy AI */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                How we deploy AI
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                An outcome-driven process from discovery to monitoring and optimization.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {aiProcessSteps.slice(0, 3).map((step) => (
                <AIProcessStep key={step.step} {...step} />
              ))}
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
              {aiProcessSteps.slice(3).map((step) => (
                <AIProcessStep key={step.step} {...step} />
              ))}
            </div>
          </section>

          {/* Architecture Approach */}
          <ArchitectureBlock title="Engineering principles" principles={engineeringPrinciples} />

          {/* Tooling & Stack */}
          <TechStackSection title="Tooling & stack" groups={techStackGroups} />

          {/* Implementation Methodology */}
          <section className="mb-20">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Implementation methodology
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
              {implementationMethodologyShort}
            </p>
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
          <DeliverableList title="Deliverables" items={aiDeliverables} />

          {/* AI + Cloud Expertise */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                AI + cloud expertise
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                We deploy and integrate AI on the cloud provider you already use.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  {aiCloudExpertise.aws.title}
                </h3>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {aiCloudExpertise.aws.bullets.map((b) => (
                    <li key={b}>• {b}</li>
                  ))}
                </ul>
                <Link
                  href="/cloud-solutions/aws"
                  className="mt-4 inline-block text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Cloud Solutions on AWS →
                </Link>
              </div>
              <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  {aiCloudExpertise.azure.title}
                </h3>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {aiCloudExpertise.azure.bullets.map((b) => (
                    <li key={b}>• {b}</li>
                  ))}
                </ul>
                <Link
                  href="/cloud-solutions/azure"
                  className="mt-4 inline-block text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Cloud Solutions on Azure →
                </Link>
              </div>
              <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  {aiCloudExpertise.gcp.title}
                </h3>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {aiCloudExpertise.gcp.bullets.map((b) => (
                    <li key={b}>• {b}</li>
                  ))}
                </ul>
                <Link
                  href="/cloud-solutions/gcp"
                  className="mt-4 inline-block text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Cloud Solutions on GCP →
                </Link>
              </div>
            </div>
          </section>

          {/* Why Businesses Need This Now */}
          <section className="mb-20">
            <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-8 md:p-10 shadow-xl border border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                {aiWhyNow.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {aiWhyNow.intro}
              </p>
              <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                {aiWhyNow.points.map((point) => (
                  <li key={point} className="flex items-start">
                    <span className="text-indigo-500 mr-2">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Governance & Security */}
          <section className="mb-20">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Governance & security
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Enterprise trust through responsible deployment and clear controls.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {aiGovernance.map((item) => (
                <div
                  key={item}
                  className="card-hover bg-white dark:bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          {/* Engagement Model */}
          <section id="engagement" className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Engagement model
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                From assessment to full platform build—structured ways to get started.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {aiPackages.map((pkg) => (
                <AIPackageCard key={pkg.id} {...pkg} />
              ))}
            </div>
          </section>

          {/* Ideal Clients */}
          <section className="mb-20">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Ideal clients
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
              We work best with teams that have clear use cases and are ready to deploy AI in production.
            </p>
            <ul className="space-y-2 text-slate-700 dark:text-slate-300">
              {idealClientsAI.map((item) => (
                <li key={item} className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Use Cases */}
          <section className="mb-20">
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

          {/* Scope and boundaries */}
          <WhatWeDoNotDo focusItems={whatWeFocusOn} notDoItems={whatWeDoNotDo} />

          {/* FAQ */}
          <section className="mb-20">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Frequently asked questions
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Real-world questions we hear from teams exploring AI.
              </p>
            </div>
            <FAQAccordion items={aiFAQ} />
          </section>

          {/* CTA */}
          <CTASection
            title="Ready to deploy AI securely?"
            subtitle="Talk to us about your use case. We'll help you design and deploy AI that fits your cloud, your data, and your workflows."
            primaryLabel="Talk to an Engineer"
            primaryHref="/contact"
            secondaryLabel="Email Us"
            secondaryHref="mailto:support@visionxixlabs.com"
          />

          {/* Internal link to Cloud Solutions */}
          <div className="mt-12 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Also explore our cloud infrastructure and DevOps practice.
            </p>
            <Link
              href="/cloud-solutions"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Cloud Solutions →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
