import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CloudIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../../components/Navigation";

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

function TechnologiesSection() {
  const technologies = [
    { name: "AWS EC2", category: "Compute" },
    { name: "AWS EBS", category: "Storage" },
    { name: "AWS VPC", category: "Networking" },
    { name: "AWS IAM", category: "Security" },
    { name: "GitHub Actions", category: "CI/CD" },
    { name: "Octopus Deploy", category: "CI/CD" },
    { name: "CloudWatch", category: "Monitoring" },
    { name: "AWS Cost Explorer", category: "FinOps" },
  ];

  return (
    <section aria-labelledby="technologies-heading" className="mb-16">
      <div className="mb-10 text-center">
        <h2
          id="technologies-heading"
          className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3"
        >
          Technologies we work with
        </h2>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          We specialize in AWS services, GitHub workflows, and Octopus Deploy
          pipelines—the tools your teams already use or want to adopt.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {technologies.map((tech) => (
          <div
            key={tech.name}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
          >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {tech.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyChooseUsSection() {
  const reasons = [
    {
      icon: CheckCircleIcon,
      title: "Outcome-focused",
      description:
        "We measure success by business impact—faster deployments, lower costs, fewer incidents—not just technical metrics.",
    },
    {
      icon: ClockIcon,
      title: "Pragmatic approach",
      description:
        "We balance best practices with what works for your team and timeline, avoiding over-engineering.",
    },
    {
      icon: UserGroupIcon,
      title: "Team collaboration",
      description:
        "We work alongside your engineers, transferring knowledge so improvements stick after we&apos;re done.",
    },
    {
      icon: SparklesIcon,
      title: "Modern tooling",
      description:
        "We focus on GitHub, Octopus Deploy, and AWS services your teams already use or want to adopt.",
    },
  ];

  return (
    <section
      aria-labelledby="why-choose-heading"
      className="mb-16 bg-white dark:bg-slate-800 rounded-3xl p-8 md:p-12 shadow-xl border border-slate-200 dark:border-slate-700"
    >
      <div className="mb-10 text-center">
        <h2
          id="why-choose-heading"
          className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3"
        >
          Why choose Vision XIX Labs
        </h2>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          We bring a practical, collaborative approach to AWS and DevOps that
          focuses on real business outcomes.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {reasons.map((reason) => {
          const Icon = reason.icon;
          return (
            <div
              key={reason.title}
              className="flex gap-4 p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex-shrink-0">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {reason.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {reason.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    {
      question: "What size teams do you typically work with?",
      answer:
        "We work with teams of all sizes—from startups building their first AWS infrastructure to larger organizations modernizing existing platforms. Our approach scales to fit your team structure and needs.",
    },
    {
      question: "Do you work with teams outside of AWS?",
      answer:
        "While we specialize in AWS, we also help teams using GitHub Actions and Octopus Deploy regardless of cloud provider. Our CI/CD and DevOps practices apply across environments.",
    },
    {
      question: "How long do typical engagements last?",
      answer:
        "Engagements vary based on scope. Some projects are 2–4 weeks for specific improvements, while others are ongoing partnerships. We can work in sprints, retainer models, or project-based arrangements.",
    },
    {
      question: "Do you provide ongoing support after implementation?",
      answer:
        "Yes. We offer ongoing support, optimization, and training options. Many clients start with a focused project and then move to a retainer for continuous improvement and guidance.",
    },
    {
      question: "What if we already have some AWS infrastructure?",
      answer:
        "Perfect. We often help teams optimize and modernize existing AWS setups. We assess what you have, identify improvements, and implement changes incrementally to minimize risk.",
    },
    {
      question: "How do you handle security and compliance requirements?",
      answer:
        "We build security and governance into every engagement. We help establish IAM patterns, policy guardrails, and compliance-ready configurations that fit your regulatory needs.",
    },
  ];

  return (
    <section aria-labelledby="faq-heading" className="mb-16">
      <div className="mb-10 text-center">
        <h2
          id="faq-heading"
          className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3"
        >
          Frequently asked questions
        </h2>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Common questions about our AWS and DevOps services.
        </p>
      </div>
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="card-hover bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              {faq.question}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EngagementModelsSection() {
  const models = [
    {
      title: "Project-based",
      description:
        "Focused engagements for specific outcomes—like setting up CI/CD pipelines, optimizing costs, or improving reliability.",
      duration: "2–8 weeks",
    },
    {
      title: "Retainer",
      description:
        "Ongoing partnership for continuous improvement, guidance, and support as your AWS infrastructure evolves.",
      duration: "Ongoing",
    },
    {
      title: "Assessment & roadmap",
      description:
        "Quick assessment of your current setup with a prioritized roadmap for improvements you can execute internally or with our help.",
      duration: "1–2 weeks",
    },
  ];

  return (
    <section aria-labelledby="engagement-heading" className="mb-16">
      <div className="mb-10 text-center">
        <h2
          id="engagement-heading"
          className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3"
        >
          How we can work together
        </h2>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Flexible engagement models that fit your timeline, budget, and team
          structure.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {models.map((model) => (
          <div
            key={model.title}
            className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {model.title}
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                {model.duration}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {model.description}
            </p>
          </div>
        ))}
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
      <Navigation />

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
          <section aria-labelledby="process-heading" className="mb-16">
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

          {/* Technologies */}
          <TechnologiesSection />

          {/* Why Choose Us */}
          <WhyChooseUsSection />

          {/* Engagement Models */}
          <EngagementModelsSection />

          {/* FAQ */}
          <FAQSection />

          {/* CTA */}
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
              <p className="text-slate-400">
                AWS cloud infrastructure, CI/CD, and DevOps solutions that help
                teams move faster with confidence.
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
                    AWS Services
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

