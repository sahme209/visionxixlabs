"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Footer } from "@/components/Footer";
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
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

export default function AISolutionsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative">
      <div className="absolute inset-0 bg-dots opacity-20 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 noise-grain pointer-events-none" aria-hidden />
      {/* Floating blur orbs */}
      <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-violet-500/[0.06] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute top-[30%] -right-60 w-[500px] h-[500px] rounded-full bg-fuchsia-500/[0.04] blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-[15%] -left-40 w-[400px] h-[400px] rounded-full bg-violet-500/[0.03] blur-[100px] pointer-events-none" aria-hidden />

      <div className="relative z-10">
        <Navigation />
        <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6 text-xs text-zinc-500">
              <ol className="flex items-center space-x-2">
                <li><Link href="/" className="hover:text-violet-400 transition-colors">Home</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="font-semibold text-zinc-300">AI Solutions</li>
              </ol>
            </nav>

            {/* Hero */}
            <section className="mb-20 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] spotlight-orb opacity-40 pointer-events-none" aria-hidden />
              <div className="relative text-center max-w-4xl mx-auto">
                <Reveal direction="up" blur delay={0}>
                  <span className="huly-badge text-xs font-semibold text-violet-400 tracking-wide uppercase px-3 py-1 mb-6 inline-block">
                    AI Solutions
                  </span>
                </Reveal>
                <Reveal direction="up" blur delay={0.1}>
                  <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-6 tracking-[-0.04em]">
                    <span className="text-gradient">{aiHero.title}</span>
                  </h1>
                </Reveal>
                <Reveal direction="up" blur delay={0.15}>
                  <p className="text-lg md:text-xl text-zinc-400 mb-10">
                    {aiHero.subtitle}
                  </p>
                </Reveal>
                <Reveal direction="up" blur delay={0.2}>
                  <AIHeroCTAs
                    primaryLabel={aiHero.ctaPrimary}
                    primaryHref="/contact"
                    secondaryLabel={aiHero.ctaSecondary}
                    secondaryHref="#what-we-build"
                  />
                </Reveal>
              </div>
            </section>

            <div className="section-divider" />

            {/* Why Vision XIX for AI — differentiators */}
            <section className="mb-20 mt-16">
              <Reveal direction="up" blur>
                <div className="text-center mb-10">
                  <span className="huly-badge text-xs font-semibold text-violet-400 tracking-wide uppercase px-3 py-1 mb-4 inline-block">
                    Why Us
                  </span>
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    Why Vision XIX for <span className="text-gradient">AI</span>
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    Production-first, cloud-native, and built for operations. We close the gap between AI demos and real business value.
                  </p>
                </div>
              </Reveal>
              <AIDifferentiatorsGrid differentiators={aiDifferentiators} />
            </section>

            <div className="section-divider" />

            {/* AI use cases expanded */}
            <section className="mb-20 mt-16">
              <Reveal direction="up" blur>
                <div className="text-center mb-10">
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    AI use cases we <span className="text-gradient">build</span>
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    From customer support to DevOps—we deliver production-grade AI across workflows.
                  </p>
                </div>
              </Reveal>
              <AIUseCasesExpandedGrid useCases={aiUseCasesExpanded} />
            </section>

            <div className="section-divider" />

            {/* Where companies need AI */}
            <Reveal direction="up" blur>
              <section className="mb-16 mt-16 animated-border card-inner-glow rounded-xl border border-white/[0.06] bg-white/[0.02] p-6" aria-labelledby="needs-heading">
                <h2 id="needs-heading" className="text-lg font-bold text-white mb-3">
                  Where companies need AI
                </h2>
                <p className="text-sm text-zinc-400 mb-4">
                  Research shows companies need AI for: customer support, sales/marketing personalization, data extraction, internal knowledge bases, DevOps productivity, operational analytics, and sector-specific automation (agriculture, trade, manufacturing). We build production-grade solutions for these use cases.
                </p>
                <Link href="/markets" className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                  Full list of needs and adoption gaps &rarr;
                </Link>
              </section>
            </Reveal>

            {/* What We Actually Build (Overview continued) */}
            <section id="what-we-build" className="mb-20">
              <Reveal direction="up" blur>
                <div className="text-center mb-12">
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    What we actually <span className="text-gradient">build</span>
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    Practical AI solutions deployed inside your cloud, with security and governance built in.
                  </p>
                </div>
              </Reveal>
              <AIWhatWeBuildGrid cards={aiWhatWeBuild} />
            </section>

            <div className="section-divider" />

            {/* Production AI Systems — structured offerings */}
            <section id="production-ai" className="mb-20 mt-16">
              <Reveal direction="up" blur>
                <div className="text-center mb-12">
                  <span className="huly-badge text-xs font-semibold text-violet-400 tracking-wide uppercase px-3 py-1 mb-4 inline-block">
                    Production AI
                  </span>
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    Production AI Systems, not <span className="text-gradient">AI demos</span>
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    High-end AI offerings with clear scope, security, and deliverables. Each is designed for production deployment inside your cloud.
                  </p>
                </div>
              </Reveal>
              <Stagger delay={0.1} interval={0.08} className="space-y-10">
                {aiOfferings.map((offering) => (
                  <div
                    key={offering.id}
                    className="animated-border card-inner-glow card-hover rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8 hover:border-white/[0.12] transition-all"
                  >
                    <h3 className="text-xl font-bold text-white mb-1">{offering.title}</h3>
                    <p className="text-violet-400 text-sm font-medium mb-4">{offering.tagline}</p>
                    <dl className="grid gap-4 sm:grid-cols-1">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Problem</dt>
                        <dd className="text-sm text-zinc-300">{offering.problem}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Technical approach</dt>
                        <dd className="text-sm text-zinc-300">{offering.technicalApproach}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Deployment model</dt>
                        <dd className="text-sm text-zinc-300">{offering.deploymentModel}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Security model</dt>
                        <dd className="text-sm text-zinc-300">{offering.securityModel}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Deliverables</dt>
                        <dd className="text-sm text-zinc-300">
                          <ul className="list-disc list-inside space-y-1">
                            {offering.deliverables.map((d) => (
                              <li key={d}>{d}</li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Ideal client</dt>
                        <dd className="text-sm text-zinc-300">{offering.idealClient}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </Stagger>
              <Reveal direction="up" blur delay={0.2}>
                <div className="mt-8 text-center">
                  <AnimatedButton variant="primary" href="/contact">
                    Discuss your AI project
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </AnimatedButton>
                </div>
              </Reveal>
            </section>

            <div className="section-divider" />

            {/* Technical Scope — Production AI depth */}
            <div className="mt-16">
              <TechnicalSection {...aiTechnicalSection} />
            </div>

            {/* Technical diagrams — Visio-style flowcharts */}
            <section className="mb-20">
              <Reveal direction="up" blur>
                <div className="text-center mb-10">
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    Technical architecture &amp; <span className="text-gradient">flow</span>
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    From data ingestion to production—our delivery model in technical detail.
                  </p>
                </div>
              </Reveal>
              <Stagger delay={0.1} interval={0.08} className="space-y-8">
                <div className="animated-border card-inner-glow rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Solution architecture</h3>
                  <SolutionArchitectureDiagram />
                </div>
                <div className="animated-border card-inner-glow rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Data flow pipeline</h3>
                  <DataFlowDiagram />
                </div>
                <div className="animated-border card-inner-glow rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Delivery process</h3>
                  <DeliveryProcessFlowchart />
                </div>
              </Stagger>
            </section>

            <div className="section-divider" />

            {/* AI methodology */}
            <section className="mb-20 mt-16">
              <Reveal direction="up" blur>
                <div className="text-center mb-10">
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    Our AI <span className="text-gradient">methodology</span>
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    Discovery, architecture, implementation, and operation—with clear handoffs at each phase.
                  </p>
                </div>
              </Reveal>
              <Stagger delay={0.1} interval={0.06} className="grid gap-6 md:grid-cols-2">
                {aiMethodology.map((m, i) => (
                  <div
                    key={m.phase}
                    className="animated-border card-inner-glow card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-all"
                  >
                    <span className="huly-badge text-xs font-bold text-violet-400 mb-2 inline-block px-2 py-0.5">
                      Phase {i + 1}
                    </span>
                    <h3 className="font-semibold text-white mb-2">{m.phase}</h3>
                    <p className="text-sm text-zinc-400">{m.description}</p>
                  </div>
                ))}
              </Stagger>
            </section>

            <div className="section-divider" />

            {/* AI tech stack */}
            <Reveal direction="up" blur>
              <section className="mb-20 mt-16 animated-border card-inner-glow rounded-xl border border-white/[0.06] bg-white/[0.02] p-8">
                <h2 className="text-xl font-bold text-white mb-4 tracking-[-0.04em]">
                  AI tech stack we <span className="text-gradient">use</span>
                </h2>
                <p className="text-sm text-zinc-400 mb-6">
                  LLM APIs, vector stores, orchestration, model hosting, and observability—integrated with your cloud and CI/CD.
                </p>
                <div className="flex flex-wrap gap-3">
                  {aiTechStack.map((tech) => (
                    <span
                      key={tech}
                      className="huly-badge px-4 py-2 text-sm text-zinc-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </section>
            </Reveal>

            {/* AI governance expanded */}
            <section className="mb-20">
              <Reveal direction="up" blur>
                <h2 className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
                  Responsible AI and <span className="text-gradient">governance</span>
                </h2>
                <p className="text-zinc-400 mb-6 max-w-3xl">
                  We design for security, privacy, and compliance from the start. No shortcuts—production AI requires governance.
                </p>
              </Reveal>
              <ul className="grid sm:grid-cols-2 gap-3 text-zinc-400 text-sm">
                {aiGovernanceExpanded.map((g) => (
                  <li key={g} className="flex gap-2">
                    <span className="text-emerald-400">&#10003;</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="section-divider" />

            {/* How We Deploy AI */}
            <section className="mb-20 mt-16">
              <Reveal direction="up" blur>
                <div className="text-center mb-12">
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    How we <span className="text-gradient">deploy</span> AI
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    An outcome-driven process from discovery to monitoring and optimization.
                  </p>
                </div>
              </Reveal>
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
              <Reveal direction="up" blur>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-[-0.04em]">
                  Implementation <span className="text-gradient">methodology</span>
                </h2>
                <p className="text-zinc-400 max-w-3xl">{implementationMethodologyShort}</p>
              </Reveal>
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

            <div className="section-divider" />

            {/* AI + Cloud Expertise */}
            <section className="mb-20 mt-16 relative">
              <div className="absolute top-1/2 -right-40 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-fuchsia-500/[0.04] blur-[100px] pointer-events-none" aria-hidden />
              <div className="relative">
                <Reveal direction="up" blur>
                  <div className="text-center mb-12">
                    <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                      AI + cloud <span className="text-gradient">expertise</span>
                    </h2>
                    <p className="text-zinc-400 max-w-2xl mx-auto">
                      We deploy and integrate AI on the cloud provider you already use.
                    </p>
                  </div>
                </Reveal>
                <Stagger delay={0.1} interval={0.06} className="grid gap-6 md:grid-cols-3">
                  <div className="animated-border card-inner-glow card-hover bg-white/[0.02] rounded-2xl p-6 border border-white/[0.06] hover:border-white/[0.12] transition-all">
                    <h3 className="text-lg font-semibold text-white mb-3">{aiCloudExpertise.aws.title}</h3>
                    <ul className="space-y-2 text-sm text-zinc-400">
                      {aiCloudExpertise.aws.bullets.map((b) => (
                        <li key={b}>&#8226; {b}</li>
                      ))}
                    </ul>
                    <Link href="/cloud-solutions/aws" className="mt-4 inline-block text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                      Cloud Solutions on AWS &rarr;
                    </Link>
                  </div>
                  <div className="animated-border card-inner-glow card-hover bg-white/[0.02] rounded-2xl p-6 border border-white/[0.06] hover:border-white/[0.12] transition-all">
                    <h3 className="text-lg font-semibold text-white mb-3">{aiCloudExpertise.azure.title}</h3>
                    <ul className="space-y-2 text-sm text-zinc-400">
                      {aiCloudExpertise.azure.bullets.map((b) => (
                        <li key={b}>&#8226; {b}</li>
                      ))}
                    </ul>
                    <Link href="/cloud-solutions/azure" className="mt-4 inline-block text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                      Cloud Solutions on Azure &rarr;
                    </Link>
                  </div>
                  <div className="animated-border card-inner-glow card-hover bg-white/[0.02] rounded-2xl p-6 border border-white/[0.06] hover:border-white/[0.12] transition-all">
                    <h3 className="text-lg font-semibold text-white mb-3">{aiCloudExpertise.gcp.title}</h3>
                    <ul className="space-y-2 text-sm text-zinc-400">
                      {aiCloudExpertise.gcp.bullets.map((b) => (
                        <li key={b}>&#8226; {b}</li>
                      ))}
                    </ul>
                    <Link href="/cloud-solutions/gcp" className="mt-4 inline-block text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                      Cloud Solutions on GCP &rarr;
                    </Link>
                  </div>
                </Stagger>
              </div>
            </section>

            <div className="section-divider" />

            {/* Why Businesses Need This Now */}
            <section className="mb-20 mt-16">
              <Reveal direction="up" blur>
                <div className="animated-border card-inner-glow card-hover bg-white/[0.02] rounded-2xl p-8 md:p-10 border border-white/[0.06] hover:border-white/[0.12] transition-all">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-[-0.04em]">
                    {aiWhyNow.title}
                  </h2>
                  <p className="text-zinc-400 mb-6">{aiWhyNow.intro}</p>
                  <ul className="space-y-2 text-zinc-400">
                    {aiWhyNow.points.map((point) => (
                      <li key={point} className="flex items-start">
                        <span className="text-violet-400 mr-2">&#8226;</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </section>

            {/* Governance & Security */}
            <section className="mb-20">
              <Reveal direction="up" blur>
                <div className="text-center mb-8">
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    Governance &amp; <span className="text-gradient">security</span>
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    Enterprise trust through responsible deployment and clear controls.
                  </p>
                </div>
              </Reveal>
              <Stagger delay={0.1} interval={0.06} className="grid gap-4 md:grid-cols-2">
                {aiGovernance.map((item) => (
                  <div
                    key={item}
                    className="animated-border card-inner-glow card-hover bg-white/[0.02] rounded-xl p-4 border border-white/[0.06] text-sm text-zinc-300 hover:border-white/[0.12] transition-all"
                  >
                    {item}
                  </div>
                ))}
              </Stagger>
            </section>

            <div className="section-divider" />

            {/* Engagement Model */}
            <section id="engagement" className="mb-20 mt-16">
              <Reveal direction="up" blur>
                <div className="text-center mb-12">
                  <span className="huly-badge text-xs font-semibold text-violet-400 tracking-wide uppercase px-3 py-1 mb-4 inline-block">
                    Get Started
                  </span>
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    Engagement <span className="text-gradient">model</span>
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    From assessment to full platform build—structured ways to get started.
                  </p>
                </div>
              </Reveal>
              <div className="grid gap-6 md:grid-cols-3">
                {aiPackages.map((pkg) => (
                  <AIPackageCard key={pkg.id} {...pkg} />
                ))}
              </div>
            </section>

            {/* Ideal Clients */}
            <section className="mb-20">
              <Reveal direction="up" blur>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-[-0.04em]">
                  Ideal <span className="text-gradient">clients</span>
                </h2>
                <p className="text-zinc-400 mb-6 max-w-3xl">
                  We work best with teams that have clear use cases and are ready to deploy AI in production.
                </p>
              </Reveal>
              <ul className="space-y-2 text-zinc-300">
                {idealClientsAI.map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="text-violet-400 mr-2 mt-0.5">&#8226;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* Use Cases */}
            <section className="mb-20">
              <Reveal direction="up" blur>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-[-0.04em]">
                  Use <span className="text-gradient">cases</span>
                </h2>
                <p className="text-zinc-400 mb-8 max-w-3xl">
                  Problem &rarr; approach &rarr; outcome. Representative scenarios we are set up to address.
                </p>
              </Reveal>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {useCases.map((uc) => (
                  <UseCaseCard key={uc.title} {...uc} />
                ))}
              </div>
            </section>

            {/* Scope and boundaries */}
            <WhatWeDoNotDo focusItems={whatWeFocusOn} notDoItems={whatWeDoNotDo} />

            <div className="section-divider" />

            {/* FAQ */}
            <section className="mb-20 mt-16">
              <Reveal direction="up" blur>
                <div className="text-center mb-8">
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
                    Frequently asked <span className="text-gradient">questions</span>
                  </h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto">
                    Real-world questions we hear from teams exploring AI.
                  </p>
                </div>
              </Reveal>
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

            <div className="gradient-line mt-12 mb-8" />

            {/* Internal link to Cloud Solutions */}
            <Reveal direction="up" blur>
              <div className="mt-12 text-center">
                <p className="text-sm text-zinc-400 mb-2">Also explore our cloud infrastructure and DevOps practice.</p>
                <Link href="/cloud-solutions" className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                  Cloud Solutions &rarr;
                </Link>
              </div>

              {/* Internal link to Cloud Review Session */}
              <div className="mt-4 text-center">
                <p className="text-sm text-zinc-400 mb-2">If you prefer a live working session first, we can start with a short review.</p>
                <Link href="/cloud-review" className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                  Cloud &amp; AI Infrastructure Review Session &rarr;
                </Link>
              </div>
            </Reveal>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
