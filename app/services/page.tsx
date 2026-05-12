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
          Discuss your requirements.
        </h2>
        <p className="text-zinc-400 mb-6 text-sm">
          For infrastructure, CI/CD, cost optimization, or security--we work with technical leads to define scope and delivery.
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
      "Modern, GitHub-centric delivery pipelines that make shipping changes routine instead of risky.",
    items: [
      "CI workflows built around GitHub Actions and your branching model",
      "Octopus Deploy release pipelines and promotion strategies",
      "Environment consistency across dev, test, staging, and prod",
      "Release automation that fits regulatory and change-management needs",
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
      "Assessment to identify waste and right-size workloads",
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
      "Incident reduction through SLA/SLO-driven best practices",
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
      "Production-grade AI systems deployed inside your cloud: architecture, integration, and operations--not research or hype.",
    items: [
      "Architecture and strategy for LLM systems and AI-assisted workflows",
      "Integration of models with your data, APIs, and internal applications",
      "Deployment of AI services in your AWS, Azure, or GCP accounts with CI/CD and observability",
    ],
    outcomes: [
      "AI that fits your existing cloud, security, and delivery practices",
      "Clear ownership and runbooks for AI workloads",
      "Predictable, governed AI usage instead of one-off demos",
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none" />
      <div className="bg-dots absolute inset-0 pointer-events-none" />
      <Navigation />

      <main className="pt-20 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto">
          {/* 1. Overview */}
          <Reveal direction="up" blur>
            <section className="mb-12" aria-labelledby="overview-heading">
              <h1 id="overview-heading" className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-[-0.04em] leading-[1.05]">
                Cloud &amp; AI Engineering.<br className="hidden sm:block" />
                <span className="text-zinc-500">Services that ship.</span>
              </h1>
              <p className="text-lg text-zinc-400 max-w-3xl">
                We design and implement AWS infrastructure, CI/CD with GitHub and Octopus Deploy, AI integration, cost optimization, reliability, and security--with clear deliverables and handover.
              </p>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          {/* 1b. Common gaps we close */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-16 glass-card rounded-xl border border-white/[0.06] p-6 animated-border card-inner-glow card-shine-sweep card-reactive" aria-labelledby="gaps-heading">
              <h2 id="gaps-heading" className="text-lg font-bold text-white mb-4 tracking-[-0.04em]">
                Common gaps we close
              </h2>
              <p className="text-sm text-zinc-400 mb-4 max-w-3xl">
                Companies often struggle with: scale-up beyond pilots, digital maturity, technical capacity, strategy focus, and skills/governance. We help address these so cloud and AI deliver tangible value.
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
              <h2 id="services-heading" className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-[-0.04em]">
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
              <div className="glass-card rounded-2xl p-6 md:p-8 shadow-xl border border-white/[0.06] glow-border-card">
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
              <h2 id="engagement-heading" className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-[-0.04em]">
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
              <h2 id="faq-heading" className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-[-0.04em]">
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
