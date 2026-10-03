import type { Metadata } from "next";
import Link from "next/link";
import {
  CloudIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
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
import { ServicesGrid } from "@/components/ServicesGrid";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Cloud & AI Engineering Services",
  description:
    "Cloud & AI engineering: AWS infrastructure, CI/CD with GitHub and Octopus Deploy, production AI integration, cost optimization, reliability, and security.",
  openGraph: { url: "https://visionxixlabs.com/services" },
  alternates: { canonical: "https://visionxixlabs.com/services" },
};

function CTASection() {
  return (
    <section className="py-12">
      <div className="max-w-3xl mx-auto glass-card rounded-xl border border-white/[0.06] px-6 py-8 text-center glow-border-card">
        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2 tracking-[-0.04em]">
          Map your infrastructure gaps.
        </h2>
        <p className="text-zinc-400 mb-6 text-sm">
          We audit AWS spend, harden CI/CD pipelines, and build landing zones that sustain growth — without slowing team velocity.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <AnimatedButton href="/contact" variant="primary">
            Contact Us
          </AnimatedButton>
          <AnimatedButton
            href="mailto:support@visionxixlabs.com"
            variant="ghost"
          >
            Email
          </AnimatedButton>
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
      "From zero to production-directed AWS: landing zones, multi-account isolation, cost guardrails, and deployment velocity that doesn't sacrifice security.",
    items: [
      "Architecture guidance for core AWS services and landing zones",
      "Design, provisioning, and scaling of cloud infrastructure",
      "EC2 and EBS patterns aligned to workload needs",
      "Networking foundations with VPC patterns, routing, and security groups",
    ],
    outcomes: [
      "Production-ready infrastructure in weeks, not quarters",
      "Predictable deployments every 15–30 minutes",
      "Production incidents reduced 60%+ via shift-left testing",
    ],
  },
  {
    id: "cicd-release-automation",
    icon: ArrowPathIcon,
    title: "CI/CD & Release Automation",
    description:
      "GitHub Actions + Octopus Deploy pipelines that turn 4-hour deploys into 20-minute releases with full rollback safety.",
    items: [
      "CI workflows built around GitHub Actions and your branching model",
      "Octopus Deploy release pipelines and promotion strategies",
      "Environment consistency across dev, test, staging, and prod",
      "Release automation that fits regulatory and change-management needs",
    ],
    outcomes: [
      "Deploy with confidence — approval gates, staged rollout, automatic rollback",
      "Environment parity across dev, staging, and production",
      "Ship daily instead of weekly — measurable velocity improvement",
    ],
  },
  {
    id: "cost-optimization",
    icon: BanknotesIcon,
    title: "Cost Optimization (FinOps)",
    description:
      "FinOps automation: identify waste, right-size compute and storage, enforce budgets at the IAM level — measurable savings within 30 days.",
    items: [
      "Assessment to identify waste and right-size workloads",
      "Storage and compute optimization including EBS lifecycle and EC2 sizing",
      "Budgeting, guardrails, and reporting tuned to your finance cadence",
    ],
    outcomes: [
      "30–40% cloud spend reduction in the first optimization cycle",
      "Cost visibility per team, per service, per environment",
      "Budget guardrails that prevent overruns before they happen",
    ],
  },
  {
    id: "reliability-observability",
    icon: ChartBarIcon,
    title: "Reliability & Observability",
    description:
      "SLO-driven observability, incident runbooks, and alert fatigue reduction — response time that scales with traffic.",
    items: [
      "Monitoring and alerting strategy aligned to business impact",
      "Centralized logging and operational dashboards",
      "Incident reduction through SLA/SLO-driven best practices",
    ],
    outcomes: [
      "MTTR reduced from hours to minutes with structured incident response",
      "Alert fatigue eliminated — only actionable, business-impact signals",
      "Measurable SLO tracking tied to customer experience metrics",
    ],
  },
  {
    id: "security-governance",
    icon: ShieldCheckIcon,
    title: "Security & Governance",
    description:
      "Security and governance patterns that scale with your organization without slowing teams down.",
    items: [
      "High-level IAM best practices and access patterns",
      "Policy guardrails and compliance-ready configuration baselines",
      "Secure deployment practices embedded into CI/CD pipelines",
    ],
    outcomes: [
      "Reduced security and compliance risk",
      "Controlled, auditable access across teams and accounts",
      "Pipelines that ship securely by default",
    ],
  },
  {
    id: "ai-engineering-llm-systems",
    icon: SparklesIcon,
    title: "AI Engineering & LLM Systems",
    description:
      "AI systems that ship: secure isolation, cost tracking per model, audit trails for regulatory compliance, and autonomous cost guardrails.",
    items: [
      "Architecture and strategy for LLM systems and AI-assisted workflows",
      "Integration of models with your data, APIs, and internal applications",
      "Deployment of AI services in your AWS, Azure, or GCP accounts with CI/CD and observability",
    ],
    outcomes: [
      "AI workloads governed by your existing security and compliance frameworks",
      "Cost visibility per model — no surprise bills from runaway inference",
      "Production runbooks and incident response for AI-specific failure modes",
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Huly aurora — coral × violet × cyan */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none" />
      <div className="bg-dots absolute inset-0 pointer-events-none" />
      <div className="ambient-drift absolute -top-40 left-1/4 w-[520px] h-[460px] rounded-full bg-brand-violet/[0.08] blur-[140px] pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute top-1/4 right-[5%] w-[420px] h-[340px] rounded-full bg-brand-coral/[0.06] blur-[120px] pointer-events-none" style={{ animationDelay: "-8s" }} aria-hidden />
      <div className="ambient-drift absolute bottom-32 left-[5%] w-[360px] h-[280px] rounded-full bg-cyan-500/[0.04] blur-[110px] pointer-events-none" style={{ animationDelay: "-14s" }} aria-hidden />
      <Navigation />

      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          {/* 1. Overview — Huly numbered + coral underline */}
          <Reveal direction="up" blur>
            <section className="mb-12" aria-labelledby="overview-heading">
              <p className="mono-label mb-4 inline-flex items-center gap-3">
                <span className="text-brand-coral/90 tabular-nums">SV</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                Services
              </p>
              <h1 id="overview-heading" className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.04]">
                Cloud &amp; AI Engineering.<br className="hidden sm:block" />
                <span className="relative inline-block">
                  Measurable outcomes.
                  <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
                </span>
              </h1>
              <p className="text-lg text-zinc-400 max-w-3xl">
                We build AWS landing zones, automate CI/CD with GitHub Actions and Octopus Deploy, harden security posture, and cut cloud spend — with defined deliverables, measurable results, and full handover.
              </p>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          {/* 1b. Common gaps we close */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16 surface-glass rounded-xl p-6" aria-labelledby="gaps-heading">
              <h2 id="gaps-heading" className="text-lg font-bold text-white mb-4 tracking-[-0.04em]">
                Where teams get stuck
              </h2>
              <p className="text-sm text-zinc-400 mb-4 max-w-3xl">
                Stuck at 4-hour deployments? AWS bill growing 20% monthly? Security findings piling up with no remediation plan? We instrument, automate, and fix — with measurable before/after results.
              </p>
              <Link
                href="/cloud-solutions"
                className="text-sm font-semibold text-violet-400 hover:underline"
              >
                View cloud solutions →
              </Link>
            </section>
          </Reveal>

          {/* 2. Technical Scope -- service areas */}
          <Reveal direction="up" delay={0.1}>
            <section aria-labelledby="services-heading" className="mb-16">
              <h2 id="services-heading" className="font-display text-4xl md:text-5xl font-bold text-white mb-6 leading-[1.04]">
                Technical scope.<br className="hidden sm:block" />
                <span className="text-zinc-500">Outcome-focused workstreams.</span>
              </h2>
              <p className="text-zinc-400 mb-8 max-w-3xl">
                Outcome-focused workstreams: infrastructure, CI/CD, FinOps, observability, security, and production AI integration. Each with defined deliverables and outcomes.
              </p>
              <ServicesGrid services={services} />
            </section>
          </Reveal>

          <div className="section-divider my-16" />

          {/* AI-focused services overview */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16" aria-labelledby="ai-services-heading">
              <div className="surface-frost rounded-2xl p-6 md:p-8">
                <h2 id="ai-services-heading" className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-[-0.04em]">
                  AI engineering.<br className="hidden sm:block" />
                  <span className="text-zinc-500">As part of your platform.</span>
                </h2>
                <p className="text-sm md:text-base text-zinc-300 mb-4 max-w-3xl">
                  We do not build new foundation models. We engineer AI systems for production environments:
                  secure, observable, and cost-aware AI workloads that live alongside your existing services.
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <AnimatedButton
                    href="/axiom"
                    variant="primary"
                  >
                    Axiom Agent Platform
                  </AnimatedButton>
                  <AnimatedButton
                    href="/cloud-solutions"
                    variant="ghost"
                  >
                    Multi-Cloud Solutions
                  </AnimatedButton>
                </div>
              </div>
            </section>
          </Reveal>

          <TechnicalSection {...cloudArchitectureSection} />
          <TechnicalSection {...devOpsSection} />

          {/* 3. Architecture Approach */}
          <ArchitectureBlock title="Engineering principles" principles={engineeringPrinciples} />

          {/* 4. Tooling & Stack */}
          <TechStackSection title="Tooling & stack" groups={techStackGroups} />

          <div className="section-divider my-16" />

          {/* 5. Implementation Methodology */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16" aria-labelledby="methodology-heading">
              <h2 id="methodology-heading" className="text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-[-0.04em]">
                Implementation methodology.<br className="hidden sm:block" />
                <span className="text-zinc-500">Structured delivery.</span>
              </h2>
              <p className="text-zinc-400 mb-8 max-w-3xl">
                {implementationMethodologyShort}
              </p>
              <HowWeWorkSection phases={howWeWorkPhases} />
            </section>
          </Reveal>

          {/* 6. Deliverables */}
          <DeliverableList title="Deliverables" items={coreDeliverables} />

          {/* 7. Security & Governance Model */}
          <SecurityAccessSection
            weDoNot={securityAccessWeDoNot}
            weOperateUsing={securityAccessWeOperateUsing}
            blocks={securityAccessBlocks}
          />

          <div className="section-divider my-16" />

          {/* 8. Engagement Model */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16" aria-labelledby="engagement-heading">
              <h2 id="engagement-heading" className="font-display text-4xl md:text-5xl font-bold text-white mb-6 leading-[1.04]">
                Engagement model.<br className="hidden sm:block" />
                <span className="text-zinc-500">Flexible, scoped, documented.</span>
              </h2>
              <p className="text-zinc-400 mb-8 max-w-3xl">
                Project-based, retainer, or assessment and roadmap. We align to your timeline and team structure.
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

          {/* 9. Ideal Clients */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16" aria-labelledby="ideal-clients-heading">
              <h2 id="ideal-clients-heading" className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
                Ideal clients
              </h2>
              <ul className="space-y-2 text-zinc-400">
                {idealClientsCloud.map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="text-violet-400 mr-2 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <div className="section-divider my-16" />

          {/* 10. FAQ */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16" aria-labelledby="faq-heading">
              <h2 id="faq-heading" className="font-display text-4xl md:text-5xl font-bold text-white mb-6 leading-[1.04]">
                Frequently asked questions.
              </h2>
              <FAQAccordion items={cloudFAQ} />
            </section>
          </Reveal>

          {/* 11. CTA */}
          <CTASection />
        </div>
      </main>

      <Footer />

      {/* Floating blur orbs */}
      <div className="absolute bottom-1/4 left-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
