"use client";

import Link from "next/link";
import Image from "next/image";
import {
  EnvelopeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  RocketLaunchIcon,
  CheckBadgeIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../components/Navigation";
import { EnterpriseTrustSignals } from "@/components/EnterpriseTrustSignals";
import { AnimateOnScroll } from "@/components/AnimateOnScroll";
import { ProductDemoShowcase } from "@/components/ProductDemoShowcase";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { HeroLightBeam } from "@/components/HeroLightBeam";
import { ServicePipeline } from "@/components/ServicePipeline";
import { CloudHealthSnapshotForm } from "@/components/CloudHealthSnapshotForm";
import { HeroHeadlineGlow } from "@/components/HeroHeadlineGlow";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { HoverCard } from "@/components/ui/HoverCard";

export default function Home() {

  const apps = [
    {
      id: "visanova",
      name: "VisaNova",
      tagline: "USCIS Case Tracker & Forecast",
      description:
        "Track and estimate your U.S. immigration case progress using recent approval trends and easy-to-understand insights. Get personalized timelines, trend charts, and service center insights.",
      icon: "/visanova-icon.png",
      appStoreUrl: "https://apps.apple.com/us/app/visanova/id6749717843",
      websiteUrl: "https://visanova.app",
      features: [
        "Personalized case timeline",
        "Trend charts & approval pace",
        "Service center insights",
        "Daily immigration highlights",
      ],
      color: "from-blue-600 to-indigo-700",
      badge: "Featured",
    },
    {
      id: "recallease",
      name: "RecallEase",
      tagline: "Health, Routine & Reminder",
      description:
        "Your personal health companion for managing routines, medications, and important reminders. Stay organized and never miss a beat with intelligent scheduling and notifications.",
      icon: "/recallease-icon.png",
      appStoreUrl: "https://apps.apple.com/us/app/recallease/id6754576974",
      websiteUrl: null,
      features: [
        "Health tracking",
        "Routine management",
        "Smart reminders",
        "Medication schedules",
      ],
      color: "from-purple-600 to-pink-600",
      badge: "New",
    },
    {
      id: "android",
      name: "Android Apps",
      tagline: "Coming Soon",
      description:
        "We're bringing our innovative apps to Android! Stay tuned for VisaNova and RecallEase on the Google Play Store.",
      icon: "🤖",
      appStoreUrl: null,
      websiteUrl: null,
      features: [
        "Full feature parity",
        "Cross-platform sync",
        "Native Android experience",
        "Coming 2025",
      ],
      color: "from-green-600 to-emerald-700",
      badge: "Coming Soon",
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
      <BackgroundBlobs />
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <HeroLightBeam />
        <div className="max-w-4xl mx-auto text-center relative">
          <Reveal direction="up" blur>
            <HeroHeadlineGlow />
          </Reveal>
          <Reveal direction="up" delay={0.06}>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-4 max-w-3xl mx-auto">
              Securely connect your cloud. Run real analysis. Approve safe fixes. No changes without your permission.
            </p>
          </Reveal>
          <Stagger delay={0.12}>
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <Link
                href="/cloud-operator"
                className="btn-huly cta-glow inline-flex items-center px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40"
              >
                Run Axiom
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/axiom"
                className="btn-huly inline-flex items-center px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-semibold shadow-lg hover:bg-slate-800 dark:hover:bg-slate-200"
              >
                See how it works
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </Stagger>
          <Reveal direction="up" delay={0.2}>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              No obligation · Read-only by default · No changes without your approval
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <Link
              href="/cloud-solutions/aws"
              className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-medium bg-white/80 dark:bg-slate-800/80 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-600 transition-all"
            >
              <span className="text-orange-600 dark:text-orange-400 font-semibold mr-1">AWS</span>
              Cloud
            </Link>
            <Link
              href="/cloud-solutions/azure"
              className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-medium bg-white/80 dark:bg-slate-800/80 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 transition-all"
            >
              <span className="text-blue-600 dark:text-blue-400 font-semibold mr-1">Azure</span>
              Cloud
            </Link>
            <Link
              href="/cloud-solutions/gcp"
              className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-medium bg-white/80 dark:bg-slate-800/80 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-red-300 dark:hover:border-red-600 transition-all"
            >
              <span className="text-red-600 dark:text-red-400 font-semibold mr-1">GCP</span>
              Cloud
            </Link>
          </div>
          <Reveal direction="up" delay={0.24}>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              Foundations · CI/CD · FinOps · Observability · Security · IaC
            </p>
          </Reveal>
          <Reveal direction="up" delay={0.3}>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              <li className="flex items-center gap-1.5">✓ Assume-role model (no stored access keys)</li>
              <li className="flex items-center gap-1.5">✓ AES-256-GCM encrypted credentials</li>
              <li className="flex items-center gap-1.5">✓ Explicit approval required before execution</li>
              <li className="flex items-center gap-1.5">✓ Execution logs &amp; audit trail</li>
              <li className="flex items-center gap-1.5">✓ Read-only by default</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Product demos — Axiom first */}
      <ProductDemoShowcase />

      {/* Outcome cards — what we deliver */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <Reveal direction="up">
              <HoverCard className="p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Reliability (SLO-first)</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  We build for uptime targets and observability, not wishful thinking.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>SLO/SLI definitions and dashboards</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Alerting and incident response patterns</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Runbooks and operational handover</li>
                </ul>
              </HoverCard>
            </Reveal>
            <Reveal direction="up" delay={0.06}>
              <HoverCard className="p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Security &amp; Governance</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Access control, baselines, and hardening focused on real risk reduction.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>IAM, landing zones, network segmentation</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Compliance-ready patterns (SOC2, HIPAA)</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Visibility and audit logging</li>
                </ul>
              </HoverCard>
            </Reveal>
            <Reveal direction="up" delay={0.12}>
              <HoverCard className="p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Cost Efficiency (FinOps)</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Right-sized resources, reserved capacity, and cost allocation you can act on.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Cost attribution and tagging strategy</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Savings plans and committed use</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Anomaly detection and guardrails</li>
                </ul>
              </HoverCard>
            </Reveal>
          </div>
        </div>
      </section>

      <EnterpriseTrustSignals />

      {/* Service Pipeline — Huly MetaBrain-style: connected services */}
      <AnimateOnScroll>
        <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-center text-lg font-semibold text-slate-700 dark:text-slate-300 mb-6">
              Everything connected in one flow
            </h2>
            <ServicePipeline />
          </div>
        </section>
      </AnimateOnScroll>

      {/* AI Capabilities — production-grade AI positioning */}
      <AnimateOnScroll>
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/60 dark:bg-slate-900/80 backdrop-blur border-t border-slate-200/80 dark:border-slate-700/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              Production systems, not demos
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              We build internal assistants, automation, and extraction workflows that run safely inside your cloud.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center mb-10">
            <div className="card-hover rounded-2xl p-4 bg-white/80 dark:bg-slate-800/60 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Internal AI</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Knowledge copilots</div>
            </div>
            <div className="card-hover rounded-2xl p-4 bg-white/80 dark:bg-slate-800/60 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">RAG</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Vector search & retrieval</div>
            </div>
            <div className="card-hover rounded-2xl p-4 bg-white/80 dark:bg-slate-800/60 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Automation</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Workflow & classification</div>
            </div>
            <div className="card-hover rounded-2xl p-4 bg-white/80 dark:bg-slate-800/60 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Extraction</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Docs, forms, invoices</div>
            </div>
            <div className="card-hover rounded-2xl p-4 bg-white/80 dark:bg-slate-800/60 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Governance</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Security & cost controls</div>
            </div>
            <div className="card-hover rounded-2xl p-4 bg-white/80 dark:bg-slate-800/60 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 shadow-sm">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">AWS · Azure · GCP</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Your cloud, your data</div>
            </div>
          </div>
          <div className="text-center">
            <Link
              href="/ai-solutions"
              className="inline-flex items-center text-violet-600 dark:text-violet-400 font-semibold hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              Explore AI Solutions
              <ArrowRightIcon className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* Capabilities summary — cloud + AI */}
      <AnimateOnScroll>
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">AWS</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Cloud platforms</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Azure</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Cloud platforms</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">GCP</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Cloud platforms</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">AI + IaC</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Production AI · Infrastructure</div>
            </div>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* Solutions / Services Overview */}
      <AnimateOnScroll>
      <section
        id="solutions"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900"
        aria-labelledby="solutions-heading"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 id="solutions-heading" className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Multi-cloud engineering solutions
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              We design, automate, and operate cloud platforms across AWS, Azure, and Google Cloud with a focus on reliability, security, and cost efficiency.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="card-hover rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none">
              <div>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 text-xs font-bold mb-4">
                  AWS
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                  AWS Cloud Engineering
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold mb-2">
                  Typical outcome: 20–40% cost reduction, SLO-aligned dashboards, CI/CD from day one
                </p>
                <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm font-medium">
                  Production-ready AWS infrastructure, automation, and operations for modern workloads.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-6">
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">✓</span>
                    <span>Landing zones, networking, and security baselines</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">✓</span>
                    <span>CI/CD with GitHub and Octopus Deploy</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">✓</span>
                    <span>FinOps and observability for production</span>
                  </li>
                </ul>
                <Link
                  href="/cloud-solutions/aws"
                  className="inline-flex items-center text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 group-hover:underline"
                >
                  Explore AWS solutions
                  <ArrowRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
            <div className="card-hover rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none">
              <div>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs font-bold mb-4">
                  AZURE
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                  Azure Cloud Engineering
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold mb-2">
                  Typical outcome: Landing zones, identity governance, repeatable pipelines
                </p>
                <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm font-medium">
                  Enterprise-grade Azure platforms with governance, security, and automation built-in.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-6">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>Azure landing zones and subscription structure</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>Networking, identity, and governance patterns</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>Automation and CI/CD for Azure-native services</span>
                  </li>
                </ul>
                <Link
                  href="/cloud-solutions/azure"
                  className="inline-flex items-center text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 group-hover:underline"
                >
                  Explore Azure solutions
                  <ArrowRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
            <div className="card-hover rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none">
              <div>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-xs font-bold mb-4">
                  GCP
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                  Google Cloud Platform
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold mb-2">
                  Typical outcome: Project structure, VPC design, cost visibility and guardrails
                </p>
                <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm font-medium">
                  Scalable GCP architectures with automation, security, and cost-control engineered in.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-6">
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✓</span>
                    <span>Project structure and VPC networking</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✓</span>
                    <span>CI/CD for containerized and serverless workloads</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✓</span>
                    <span>Cost visibility, monitoring, and guardrails</span>
                  </li>
                </ul>
                <Link
                  href="/cloud-solutions/gcp"
                  className="inline-flex items-center text-sm font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 group-hover:underline"
                >
                  Explore GCP solutions
                  <ArrowRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>

          {/* AI Solutions Section */}
          <section
            className="mt-16 pt-16 border-t border-slate-200 dark:border-slate-700"
            aria-labelledby="ai-solutions-heading"
          >
            <div className="text-center mb-8">
              <h2 id="ai-solutions-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Applied AI in your cloud
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-6">
                Secure, scalable assistants and workflows wired into your existing infrastructure.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/ai-solutions"
                  className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all"
                >
                  AI Solutions
                  <ArrowRightIcon className="ml-1.5 h-4 w-4" />
                </Link>
                <Link
                  href="/ai-engineering"
                  className="inline-flex items-center text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  AI Engineering &amp; LLM Systems
                  <ArrowRightIcon className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* Solutions for Growing Teams */}
          <section
            className="mt-16 pt-16 border-t border-slate-200 dark:border-slate-700"
            aria-labelledby="growing-teams-heading"
          >
            <div className="text-center mb-8">
              <h2 id="growing-teams-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Packages for growing teams
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-6">
                Fixed-scope health checks, CI/CD setup, automation, and cost tuning.
              </p>
              <Link
                href="/solutions-for-growing-teams"
                className="inline-flex items-center text-violet-600 dark:text-violet-400 font-semibold hover:underline"
              >
                View packages
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* Secure-by-Design Cloud Engineering */}
          <section
            className="mt-16 pt-16 border-t border-slate-200 dark:border-slate-700"
            aria-labelledby="cloud-security-heading"
          >
            <div className="text-center mb-8">
              <h2 id="cloud-security-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Practical cloud security
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-6">
                Baselines, hardening, and visibility focused on real risk reduction.
              </p>
              <Link
                href="/free-review"
                className="inline-flex items-center text-violet-600 dark:text-violet-400 font-semibold hover:underline"
              >
                Free Cloud &amp; AI Review
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
              <span className="mx-2 text-slate-400">·</span>
              <Link
                href="/cloud-security"
                className="inline-flex items-center text-violet-600 dark:text-violet-400 font-semibold hover:underline"
              >
                Cloud Security
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </section>
      </AnimateOnScroll>

      {/* AI Insights — thought leadership */}
      <AnimateOnScroll>
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              Insights from real projects
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Short, practical notes on production AI, cost, and cloud engineering.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <Link
              href="/insights/production-ai-vs-demos"
              className="card-hover rounded-2xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-600"
            >
              Production AI vs. demos
            </Link>
            <Link
              href="/insights/rag-vs-fine-tuning-when-to-use-which"
              className="card-hover rounded-2xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-600"
            >
              RAG vs. fine-tuning
            </Link>
            <Link
              href="/insights/ai-cost-management-in-production"
              className="card-hover rounded-2xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-600"
            >
              AI cost management
            </Link>
            <Link
              href="/insights/choosing-ai-models-for-production"
              className="card-hover rounded-2xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-600"
            >
              Choosing AI models
            </Link>
          </div>
          <div className="text-center">
            <Link
              href="/insights"
              className="inline-flex items-center text-violet-600 dark:text-violet-400 font-semibold hover:underline"
            >
              All insights
              <ArrowRightIcon className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* About Section */}
      <AnimateOnScroll>
      <section
        id="about"
        className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
        aria-labelledby="about-heading"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 id="about-heading" className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                Engineering-first cloud consulting
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                We help teams design, automate, and operate platforms with IaC, CI/CD, and clear handover.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/cloud-solutions"
                  className="inline-flex items-center px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-semibold text-sm hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                >
                  Solutions
                  <ArrowRightIcon className="ml-1.5 h-4 w-4" />
                </Link>
                <Link
                  href="/case-studies"
                  className="inline-flex items-center px-5 py-2.5 border-2 border-slate-200/80 dark:border-slate-600/80 text-slate-700 dark:text-slate-300 rounded-2xl font-semibold text-sm hover:border-violet-300 dark:hover:border-violet-600 transition-all"
                >
                  Case Studies
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center px-5 py-2.5 border-2 border-slate-200/80 dark:border-slate-600/80 text-slate-700 dark:text-slate-300 rounded-2xl font-semibold text-sm hover:border-violet-300 dark:hover:border-violet-600 transition-all"
                >
                  Contact
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="card-hover group rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none">
                <SparklesIcon className="h-7 w-7 text-violet-600 dark:text-violet-400 mb-3 icon-bounce" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Proven patterns</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">We use established practices, not unproven trends.</p>
              </div>
              <div className="card-hover group rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none">
                <CheckBadgeIcon className="h-7 w-7 text-slate-600 dark:text-slate-400 mb-3 icon-bounce" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Production-ready</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Code and infrastructure built to run in production.</p>
              </div>
              <div className="card-hover group rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none">
                <RocketLaunchIcon className="h-7 w-7 text-slate-600 dark:text-slate-400 mb-3 icon-bounce" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Automation</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pipelines and IaC to ship faster and safer.</p>
              </div>
              <div className="card-hover group rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none">
                <ShieldCheckIcon className="h-7 w-7 text-slate-600 dark:text-slate-400 mb-3 icon-bounce" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Security by design</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Access control and governance built in from the start.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* Contact Section */}
      <AnimateOnScroll>
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700" aria-labelledby="contact-heading">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="contact-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Discuss your requirements
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10">
            For cloud migration, cost optimization, or platform design—we work with CTOs, VP Engineering, and technical leads to define scope and delivery.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <a
              href="mailto:support@visionxixlabs.com"
              className="card-hover group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm hover:border-violet-300 dark:hover:border-violet-600"
            >
              <EnvelopeIcon className="h-8 w-8 text-slate-600 dark:text-slate-400 mb-3 icon-bounce group-hover:text-violet-600 dark:group-hover:text-violet-400" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Email</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">support@visionxixlabs.com</p>
            </a>
            <Link
              href="/contact"
              className="card-hover btn-huly group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 shadow-sm hover:shadow-lg hover:shadow-violet-500/10 transition-all"
            >
              <RocketLaunchIcon className="h-8 w-8 text-white dark:text-slate-900 mb-3 icon-bounce" />
              <h3 className="text-lg font-semibold mb-1">Contact form</h3>
              <p className="text-slate-300 dark:text-slate-600 text-sm">Request a call or send a message</p>
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4">Terms</Link>
            <Link href="/cloud-solutions" className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4">Solutions</Link>
            <Link href="/case-studies" className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4">Case Studies</Link>
            <Link href="/apps" className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4">Apps (VisaNova, RecallEase)</Link>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* Lead magnet — 10-minute Cloud Health Snapshot */}
      <AnimateOnScroll>
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Get a 10-minute Cloud Health Snapshot
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            Share your email, company, and primary cloud provider. We&apos;ll send a quick assessment and next steps.
          </p>
          <CloudHealthSnapshotForm />
        </div>
      </section>
      </AnimateOnScroll>

      {/* Join the movement — Huly-style dark CTA */}
      <AnimateOnScroll>
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900 dark:bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-30" aria-hidden />
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-fuchsia-500/10 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Join the movement
          </h2>
          <p className="text-slate-300 text-lg mb-8">
            Axiom infrastructure intelligence, cloud consulting, and AI automation — one membership for teams ready to scale production systems.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/cloud-operator"
              className="cta-glow inline-flex items-center px-6 py-3 bg-white text-slate-900 rounded-2xl font-semibold shadow-lg hover:bg-slate-100 transition-colors"
            >
              Run Axiom
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center px-6 py-3 border-2 border-white/30 text-white rounded-2xl font-semibold hover:bg-white/10 hover:border-white/50 transition-all"
            >
              View plans
            </Link>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-6 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Image
                  src="/vision-xix-logo.png"
                  alt="Vision XIX Labs"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-lg font-bold text-white">
                  Vision XIX Labs
                </span>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                Cloud &amp; AI engineering for modern infrastructure. AWS, Azure, GCP — design, automate, optimize, secure.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  AWS
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  Azure
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  GCP
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  Kubernetes
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  AI/ML
                </span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Cloud</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/cloud-solutions" className="hover:text-white transition-colors">Cloud Solutions</Link></li>
                <li><Link href="/cloud-solutions/aws" className="hover:text-white transition-colors">AWS</Link></li>
                <li><Link href="/cloud-solutions/azure" className="hover:text-white transition-colors">Azure</Link></li>
                <li><Link href="/cloud-solutions/gcp" className="hover:text-white transition-colors">GCP</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Solutions</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/ai-solutions" className="hover:text-white transition-colors">AI Solutions</Link></li>
                <li><Link href="/ai-engineering" className="hover:text-white transition-colors">AI Engineering &amp; LLM Systems</Link></li>
                <li><Link href="/markets" className="hover:text-white transition-colors">Where Companies Need AI</Link></li>
                <li><Link href="/enterprise-readiness" className="hover:text-white transition-colors">Enterprise Readiness</Link></li>
                <li><Link href="/solutions-for-growing-teams" className="hover:text-white transition-colors">Growing Teams</Link></li>
                <li><Link href="/cloud-security" className="hover:text-white transition-colors">Cloud Security</Link></li>
                <li><Link href="/case-studies" className="hover:text-white transition-colors">Case Studies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/#about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/press" className="hover:text-white transition-colors">Press</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/apps" className="hover:text-white transition-colors">Apps (VisaNova, RecallEase)</Link></li>
                <li><Link href="/insights" className="hover:text-white transition-colors">Insights</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Connect</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/products" className="hover:text-white transition-colors">Plans & Products</Link></li>
                <li><Link href="/request" className="hover:text-white transition-colors">Website Request / Get a Quote</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li>
                  <a href="mailto:support@visionxixlabs.com" className="hover:text-white transition-colors">
                    support@visionxixlabs.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} Vision XIX Labs LLC. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
