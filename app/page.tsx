"use client";

import Link from "next/link";
import Image from "next/image";
import {
  EnvelopeIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../components/Navigation";
import { EnterpriseTrustSignals } from "@/components/EnterpriseTrustSignals";
import { AnimateOnScroll } from "@/components/AnimateOnScroll";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { ServicePipeline } from "@/components/ServicePipeline";
import { HeroHeadlineGlow } from "@/components/HeroHeadlineGlow";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { HoverCard } from "@/components/ui/HoverCard";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { SectionBackground } from "@/components/ui/SectionBackground";
import { AccentMarker } from "@/components/ui/AccentMarker";
import { MiniChart } from "@/components/ui/MiniChart";
import { RealisticFogBackground } from "@/components/ui/realistic-fog-background";
import { TestimonialsCarousel } from "@/components/TestimonialsCarousel";
import { FAQAccordion } from "@/components/FAQAccordion";

const axiomFAQ = [
  {
    question: "What does Axiom actually do?",
    answer:
      "Axiom is an autonomous cloud operations agent. It connects to your AWS account via a read-only IAM role, scans your infrastructure, uses a 9-phase cognitive reasoning loop to identify and prioritize issues (cost waste, security gaps, drift, misconfigurations), then generates phased execution plans with Terraform code. Nothing changes without your explicit approval.",
  },
  {
    question: "Does Axiom modify my infrastructure?",
    answer:
      "Never without your approval. Scans are always read-only. When you upgrade to the Agent tier, Axiom generates execution plans — but every change requires your explicit approval, includes a pre-verified rollback strategy, and is logged with a full audit trail.",
  },
  {
    question: "What clouds are supported?",
    answer:
      "AWS has full support — scan, plan, and execution. Azure and GCP currently support scan-only analysis, with plan and execution capabilities on the roadmap.",
  },
  {
    question: "How does Axiom keep my infrastructure safe?",
    answer:
      "Axiom uses a governance framework with trust levels, blast radius limits, approval gates, and compliance policies. The agent can never self-escalate its own autonomy level. High-risk changes always require human approval.",
  },
  {
    question: "How long does setup take?",
    answer:
      "About 5 minutes. Create a read-only IAM role in AWS, paste the Role ARN, and Axiom starts scanning. Your first findings report is ready in under a minute.",
  },
  {
    question: "What access does Axiom need?",
    answer:
      "Axiom uses an assume-role model — you create a read-only IAM role in your AWS account and we assume it to scan. No access keys are stored. You can revoke access anytime from your AWS console.",
  },
];

export default function Home() {
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
              AI Cloud Operator
            </span>
          </Reveal>
          <Reveal direction="up" blur delay={0.04}>
            <HeroHeadlineGlow />
          </Reveal>
          <Reveal direction="up" delay={0.06}>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-4 max-w-3xl mx-auto">
              An AI agent that scans your cloud, reasons about what to fix, generates execution plans, and applies approved changes — with full rollback and audit trail.
            </p>
          </Reveal>
          <Stagger delay={0.12}>
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <AnimatedButton
                href="/operator/onboarding"
                variant="primary"
                className="btn-huly cta-glow shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40"
              >
                Run Axiom
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </AnimatedButton>
              <AnimatedButton
                href="/#how-it-works"
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
          <Reveal direction="up" delay={0.24}>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              Scan · Reason · Plan · Execute · Verify · Learn
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

      {/* Outcome cards — what Axiom delivers */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <Reveal direction="up">
              <HoverCard className="p-6 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30 border-slate-200/80 dark:border-slate-700/80 hover:border-violet-300/80 dark:hover:border-violet-600/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <AccentMarker color="violet" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Intelligent Scanning</h3>
                  </div>
                  <MiniChart type="line" color="violet" />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Deep infrastructure analysis that finds cost waste, security gaps, and drift across your cloud.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Cost optimization and rightsizing analysis</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Security findings with severity scoring</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Drift detection against desired state</li>
                </ul>
              </HoverCard>
            </Reveal>
            <Reveal direction="up" delay={0.06}>
              <HoverCard className="p-6 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30 border-slate-200/80 dark:border-slate-700/80 hover:border-violet-300/80 dark:hover:border-violet-600/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <AccentMarker color="fuchsia" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Autonomous Reasoning</h3>
                  </div>
                  <MiniChart type="bars" color="fuchsia" />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  AI-powered reasoning that prioritizes findings, generates execution plans, and learns from your infrastructure over time.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Multi-phase cognitive reasoning engine</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Phased execution plans with dependency graphs</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Terraform and CLI code generation</li>
                </ul>
              </HoverCard>
            </Reveal>
            <Reveal direction="up" delay={0.12}>
              <HoverCard className="p-6 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/30 border-slate-200/80 dark:border-slate-700/80 hover:border-violet-300/80 dark:hover:border-violet-600/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <AccentMarker color="emerald" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Safe Execution</h3>
                  </div>
                  <MiniChart type="area" color="emerald" />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Enterprise-grade safety with approval gates, blast radius limits, rollback coordination, and full audit trail.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Human approval required for high-risk changes</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Verified rollback before every apply</li>
                  <li className="flex items-start"><span className="text-violet-500 mr-2">✓</span>Governance policies and compliance checks</li>
                </ul>
              </HoverCard>
            </Reveal>
          </div>
        </div>
      </section>

      <EnterpriseTrustSignals />

      {/* How it works — Axiom's workflow */}
      <AnimateOnScroll>
        <section id="how-it-works" className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-6">
              <AccentMarker color="fuchsia" />
              <h2 className="text-center text-lg font-semibold text-slate-700 dark:text-slate-300">
                How Axiom operates your cloud
              </h2>
            </div>
            <ServicePipeline />
          </div>
        </section>
      </AnimateOnScroll>

      {/* Supported cloud platforms */}
      <AnimateOnScroll>
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8">
            <AccentMarker color="violet" size="md" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Supported cloud platforms</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">AWS</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Full scan, plan, and execution</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Azure</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Scan-only (apply on roadmap)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">GCP</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Scan-only (apply on roadmap)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Terraform</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Auto-generated IaC plans</div>
            </div>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* Testimonials */}
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
          <FAQAccordion items={axiomFAQ} />
        </div>
      </section>
      </AnimateOnScroll>

      {/* Contact Section */}
      <AnimateOnScroll>
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700" aria-labelledby="contact-heading">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="contact-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Ready to let Axiom operate your cloud?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10">
            Connect your AWS account in minutes. Axiom runs a read-only scan, reasons about what to fix, and shows you a prioritized plan — no changes without your approval.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <Link
              href="/operator/onboarding"
              className="card-hover btn-huly group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 shadow-sm hover:shadow-lg hover:shadow-violet-500/10 transition-all"
            >
              <RocketLaunchIcon className="h-8 w-8 text-white dark:text-slate-900 mb-3 icon-bounce" />
              <h3 className="text-lg font-semibold mb-1">Run Axiom</h3>
              <p className="text-slate-300 dark:text-slate-600 text-sm">Scan your AWS infrastructure in minutes</p>
            </Link>
            <a
              href="mailto:support@visionxixlabs.com"
              className="card-hover group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm hover:border-violet-300 dark:hover:border-violet-600"
            >
              <EnvelopeIcon className="h-8 w-8 text-slate-600 dark:text-slate-400 mb-3 icon-bounce group-hover:text-violet-600 dark:group-hover:text-violet-400" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Email us</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">support@visionxixlabs.com</p>
            </a>
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* Dark CTA */}
      <AnimateOnScroll>
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900 dark:bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-30" aria-hidden />
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-fuchsia-500/10 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Your cloud, operated by an agent you control
          </h2>
          <p className="text-slate-300 text-lg mb-8">
            Axiom connects to your AWS account, scans your infrastructure, reasons about what to fix, and generates phased plans — nothing changes until you approve.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/operator/onboarding"
              className="cta-glow inline-flex items-center px-6 py-3 bg-white text-slate-900 rounded-2xl font-semibold shadow-lg hover:bg-slate-100 transition-colors"
            >
              Run Axiom
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/operator/pricing"
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
          <div className="grid md:grid-cols-4 gap-8 mb-8">
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
                Axiom is an autonomous cloud operations agent. It scans, reasons, plans, and executes — with governance, rollback, and full audit trail. You stay in control.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/operator/onboarding" className="hover:text-white transition-colors">Run Axiom</Link></li>
                <li><Link href="/operator/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/axiom" className="hover:text-white transition-colors">About Axiom</Link></li>
                <li><Link href="/dashboard/resilience" className="hover:text-white transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li>
                  <a href="mailto:support@visionxixlabs.com" className="hover:text-white transition-colors">
                    support@visionxixlabs.com
                  </a>
                </li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
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
