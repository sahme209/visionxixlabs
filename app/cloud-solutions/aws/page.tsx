import type { Metadata } from "next";
import Link from "next/link";
import { engagementPackages, cloudFAQ } from "../../../lib/cloudContent";
import {
  engineeringPrinciples,
  coreDeliverables,
  idealClientsCloud,
  techStackGroups,
  whatWeFocusOn,
  whatWeDoNotDo,
  implementationMethodologyShort,
} from "../../../lib/engineeringContent";
import { PackageCard } from "../../../components/PackageCard";
import { Navigation } from "../../../components/Navigation";
import { ArchitectureBlock } from "../../../components/ArchitectureBlock";
import { DeliverableList } from "../../../components/DeliverableList";
import { TechStackSection } from "../../../components/TechStackSection";
import { FAQAccordion } from "../../../components/FAQAccordion";
import { CTASection } from "../../../components/CTASection";
import { WhatWeDoNotDo } from "../../../components/WhatWeDoNotDo";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

export const metadata: Metadata = {
  title: "AWS Cloud Solutions",
  description:
    "AWS cloud solutions to design, automate, optimize, and operate your platform. Foundations, CI/CD with GitHub and Octopus Deploy, cost optimization, reliability, security, and DR.",
  keywords: ["AWS consulting", "AWS cloud", "Amazon Web Services", "AWS infrastructure", "AWS CI/CD", "AWS FinOps"],
  openGraph: { url: "https://visionxixlabs.com/cloud-solutions/aws" },
  alternates: { canonical: "https://visionxixlabs.com/cloud-solutions/aws" },
};

export default function AwsCloudSolutionsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none" />
      <div className="bg-grid-mesh absolute inset-0 pointer-events-none" />
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
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
              <li>
                <Link
                  href="/cloud-solutions"
                  className="hover:text-violet-400"
                >
                  Cloud Solutions
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                AWS
              </li>
            </ol>
          </nav>

          {/* 1. Overview — Huly numbered + coral underline */}
          <Reveal direction="up" blur>
            <section id="overview" className="mb-12" aria-labelledby="overview-heading">
              <p className="mono-label inline-flex items-center gap-3 mb-4">
                <span className="text-brand-coral/90 tabular-nums">AW</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                AWS
              </p>
              <h1 id="overview-heading" className="font-display text-4xl md:text-5xl font-bold mb-3 leading-[1.04]">
                <span className="relative inline-block">
                  AWS Cloud Solutions
                  <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
                </span>
              </h1>
              <p className="text-lg md:text-xl text-zinc-400 max-w-3xl mb-4">
                Design, automate, optimize, and operate on AWS with an
                engineering-first delivery approach that balances speed, safety,
                and cost.
              </p>
              <p className="text-sm text-zinc-400 max-w-3xl">
                We focus on practical patterns you can run in production—from
                foundations and CI/CD through to FinOps, observability, security,
                and disaster recovery.
              </p>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          <div className="space-y-10">
            {/* 2. Technical Scope */}
            <Reveal direction="up" delay={0.1}>
              <h2 id="technical-scope" className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
                Technical <span className="text-gradient">scope</span>
              </h2>
            </Reveal>

            {/* AWS Cloud Foundations */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  AWS Cloud Foundations
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We design AWS landing zones, account structures, and VPC
                  patterns that give your teams a consistent, secure baseline to
                  build on.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    High-level VPC patterns, subnets, and routing for your
                    environments.
                  </li>
                  <li>
                    Baseline security posture including network controls and
                    logging.
                  </li>
                  <li>
                    Account strategy aligned to teams, environments, or workloads.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* Compute & Storage */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Compute &amp; Storage
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We help shape EC2, EBS, and related services so workloads have
                  the right balance of performance, resilience, and cost.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>Instance family and sizing guidance for key workloads.</li>
                  <li>
                    EBS strategies for performance, durability, and lifecycle
                    management.
                  </li>
                  <li>
                    High-level patterns for autoscaling and capacity management.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* CI/CD with GitHub + Octopus Deploy */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  CI/CD with GitHub &amp; Octopus Deploy
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We build CI workflows around GitHub and deployment pipelines
                  using Octopus Deploy, tuned to your branching and release
                  strategy.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    GitHub-based CI pipelines for build, test, and validation.
                  </li>
                  <li>
                    Octopus Deploy release pipelines with clear promotion paths
                    across dev, test, staging, and production.
                  </li>
                  <li>
                    Environment consistency and configuration management for AWS
                    targets.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* FinOps & Cost Optimization */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  FinOps &amp; Cost Optimization
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We review AWS usage to identify waste, right-size resources, and
                  put in place simple guardrails so spend stays predictable.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>Right-sizing of compute, storage, and supporting services.</li>
                  <li>
                    Storage optimization, including EBS lifecycle and data
                    retention approaches.
                  </li>
                  <li>
                    Budgeting, alerts, and basic reporting aligned to finance
                    cadence.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* Observability */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Observability
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We help define metrics, logs, and traces approaches so
                  production issues are surfaced quickly and consistently.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    Monitoring and alerting strategies grounded in business impact.
                  </li>
                  <li>
                    Logging approaches and dashboards using AWS-native or existing
                    tools.
                  </li>
                  <li>
                    High-level SLO thinking to focus engineering effort where it
                    matters.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* Security & Governance */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Security &amp; Governance
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We apply IAM and policy patterns that favor least privilege while
                  staying practical for day-to-day engineering work.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    High-level IAM best practices and role patterns for teams and
                    services.
                  </li>
                  <li>
                    Guardrails and configuration baselines to support compliance
                    efforts.
                  </li>
                  <li>
                    Integration of security considerations into pipelines and
                    change processes.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* DR & Resiliency */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  DR &amp; Resiliency
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We help define and implement backup and recovery approaches that
                  match your recovery objectives and budget.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    Backup strategies for key data and services, using AWS-native
                    capabilities where appropriate.
                  </li>
                  <li>
                    Recovery planning and playbooks aligned to realistic scenarios.
                  </li>
                  <li>
                    High-level patterns for regional resiliency where needed.
                  </li>
                </ul>
              </section>
            </Reveal>

            <div className="section-divider my-12" />

            {/* 3. Architecture Approach */}
            <ArchitectureBlock title="Engineering principles" principles={engineeringPrinciples} />

            {/* 4. Tooling & Stack */}
            <TechStackSection title="Tooling & stack" groups={techStackGroups} />

            <div className="section-divider my-12" />

            {/* 5. Implementation Methodology */}
            <Reveal direction="up" delay={0.1}>
              <section id="implementation-methodology">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-[-0.04em]">
                  Implementation <span className="text-gradient">methodology</span>
                </h2>
                <p className="text-sm md:text-base text-zinc-400">
                  {implementationMethodologyShort}
                </p>
              </section>
            </Reveal>

            {/* 6. Deliverables */}
            <DeliverableList title="Deliverables" items={coreDeliverables} />

            <div className="section-divider my-12" />

            {/* 7. Engagement Model */}
            <Reveal direction="up" delay={0.1}>
              <section>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
                  Engagement model
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-6">
                  The same engagement models used across our cloud work apply to
                  AWS-focused initiatives.
                </p>
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

            {/* 8. Ideal Clients */}
            <Reveal direction="up" delay={0.1}>
              <section>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
                  Ideal clients
                </h2>
                <ul className="space-y-2 text-sm text-zinc-300">
                  {idealClientsCloud.map((item) => (
                    <li key={item} className="flex items-start">
                      <span className="text-violet-400 mr-2 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>

            {/* Scope and boundaries */}
            <WhatWeDoNotDo focusItems={whatWeFocusOn} notDoItems={whatWeDoNotDo} />

            <div className="section-divider my-12" />

            {/* 9. FAQ */}
            <Reveal direction="up" delay={0.1}>
              <section>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
                  FAQ
                </h2>
                <FAQAccordion items={cloudFAQ} />
              </section>
            </Reveal>

            {/* 10. CTA */}
            <CTASection
              title="Let's build a reliable AWS platform."
              subtitle="Talk to us about your AWS foundations, CI/CD, cost, or operations. We'll help you chart a practical path."
              primaryLabel="Book a Call"
              primaryHref="/contact"
              secondaryLabel="Run Axiom"
              secondaryHref="/auth/signup?redirect=/dashboard/connect-cloud"
              plansHref="/operator/pricing"
            />

            {/* Navigation to related pages */}
            <section>
              <div className="mt-8 text-xs text-zinc-400 flex flex-wrap gap-4">
                <Link
                  href="/cloud-solutions"
                  className="underline underline-offset-4 hover:text-violet-400"
                >
                  Back to Cloud Solutions overview
                </Link>
                <Link
                  href="/cloud-solutions/azure"
                  className="underline underline-offset-4 hover:text-violet-400"
                >
                  View Azure Cloud Solutions
                </Link>
                <Link
                  href="/contact"
                  className="underline underline-offset-4 hover:text-violet-400"
                >
                  Talk to us about AWS
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Floating blur orbs */}
      <div className="ambient-drift absolute bottom-1/4 left-10 w-[380px] h-[340px] bg-brand-violet/[0.08] rounded-full blur-[120px] pointer-events-none" />
      <div className="ambient-drift absolute top-1/2 right-0 w-[420px] h-[360px] bg-brand-coral/[0.06] rounded-full blur-[130px] pointer-events-none" style={{ animationDelay: "-8s" }} />
      <div className="ambient-drift absolute top-1/4 right-1/3 w-[340px] h-[260px] bg-cyan-500/[0.04] rounded-full blur-[110px] pointer-events-none" style={{ animationDelay: "-14s" }} />
    </div>
  );
}
