import type { Metadata } from "next";
import Link from "next/link";
import {
  CloudIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../../components/Navigation";
import {
  cloudArchitectureSection,
  devOpsSection,
  engineeringPrinciples,
  coreDeliverables,
  idealClientsCloud,
  techStackGroups,
  howWeWorkPhases,
  implementationMethodologyShort,
  securityAccessWeDoNot,
  securityAccessWeOperateUsing,
  securityAccessBlocks,
} from "@/lib/engineeringContent";
import { engagementPackages, cloudFAQ } from "@/lib/cloudContent";
import { TechnicalSection } from "@/components/TechnicalSection";
import { ArchitectureBlock } from "@/components/ArchitectureBlock";
import { DeliverableList } from "@/components/DeliverableList";
import { TechStackSection } from "@/components/TechStackSection";
import { SecurityAccessSection } from "@/components/SecurityAccessSection";
import { HowWeWorkSection } from "@/components/HowWeWorkSection";
import { FAQAccordion } from "@/components/FAQAccordion";
import { PackageCard } from "@/components/PackageCard";

export const metadata: Metadata = {
  title: "AWS & DevOps Services",
  description:
    "AWS cloud infrastructure, CI/CD with GitHub and Octopus Deploy, cost optimization, reliability, and security. Enterprise-grade delivery.",
  openGraph: { url: "https://visionxixlabs.com/services" },
  alternates: { canonical: "https://visionxixlabs.com/services" },
};

type ServiceCardProps = {
  icon: React.ElementType;
  title: string;
  description: string;
  items: string[];
  outcomes: string[];
};

function ServiceCard({
  icon: Icon,
  title,
  description,
  items,
  outcomes,
}: ServiceCardProps) {
  return (
    <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-full">
      <div className="flex items-start gap-4 mb-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-400 flex-1">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
            What we deliver
          </p>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Outcomes
          </p>
          <ul className="space-y-1">
            {outcomes.map((outcome) => (
              <li key={outcome} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CTASection() {
  return (
    <section className="py-12">
      <div className="max-w-3xl mx-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-6 py-8 text-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Discuss your AWS or DevOps requirements
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
          For infrastructure, CI/CD, cost optimization, or security—we work with technical leads to define scope and delivery.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/contact"
            className="inline-flex items-center px-6 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Contact
          </Link>
          <a
            href="mailto:support@visionxixlabs.com"
            className="inline-flex items-center px-6 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-sm hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
          >
            Email
          </a>
        </div>
      </div>
    </section>
  );
}

const services = [
  {
    id: "aws-cloud-infrastructure",
    icon: CloudIcon,
    title: "AWS Cloud Infrastructure",
    description:
      "Design and evolution of a stable, scalable AWS foundation that supports your products and teams.",
    items: [
      "Architecture guidance for core AWS services and landing zones",
      "Design, provisioning, and scaling of cloud infrastructure",
      "EC2 and EBS patterns aligned to workload needs",
      "Networking foundations with VPC patterns, routing, and security groups",
    ],
    outcomes: [
      "Stable, scalable cloud infrastructure",
      "Faster, more predictable deployments",
      "Fewer production incidents and surprises",
    ],
  },
  {
    id: "cicd-release-automation",
    icon: ArrowPathIcon,
    title: "CI/CD & Release Automation",
    description:
      "Modern, GitHub‑centric delivery pipelines that make shipping changes routine instead of risky.",
    items: [
      "CI workflows built around GitHub Actions and your branching model",
      "Octopus Deploy release pipelines and promotion strategies",
      "Environment consistency across dev, test, staging, and prod",
      "Release automation that fits regulatory and change‑management needs",
    ],
    outcomes: [
      "Safer, more controlled releases",
      "Repeatable deployments across environments",
      "Reduced manual effort and deployment friction",
    ],
  },
  {
    id: "cost-optimization",
    icon: BanknotesIcon,
    title: "Cost Optimization (FinOps)",
    description:
      "Practical cloud cost optimization that keeps performance high while bringing AWS spend under control.",
    items: [
      "Assessment to identify waste and right‑size workloads",
      "Storage and compute optimization including EBS lifecycle and EC2 sizing",
      "Budgeting, guardrails, and reporting tuned to your finance cadence",
    ],
    outcomes: [
      "Lower and more efficient monthly AWS spend",
      "Predictable cloud costs for finance and leadership",
      "Optimized use of cloud resources over time",
    ],
  },
  {
    id: "reliability-observability",
    icon: ChartBarIcon,
    title: "Reliability & Observability",
    description:
      "Monitoring, logging, and operational practices that keep your services healthy and your teams informed.",
    items: [
      "Monitoring and alerting strategy aligned to business impact",
      "Centralized logging and operational dashboards",
      "Incident reduction through SLA/SLO‑driven best practices",
    ],
    outcomes: [
      "Faster detection of issues in production",
      "Quicker recovery when incidents do occur",
      "Improved uptime and customer experience",
    ],
  },
  {
    id: "security-governance",
    icon: ShieldCheckIcon,
    title: "Security & Governance",
    description:
      "Security and governance patterns that scale with your organization without slowing teams down.",
    items: [
      "High‑level IAM best practices and access patterns",
      "Policy guardrails and compliance‑ready configuration baselines",
      "Secure deployment practices embedded into CI/CD pipelines",
    ],
    outcomes: [
      "Reduced security and compliance risk",
      "Controlled, auditable access across teams and accounts",
      "Pipelines that ship securely by default",
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />

      <main className="pt-20 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* 1. Overview */}
          <section className="mb-12" aria-labelledby="overview-heading">
            <h1 id="overview-heading" className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              AWS Cloud &amp; DevOps Services
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl">
              We design and implement AWS infrastructure, CI/CD with GitHub and Octopus Deploy, cost optimization, reliability, and security—with clear deliverables and handover.
            </p>
          </section>

          {/* 2. Technical Scope — service areas */}
          <section aria-labelledby="services-heading" className="mb-16">
            <h2 id="services-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
              Technical scope
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-3xl">
              Outcome-focused workstreams: infrastructure, CI/CD, FinOps, observability, and security. Each with defined deliverables and outcomes.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {services.map((service) => (
                <ServiceCard key={service.id} {...service} />
              ))}
            </div>
          </section>

          <TechnicalSection {...cloudArchitectureSection} />
          <TechnicalSection {...devOpsSection} />

          {/* 3. Architecture Approach */}
          <ArchitectureBlock title="Engineering principles" principles={engineeringPrinciples} />

          {/* 4. Tooling & Stack */}
          <TechStackSection title="Tooling & stack" groups={techStackGroups} />

          {/* 5. Implementation Methodology */}
          <section className="mb-16" aria-labelledby="methodology-heading">
            <h2 id="methodology-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Implementation methodology
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-3xl">
              {implementationMethodologyShort}
            </p>
            <HowWeWorkSection phases={howWeWorkPhases} />
          </section>

          {/* 6. Deliverables */}
          <DeliverableList title="Deliverables" items={coreDeliverables} />

          {/* 7. Security & Governance Model */}
          <SecurityAccessSection
            weDoNot={securityAccessWeDoNot}
            weOperateUsing={securityAccessWeOperateUsing}
            blocks={securityAccessBlocks}
          />

          {/* 8. Engagement Model */}
          <section className="mb-16" aria-labelledby="engagement-heading">
            <h2 id="engagement-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
              Engagement model
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-3xl">
              Project-based, retainer, or assessment and roadmap. We align to your timeline and team structure.
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

          {/* 9. Ideal Clients */}
          <section className="mb-16" aria-labelledby="ideal-clients-heading">
            <h2 id="ideal-clients-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Ideal clients
            </h2>
            <ul className="space-y-2 text-slate-600 dark:text-slate-400">
              {idealClientsCloud.map((item) => (
                <li key={item} className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 10. FAQ */}
          <section className="mb-16" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
              Frequently asked questions
            </h2>
            <FAQAccordion items={cloudFAQ} />
          </section>

          {/* 11. CTA */}
          <CTASection />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8 mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <SparklesIcon className="h-6 w-6 text-indigo-400" />
                <span className="text-lg font-bold text-white">
                  Vision XIX Labs
                </span>
              </div>
              <p className="text-slate-400 text-sm">
                Cloud &amp; AI engineering. AWS, Azure, GCP — infrastructure, CI/CD, reliability, security.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    Services
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="mailto:support@visionxixlabs.com"
                    className="hover:text-indigo-400 transition-colors inline-flex items-center"
                  >
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    support@visionxixlabs.com
                  </a>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-400">
            <p>
              © {new Date().getFullYear()} Vision XIX Labs LLC. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

