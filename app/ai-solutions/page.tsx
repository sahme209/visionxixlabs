import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import {
  aiDifferentiators,
  aiUseCasesExpanded,
  aiMethodology,
  aiTechStack,
  aiGovernanceExpanded,
} from "@/lib/aiCapabilitiesContent";
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
import { aiOfferings } from "@/lib/aiOfferingsContent";
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
import { AIDifferentiatorsGrid } from "@/components/AIDifferentiatorsGrid";
import { AIUseCasesExpandedGrid } from "@/components/AIUseCasesExpandedGrid";
import { AIWhatWeBuildGrid } from "@/components/AIWhatWeBuildGrid";
import { AIHeroCTAs } from "@/components/AIHeroCTAs";
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
import { EnterpriseTrustSignals } from "@/components/EnterpriseTrustSignals";
import {
  DataFlowDiagram,
  SolutionArchitectureDiagram,
  DeliveryProcessFlowchart,
} from "@/components/diagrams";

export const metadata: Metadata = {
  title: "AI Solutions",
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
    "production AI",
    "LLM deployment",
  ],
  openGraph: {
    title: "AI Solutions | Production AI | Vision XIX Labs",
    description: "Secure AI integration and production AI deployment. Enterprise AI on AWS, Azure, GCP.",
    url: "https://visionxixlabs.com/ai-solutions",
  },
  alternates: { canonical: "https://visionxixlabs.com/ai-solutions" },
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
              <AIHeroCTAs
                primaryLabel={aiHero.ctaPrimary}
                primaryHref="/contact"
                secondaryLabel={aiHero.ctaSecondary}
                secondaryHref="#what-we-build"
              />
            </div>
          </section>

          {/* Why Vision XIX for AI — differentiators */}
          <section className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Why Vision XIX for AI
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Production-first, cloud-native, and built for operations. We close the gap between AI demos and real business value.
              </p>
            </div>
            <AIDifferentiatorsGrid differentiators={aiDifferentiators} />
          </section>

          {/* AI use cases expanded */}
          <section className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                AI use cases we build
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                From customer support to DevOps—we deliver production-grade AI across workflows.
              </p>
            </div>
            <AIUseCasesExpandedGrid useCases={aiUseCasesExpanded} />
          </section>

          {/* Where companies need AI */}
          <section className="mb-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6" aria-labelledby="needs-heading">
            <h2 id="needs-heading" className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
              Where companies need AI
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Research shows companies need AI for: customer support, sales/marketing personalization, data extraction, internal knowledge bases, DevOps productivity, operational analytics, and sector-specific automation (agriculture, trade, manufacturing). We build production-grade solutions for these use cases.
            </p>
            <Link
              href="/markets"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Full list of needs and adoption gaps →
            </Link>
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
            <AIWhatWeBuildGrid cards={aiWhatWeBuild} />
          </section>

          {/* Production AI Systems — structured offerings */}
          <section id="production-ai" className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Production AI Systems, not AI demos
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                High-end AI offerings with clear scope, security, and deliverables. Each is designed for production deployment inside your cloud.
              </p>
            </div>
            <div className="space-y-10">
              {aiOfferings.map((offering) => (
                <div
                  key={offering.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 md:p-8 shadow-sm"
                >
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {offering.title}
                  </h3>
                  <p className="text-indigo-600 dark:text-indigo-400 text-sm font-medium mb-4">
                    {offering.tagline}
                  </p>
                  <dl className="grid gap-4 sm:grid-cols-1">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Problem</dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-300">{offering.problem}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Technical approach</dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-300">{offering.technicalApproach}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Deployment model</dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-300">{offering.deploymentModel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Security model</dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-300">{offering.securityModel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Deliverables</dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-300">
                        <ul className="list-disc list-inside space-y-1">
                          {offering.deliverables.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Ideal client</dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-300">{offering.idealClient}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/contact"
                className="inline-flex items-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                Discuss your AI project
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* Technical Scope — Production AI depth */}
          <TechnicalSection {...aiTechnicalSection} />

          {/* Technical diagrams — Visio-style flowcharts */}
          <section className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Technical architecture & flow
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                From data ingestion to production—our delivery model in technical detail.
              </p>
            </div>
            <div className="space-y-8">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                  Solution architecture
                </h3>
                <SolutionArchitectureDiagram />
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                  Data flow pipeline
                </h3>
                <DataFlowDiagram />
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                  Delivery process
                </h3>
                <DeliveryProcessFlowchart />
              </div>
            </div>
          </section>

          {/* AI methodology */}
          <section className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Our AI methodology
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Discovery, architecture, implementation, and operation—with clear handoffs at each phase.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {aiMethodology.map((m, i) => (
                <div
                  key={m.phase}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
                >
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2 block">
                    Phase {i + 1}
                  </span>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{m.phase}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{m.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* AI tech stack */}
          <section className="mb-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              AI tech stack we use
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              LLM APIs, vector stores, orchestration, model hosting, and observability—integrated with your cloud and CI/CD.
            </p>
            <div className="flex flex-wrap gap-3">
              {aiTechStack.map((tech) => (
                <span
                  key={tech}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300"
                >
                  {tech}
                </span>
              ))}
            </div>
          </section>

          {/* AI governance expanded */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Responsible AI and governance
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
              We design for security, privacy, and compliance from the start. No shortcuts—production AI requires governance.
            </p>
            <ul className="grid sm:grid-cols-2 gap-3 text-slate-600 dark:text-slate-400 text-sm">
              {aiGovernanceExpanded.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="text-indigo-500">✓</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </section>

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

          <EnterpriseTrustSignals />

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
            plansHref="/visionxix-ai/pricing"
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

          {/* Internal link to Cloud Review Session */}
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              If you prefer a live working session first, we can start with a short review.
            </p>
            <Link
              href="/cloud-review"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Cloud &amp; AI Infrastructure Review Session →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
