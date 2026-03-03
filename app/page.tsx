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
import { ServicePipeline } from "@/components/ServicePipeline";
import { CloudHealthSnapshotForm } from "@/components/CloudHealthSnapshotForm";
import { HeroHeadlineGlow } from "@/components/HeroHeadlineGlow";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { HoverCard } from "@/components/ui/HoverCard";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { SectionBackground } from "@/components/ui/SectionBackground";
import { AccentMarker } from "@/components/ui/AccentMarker";
import { MiniChart } from "@/components/ui/MiniChart";
import { MetricPill } from "@/components/ui/MetricPill";
import { GridBackdrop } from "@/components/ui/GridBackdrop";
import { RealisticFogBackground } from "@/components/ui/realistic-fog-background";
import { TestimonialsCarousel } from "@/components/TestimonialsCarousel";
import { FAQAccordion } from "@/components/FAQAccordion";
import { cloudFAQ } from "@/lib/cloudContent";

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
      <div className="relative z-10">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <RealisticFogBackground backgroundColor="transparent" opacity={0.45} darken contained />
        <SectionBackground variant="hero-light" />
        <div className="max-w-4xl mx-auto text-center relative">
          <Reveal direction="up" blur>
            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-sm font-semibold mb-6">
              Cloud &amp; AI Engineering
            </span>
          </Reveal>
          <Reveal direction="up" blur delay={0.04}>
            <HeroHeadlineGlow />
          </Reveal>
          <Reveal direction="up" delay={0.06}>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-4 max-w-3xl mx-auto">
              Securely connect your cloud. Run real analysis. Approve safe fixes. No changes without your permission.
            </p>
          </Reveal>
          <Stagger delay={0.12}>
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <AnimatedButton
                href="/cloud-operator"
                variant="primary"
                className="btn-huly cta-glow shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40"
              >
                Run Axiom
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </AnimatedButton>
              <AnimatedButton
                href="/axiom"
                variant="secondary"
                className="btn-huly shadow-lg"
              >
                See how it works
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </AnimatedButton>
            </div>
          </Stagger>
          <Reveal direction="up" delay={0.2}>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              No obligation · Read-only by default · No changes without your approval
            </p>
          </Reveal>
          <Reveal direction="up" delay={0.18}>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <Link
              href="/cloud-solutions/aws"
              className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-medium bg-white/80 dark:bg-slate-800/80 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-600 hover:scale-105 hover:shadow-lg transition-all duration-200"
            >
              <span className="text-orange-600 dark:text-orange-400 font-semibold mr-1">AWS</span>
              Cloud
            </Link>
            <Link
              href="/cloud-solutions/azure"
              className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-medium bg-white/80 dark:bg-slate-800/80 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:scale-105 hover:shadow-lg transition-all duration-200"
            >
              <span className="text-blue-600 dark:text-blue-400 font-semibold mr-1">Azure</span>
              Cloud
            </Link>
            <Link
              href="/cloud-solutions/gcp"
              className="inline-flex items-center px-4 py-2 rounded-2xl text-sm font-medium bg-white/80 dark:bg-slate-800/80 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-red-300 dark:hover:border-red-600 hover:scale-105 hover:shadow-lg transition-all duration-200"
            >
              <span className="text-red-600 dark:text-red-400 font-semibold mr-1">GCP</span>
              Cloud
            </Link>
          </div>
          </Reveal>
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
              <HoverCard className="p-6 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30 border-slate-200/80 dark:border-slate-700/80 hover:border-violet-300/80 dark:hover:border-violet-600/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <AccentMarker color="violet" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Reliability (SLO-first)</h3>
                  </div>
                  <MiniChart type="line" color="violet" />
                </div>
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
              <HoverCard className="p-6 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30 border-slate-200/80 dark:border-slate-700/80 hover:border-violet-300/80 dark:hover:border-violet-600/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <AccentMarker color="fuchsia" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Security &amp; Governance</h3>
                  </div>
                  <MiniChart type="bars" color="fuchsia" />
                </div>
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
              <HoverCard className="p-6 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30 border-slate-200/80 dark:border-slate-700/80 hover:border-violet-300/80 dark:hover:border-violet-600/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <AccentMarker color="emerald" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cost Efficiency (FinOps)</h3>
                  </div>
                  <MiniChart type="area" color="emerald" />
                </div>
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
            <div className="flex items-center justify-center gap-2 mb-6">
              <AccentMarker color="fuchsia" />
              <h2 className="text-center text-lg font-semibold text-slate-700 dark:text-slate-300">
                Everything connected in one flow
              </h2>
            </div>
            <ServicePipeline />
          </div>
        </section>
      </AnimateOnScroll>

      {/* AI Capabilities — production-grade AI positioning */}
      <AnimateOnScroll>
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/60 dark:bg-slate-900/80 backdrop-blur border-t border-slate-200/80 dark:border-slate-700/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-3">
              <AccentMarker color="indigo" size="md" />
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
                Production systems, not demos
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              We build internal assistants, automation, and extraction workflows that run safely inside your cloud.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center mb-10">
            {[
              { title: "Internal AI", sub: "Knowledge copilots", color: "violet" as const, metric: "80%", chart: "line" as const },
              { title: "RAG", sub: "Vector search & retrieval", color: "fuchsia" as const, metric: "95%", chart: "area" as const },
              { title: "Automation", sub: "Workflow & classification", color: "indigo" as const, metric: "3x", chart: "bars" as const },
              { title: "Extraction", sub: "Docs, forms, invoices", color: "emerald" as const, metric: "10x", chart: "line" as const },
              { title: "Governance", sub: "Security & cost controls", color: "orange" as const, metric: "SOC2", chart: null },
              { title: "AWS · Azure · GCP", sub: "Your cloud, your data", color: "violet" as const, metric: "", chart: null },
            ].map((item, idx) => (
              <Reveal key={item.title} direction="up" delay={idx * 0.05}>
                <HoverCard className="relative overflow-hidden p-4 bg-white/80 dark:bg-slate-800/60 backdrop-blur border-2 border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:border-violet-300/80 dark:hover:border-violet-600/50 transition-colors">
                  <GridBackdrop opacity={0.5} />
                  <div className="relative flex items-start justify-between gap-2 mb-2">
                    <AccentMarker color={item.color} />
                    {item.chart && <MiniChart type={item.chart} color={item.color} />}
                    {item.metric && !item.chart && <MetricPill value={item.metric} color={item.color} />}
                  </div>
                  <div className="relative text-lg font-bold text-slate-900 dark:text-slate-100">{item.title}</div>
                  <div className="relative text-xs text-slate-600 dark:text-slate-400">{item.sub}</div>
                </HoverCard>
              </Reveal>
            ))}
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
          <div className="flex items-center justify-center gap-2 mb-8">
            <AccentMarker color="violet" size="md" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Cloud platforms</h2>
          </div>
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
            <div className="flex items-center justify-center gap-2 mb-4">
              <AccentMarker color="violet" size="md" />
              <h2 id="solutions-heading" className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">
                Multi-cloud engineering solutions
              </h2>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              We design, automate, and operate cloud platforms across AWS, Azure, and Google Cloud with a focus on reliability, security, and cost efficiency.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Reveal direction="up" delay={0}>
              <HoverCard minimal>
            <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none hover:border-orange-300/80 dark:hover:border-orange-600/50 transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AccentMarker color="orange" />
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 text-xs font-bold">
                  AWS
                </div>
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
              </HoverCard>
            </Reveal>
            <Reveal direction="up" delay={0.06}>
              <HoverCard minimal>
            <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none hover:border-blue-300/80 dark:hover:border-blue-600/50 transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AccentMarker color="indigo" />
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs font-bold">
                  AZURE
                </div>
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
              </HoverCard>
            </Reveal>
            <Reveal direction="up" delay={0.12}>
              <HoverCard minimal>
            <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none hover:border-red-300/80 dark:hover:border-red-600/50 transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AccentMarker color="red" />
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-xs font-bold">
                  GCP
                </div>
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
              </HoverCard>
            </Reveal>
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
            <div className="flex items-center justify-center gap-2 mb-3">
              <AccentMarker color="emerald" size="md" />
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
                Insights from real projects
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Short, practical notes on production AI, cost, and cloud engineering.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { href: "/insights/production-ai-vs-demos", label: "Production AI vs. demos", color: "violet" as const },
              { href: "/insights/rag-vs-fine-tuning-when-to-use-which", label: "RAG vs. fine-tuning", color: "fuchsia" as const },
              { href: "/insights/ai-cost-management-in-production", label: "AI cost management", color: "emerald" as const },
              { href: "/insights/choosing-ai-models-for-production", label: "Choosing AI models", color: "orange" as const },
            ].map((item, idx) => (
              <Reveal key={item.href} direction="up" delay={idx * 0.05}>
                <HoverCard className="h-full" minimal>
                  <Link
                    href={item.href}
                    className="block h-full rounded-2xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 overflow-hidden shadow-lg shadow-slate-200/20 dark:shadow-none hover:border-violet-300 dark:hover:border-violet-600 transition-colors group"
                  >
                    <div className={`h-2 ${item.color === "violet" ? "bg-violet-500" : item.color === "fuchsia" ? "bg-fuchsia-500" : item.color === "emerald" ? "bg-emerald-500" : "bg-orange-500"}`} />
                    <div className="p-4">
                      <AccentMarker color={item.color} className="mb-2" />
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {item.label}
                      </span>
                    </div>
                  </Link>
                </HoverCard>
              </Reveal>
            ))}
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
              <div className="flex items-center gap-2 mb-4">
                <AccentMarker color="orange" size="md" />
                <h2 id="about-heading" className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">
                  Engineering-first cloud consulting
                </h2>
              </div>
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
              {[
                { Icon: SparklesIcon, title: "Proven patterns", desc: "We use established practices, not unproven trends.", color: "violet" as const },
                { Icon: CheckBadgeIcon, title: "Production-ready", desc: "Code and infrastructure built to run in production.", color: "emerald" as const },
                { Icon: RocketLaunchIcon, title: "Automation", desc: "Pipelines and IaC to ship faster and safer.", color: "orange" as const },
                { Icon: ShieldCheckIcon, title: "Security by design", desc: "Access control and governance built in from the start.", color: "fuchsia" as const },
              ].map((card, idx) => {
                const Icon = card.Icon;
                return (
                <Reveal key={card.title} direction="up" delay={idx * 0.06}>
                  <HoverCard className="relative overflow-hidden group rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-6 shadow-lg shadow-slate-200/30 dark:shadow-none hover:border-violet-300/80 dark:hover:border-violet-600/50">
                    <GridBackdrop opacity={0.4} />
                    <div className="relative flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <AccentMarker color={card.color} />
                        <Icon className="h-7 w-7 text-slate-600 dark:text-slate-400 icon-bounce group-hover:text-violet-600 dark:group-hover:text-violet-400" />
                      </div>
                      <MiniChart type="line" color={card.color} />
                    </div>
                    <h3 className="relative text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">{card.title}</h3>
                    <p className="relative text-sm text-slate-600 dark:text-slate-400">{card.desc}</p>
                  </HoverCard>
                </Reveal>
              );})}
            </div>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* Testimonials — carousel with split panels */}
      <Reveal direction="up">
        <TestimonialsCarousel />
      </Reveal>

      {/* FAQ Section */}
      <AnimateOnScroll>
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8">
            <AccentMarker color="violet" size="md" />
            <h2 id="faq-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Frequently asked questions
            </h2>
          </div>
          <FAQAccordion items={cloudFAQ.slice(0, 6)} />
          <div className="mt-6 text-center">
            <Link
              href="/services#faq-heading"
              className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              View all FAQs →
            </Link>
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
    </div>
  );
}
