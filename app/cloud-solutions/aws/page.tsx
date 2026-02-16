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

export const metadata: Metadata = {
  title: "AWS Cloud Solutions | Vision XIX Labs",
  description:
    "AWS cloud solutions to design, automate, optimize, and operate your platform. Foundations, CI/CD with GitHub and Octopus Deploy, cost optimization, reliability, security, and DR.",
};

export default function AwsCloudSolutionsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
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
              <li>
                <Link
                  href="/cloud-solutions"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400"
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

          {/* 1. Overview */}
          <section id="overview" className="mb-12" aria-labelledby="overview-heading">
            <h1 id="overview-heading" className="text-3xl md:text-4xl font-extrabold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              AWS Cloud Solutions
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mb-4">
              Design, automate, optimize, and operate on AWS with an
              engineering-first delivery approach that balances speed, safety,
              and cost.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
              We focus on practical patterns you can run in production—from
              foundations and CI/CD through to FinOps, observability, security,
              and disaster recovery.
            </p>
          </section>

          <div className="space-y-10">
            {/* 2. Technical Scope */}
            <h2 id="technical-scope" className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Technical scope
            </h2>
            {/* AWS Cloud Foundations */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                AWS Cloud Foundations
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We design AWS landing zones, account structures, and VPC
                patterns that give your teams a consistent, secure baseline to
                build on.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* Compute & Storage */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Compute &amp; Storage
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We help shape EC2, EBS, and related services so workloads have
                the right balance of performance, resilience, and cost.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* CI/CD with GitHub + Octopus Deploy */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                CI/CD with GitHub &amp; Octopus Deploy
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We build CI workflows around GitHub and deployment pipelines
                using Octopus Deploy, tuned to your branching and release
                strategy.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* FinOps & Cost Optimization */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                FinOps &amp; Cost Optimization
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We review AWS usage to identify waste, right-size resources, and
                put in place simple guardrails so spend stays predictable.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* Observability */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Observability
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We help define metrics, logs, and traces approaches so
                production issues are surfaced quickly and consistently.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* Security & Governance */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Security &amp; Governance
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We apply IAM and policy patterns that favor least privilege while
                staying practical for day-to-day engineering work.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* DR & Resiliency */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                DR &amp; Resiliency
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We help define and implement backup and recovery approaches that
                match your recovery objectives and budget.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* 3. Architecture Approach */}
            <ArchitectureBlock title="Engineering principles" principles={engineeringPrinciples} />

            {/* 4. Tooling & Stack */}
            <TechStackSection title="Tooling & stack" groups={techStackGroups} />

            {/* 5. Implementation Methodology */}
            <section id="implementation-methodology">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Implementation methodology
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
                {implementationMethodologyShort}
              </p>
            </section>

            {/* 6. Deliverables */}
            <DeliverableList title="Deliverables" items={coreDeliverables} />

            {/* 7. Engagement Model */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                Engagement model
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-6">
                The same engagement models used across our cloud work apply to
                AWS-focused initiatives.
              </p>
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

            {/* 8. Ideal Clients */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                Ideal clients
              </h2>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {idealClientsCloud.map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="text-indigo-500 mr-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* Scope and boundaries */}
            <WhatWeDoNotDo focusItems={whatWeFocusOn} notDoItems={whatWeDoNotDo} />

            {/* 9. FAQ */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                FAQ
              </h2>
              <FAQAccordion items={cloudFAQ} />
            </section>

            {/* 10. CTA */}
            <CTASection
              title="Let's build a reliable AWS platform."
              subtitle="Talk to us about your AWS foundations, CI/CD, cost, or operations. We'll help you chart a practical path."
              primaryLabel="Book a Call"
              primaryHref="/contact"
              secondaryLabel="Email Us"
              secondaryHref="mailto:support@visionxixlabs.com"
            />

            {/* Navigation to related pages */}
            <section>
              <div className="mt-8 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-4">
                <Link
                  href="/cloud-solutions"
                  className="underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Back to Cloud Solutions overview
                </Link>
                <Link
                  href="/cloud-solutions/azure"
                  className="underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  View Azure Cloud Solutions
                </Link>
                <Link
                  href="/contact"
                  className="underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Talk to us about AWS
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

