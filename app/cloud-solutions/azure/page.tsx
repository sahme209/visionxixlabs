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
  title: "Azure Cloud Solutions | Vision XIX Labs",
  description:
    "Azure cloud solutions to design, automate, optimize, and operate your platform. Landing zones, networking, CI/CD, cost management, observability, identity, governance, and DR.",
};

export default function AzureCloudSolutionsPage() {
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
                Azure
              </li>
            </ol>
          </nav>

          {/* 1. Overview */}
          <section id="overview" className="mb-12" aria-labelledby="overview-heading">
            <h1 id="overview-heading" className="text-3xl md:text-4xl font-extrabold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Azure Cloud Solutions
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mb-4">
              Design, automate, optimize, and operate on Azure with patterns
              that work in real engineering environments.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
              We help structure subscriptions, networking, CI/CD, observability,
              identity, governance, and disaster recovery in a way that your
              teams can own and evolve.
            </p>
          </section>

          <div className="space-y-10">
            {/* 2. Technical Scope */}
            <h2 id="technical-scope" className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Technical scope
            </h2>
            {/* Azure Landing Zone / subscription structure */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Azure landing zone &amp; subscription structure
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We design Azure landing zones and subscription structures that
                give you clear boundaries for environments, teams, and
                workloads.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* Azure Networking */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Azure networking
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We help define VNet, subnet, and routing concepts that keep
                services connected and secure without unnecessary complexity.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* Compute & Storage */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Compute &amp; Storage
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We guide VM and managed disk usage so workloads have appropriate
                performance, resilience, and cost characteristics.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* CI/CD */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                CI/CD on Azure
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We implement CI/CD using GitHub Actions or Azure DevOps pipelines
                and can integrate with Octopus Deploy where it makes sense.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* Cost Management */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Cost management &amp; optimization
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We make use of Azure Cost Management capabilities to analyze
                spend and shape usage, budgets, and alerts.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* Observability */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Observability
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We help set up monitoring using Azure Monitor and Log Analytics
                concepts at a high level, aligned to your existing tools where
                appropriate.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* Identity & Governance */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Identity &amp; Governance
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We apply Entra ID, RBAC, and policy concepts so access is
                controlled and auditable while remaining workable for
                engineering teams.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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

            {/* DR */}
            <section>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                DR &amp; resilience
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                We help you use Azure Backup and site recovery concepts at a
                high level to meet realistic recovery objectives.
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
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
                Our engagement models apply equally to Azure-focused work and
                hybrid cloud initiatives.
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
              title="Let's build a reliable Azure platform."
              subtitle="Talk to us about your Azure landing zone, CI/CD, cost, or operations. We'll help you chart a practical path."
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
                  href="/cloud-solutions/aws"
                  className="underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  View AWS Cloud Solutions
                </Link>
                <Link
                  href="/contact"
                  className="underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Talk to us about Azure
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

