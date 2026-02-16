import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CloudIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "AWS & DevOps Services | Vision XIX Labs",
  description:
    "AWS cloud infrastructure, CI/CD with GitHub and Octopus Deploy, cost optimization, reliability, and security services from Vision XIX Labs.",
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

type ProcessStepProps = {
  step: string;
  title: string;
  description: string;
};

function ProcessStep({ step, title, description }: ProcessStepProps) {
  return (
    <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 h-full">
      <div className="inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 text-xs font-semibold mb-3">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

function CTASection() {
  return (
    <section className="py-16">
      <div className="max-w-4xl mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl px-8 py-12 text-center text-white shadow-2xl">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Let&apos;s talk about your AWS roadmap.
        </h2>
        <p className="text-base md:text-lg text-indigo-100 mb-8">
          Whether you&apos;re just starting on AWS or modernizing an existing
          platform, we help you move faster with confidence across cloud
          infrastructure, CI/CD, cost optimization, reliability, and security.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Book a Call
          </Link>
          <a
            href="mailto:support@visionxixlabs.com"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl border border-indigo-200/70 bg-indigo-700/40 text-white font-semibold hover:bg-indigo-700/70 hover:-translate-y-0.5 transition-all"
          >
            Email Us
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

const processSteps: ProcessStepProps[] = [
  {
    step: "01",
    title: "Discover",
    description:
      "We listen first—understanding your products, teams, and AWS landscape so we can focus on what matters most to the business.",
  },
  {
    step: "02",
    title: "Plan",
    description:
      "We define a clear roadmap with priorities, scope, and measurable outcomes across infrastructure, CI/CD, cost, reliability, and security.",
  },
  {
    step: "03",
    title: "Implement",
    description:
      "We work alongside your team to implement changes in small, safe increments that can be rolled out and adopted quickly.",
  },
  {
    step: "04",
    title: "Optimize",
    description:
      "We refine based on data—tuning cost, performance, and processes so improvements stick and continue to deliver value.",
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Home
          </Link>
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/services"
              className="text-indigo-600 dark:text-indigo-400"
            >
              Services
            </Link>
            <Link
              href="/contact"
              className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <section className="mb-16 text-center">
            <p className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 mb-6">
              <span>AWS &amp; DevOps Consulting</span>
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              AWS Cloud &amp; DevOps Solutions
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              We help engineering teams design reliable AWS cloud infrastructure,
              build practical CI/CD with GitHub and Octopus Deploy, control cloud
              costs, and improve reliability and security without slowing down
              delivery.
            </p>
          </section>

          {/* Services */}
          <section aria-labelledby="services-heading" className="mb-16">
            <div className="mb-10 text-center">
              <h2
                id="services-heading"
                className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3"
              >
                Solutions we deliver
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Clear, outcome‑focused AWS and DevOps services grouped into
                practical workstreams—so you know exactly where we can help.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              {services.map((service) => (
                <ServiceCard key={service.id} {...service} />
              ))}
            </div>
          </section>

          {/* How we work */}
          <section aria-labelledby="process-heading" className="mb-8">
            <div className="mb-8 text-center">
              <h2
                id="process-heading"
                className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3"
              >
                How we work
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                A simple, transparent delivery approach that connects technical
                decisions to business outcomes at every step.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-4">
              {processSteps.map((step) => (
                <ProcessStep key={step.step} {...step} />
              ))}
            </div>
          </section>

          {/* CTA */}
          <CTASection />
        </div>
      </main>
    </div>
  );
}

