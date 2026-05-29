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
  title: "Azure Cloud Solutions",
  description:
    "Azure cloud solutions to design, automate, optimize, and operate your platform. Landing zones, networking, CI/CD, cost management, observability, identity, governance, and DR.",
  keywords: ["Azure consulting", "Microsoft Azure", "Azure cloud", "Azure landing zone", "Azure CI/CD"],
  openGraph: { url: "https://visionxixlabs.com/cloud-solutions/azure" },
  alternates: { canonical: "https://visionxixlabs.com/cloud-solutions/azure" },
};

export default function AzureCloudSolutionsPage() {
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
                Azure
              </li>
            </ol>
          </nav>

          {/* 1. Overview — Huly numbered + coral underline */}
          <Reveal direction="up" blur>
            <section id="overview" className="mb-12" aria-labelledby="overview-heading">
              <p className="mono-label inline-flex items-center gap-3 mb-4">
                <span className="text-brand-coral/90 tabular-nums">AZ</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                Azure
              </p>
              <h1 id="overview-heading" className="font-display text-4xl md:text-5xl font-bold mb-3 leading-[1.04]">
                <span className="relative inline-block">
                  Azure Cloud Solutions
                  <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
                </span>
              </h1>
              <p className="text-lg md:text-xl text-zinc-400 max-w-3xl mb-4">
                Design, automate, optimize, and operate on Azure with patterns
                that work in real engineering environments.
              </p>
              <p className="text-sm text-zinc-400 max-w-3xl">
                We help structure subscriptions, networking, CI/CD, observability,
                identity, governance, and disaster recovery in a way that your
                teams can own and evolve.
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

            {/* Azure Landing Zone / subscription structure */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Azure landing zone &amp; subscription structure
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We design Azure landing zones and subscription structures that
                  give you clear boundaries for environments, teams, and
                  workloads.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    High-level subscription and management group strategies aligned
                    to your organization.
                  </li>
                  <li>
                    Baseline policies and configuration for security and
                    compliance.
                  </li>
                  <li>
                    Environment separation patterns that support safe releases and
                    testing.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* Azure Networking */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Azure networking
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We help define VNet, subnet, and routing concepts that keep
                  services connected and secure without unnecessary complexity.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    High-level VNet and subnet patterns for your core environments.
                  </li>
                  <li>
                    Routing and connectivity approaches for hybrid and cloud-only
                    setups.
                  </li>
                  <li>
                    Network security considerations that support least-privilege
                    access.
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
                  We guide VM and managed disk usage so workloads have appropriate
                  performance, resilience, and cost characteristics.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>VM sizing and family guidance for representative workloads.</li>
                  <li>
                    Managed disk strategies for performance and lifecycle
                    management.
                  </li>
                  <li>
                    High-level patterns for scale sets or PaaS options where
                    appropriate.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* CI/CD */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  CI/CD on Azure
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We implement CI/CD using GitHub Actions or Azure DevOps pipelines
                  and can integrate with Octopus Deploy where it makes sense.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    CI workflows for build, test, and validation using GitHub
                    Actions or Azure DevOps.
                  </li>
                  <li>
                    Deployment patterns for Azure resources and applications,
                    including Octopus Deploy where used.
                  </li>
                  <li>
                    Consistent promotion flows across dev, test, staging, and
                    production.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* Cost Management */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Cost management &amp; optimization
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We make use of Azure Cost Management capabilities to analyze
                  spend and shape usage, budgets, and alerts.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    Review of current Azure usage to identify optimization
                    opportunities.
                  </li>
                  <li>
                    Budget and alert configuration using Azure Cost Management.
                  </li>
                  <li>
                    Practical recommendations that teams can execute and maintain.
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
                  We help set up monitoring using Azure Monitor and Log Analytics
                  concepts at a high level, aligned to your existing tools where
                  appropriate.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    Monitoring and alerting baselines using Azure Monitor or
                    compatible tools.
                  </li>
                  <li>
                    Logging approaches that support troubleshooting and audit
                    needs.
                  </li>
                  <li>
                    Simple dashboards or views for key services and environments.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* Identity & Governance */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Identity &amp; Governance
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We apply Entra ID, RBAC, and policy concepts so access is
                  controlled and auditable while remaining workable for
                  engineering teams.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    High-level identity and access patterns using Entra ID and
                    RBAC.
                  </li>
                  <li>
                    Policy approaches that support compliance and guardrails
                    without blocking delivery.
                  </li>
                  <li>
                    Integration with existing identity and approval processes where
                    needed.
                  </li>
                </ul>
              </section>
            </Reveal>

            {/* DR */}
            <Reveal direction="up" delay={0.1}>
              <section className="glass-card rounded-2xl p-6 border border-white/[0.06] animated-border card-inner-glow">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  DR &amp; resilience
                </h2>
                <p className="text-sm md:text-base text-zinc-400 mb-3">
                  We help you use Azure Backup and site recovery concepts at a
                  high level to meet realistic recovery objectives.
                </p>
                <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                  <li>
                    Backup strategies for critical workloads, using Azure-native
                    options where appropriate.
                  </li>
                  <li>
                    Recovery planning and simple, testable runbooks.
                  </li>
                  <li>
                    High-level patterns for regional redundancy when required.
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
                  Our engagement models apply equally to Azure-focused work and
                  hybrid cloud initiatives.
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
              title="Let's build a reliable Azure platform."
              subtitle="Talk to us about your Azure landing zone, CI/CD, cost, or operations. We'll help you chart a practical path."
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
                  href="/cloud-solutions/aws"
                  className="underline underline-offset-4 hover:text-violet-400"
                >
                  View AWS Cloud Solutions
                </Link>
                <Link
                  href="/contact"
                  className="underline underline-offset-4 hover:text-violet-400"
                >
                  Talk to us about Azure
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
