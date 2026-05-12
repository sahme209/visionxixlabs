"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Navigation } from "../components/Navigation";
import { EnterpriseTrustSignals } from "@/components/EnterpriseTrustSignals";
import { AnimateOnScroll } from "@/components/AnimateOnScroll";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { ServicePipeline } from "@/components/ServicePipeline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { RealisticFogBackground } from "@/components/ui/realistic-fog-background";
import { TestimonialsCarousel } from "@/components/TestimonialsCarousel";
import { FAQAccordion } from "@/components/FAQAccordion";

const axiomFAQ = [
  {
    question: "What does Axiom actually do?",
    answer:
      "Axiom is an autonomous cloud operations agent. It connects to your AWS account via a read-only IAM role, scans your infrastructure, runs a 12-step autonomous loop to identify and prioritize issues (cost waste, security gaps, drift, misconfigurations), generates phased execution plans with Terraform code, and learns from outcomes. Nothing changes without your explicit approval.",
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
  {
    question: "Does Axiom learn from past actions?",
    answer:
      "Yes. Axiom records the outcome of every action — whether it succeeded or failed, for which resource and action type. If a resource has a prior failure, it automatically downgrades future recommendations from auto-fix to human review. This outcome memory makes the agent safer over time.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
      <BackgroundBlobs />
      <div className="relative z-10">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <RealisticFogBackground backgroundColor="transparent" opacity={0.4} darken contained />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.06),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.12),transparent_50%)]" />
        <div className="max-w-4xl mx-auto text-center relative">
          <Reveal direction="up" blur>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-sm font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Autonomous Cloud Operations
            </span>
          </Reveal>
          <Reveal direction="up" blur delay={0.04}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-[1.1] tracking-tight text-slate-900 dark:text-slate-50">
              Infrastructure intelligence<br className="hidden sm:block" />
              that operates autonomously.
            </h1>
          </Reveal>
          <Reveal direction="up" delay={0.06}>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Axiom scans your cloud, identifies issues, reasons about priority and risk, generates execution plans, and applies approved changes — with continuous drift monitoring and outcome learning.
            </p>
          </Reveal>
          <Stagger delay={0.12}>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <AnimatedButton
                href="/operator/onboarding"
                variant="primary"
                className="shadow-sm"
              >
                Run Axiom
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </AnimatedButton>
              <AnimatedButton
                href="/axiom"
                variant="secondary"
              >
                How it works
              </AnimatedButton>
            </div>
          </Stagger>
          <Reveal direction="up" delay={0.2}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Read-only by default · No changes without your approval · Full audit trail
            </p>
          </Reveal>
          <Reveal direction="up" delay={0.3}>
            <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Assume-role model
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Approval enforcement
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Rollback capability
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Immutable audit trail
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Capabilities — what Axiom delivers */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Operational intelligence, not dashboards
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                Axiom doesn&apos;t show you charts. It scans, reasons, and acts — then reports what it did and why.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            <Reveal direction="up">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-6 h-full">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Deep Scanning</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Full infrastructure snapshot — cost waste, security gaps, misconfigurations, and drift from desired state.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-violet-400" />Cost optimization and rightsizing</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-violet-400" />Security findings with severity scoring</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-violet-400" />Continuous drift detection</li>
                </ul>
              </div>
            </Reveal>
            <Reveal direction="up" delay={0.06}>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-6 h-full">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Autonomous Reasoning</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  AI reasoning engine that prioritizes findings, builds dependency-aware execution plans, and generates Terraform code.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-fuchsia-400" />Multi-phase cognitive reasoning</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-fuchsia-400" />Phased plans with dependency graphs</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-fuchsia-400" />Terraform and CLI code generation</li>
                </ul>
              </div>
            </Reveal>
            <Reveal direction="up" delay={0.12}>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-6 h-full">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Governed Execution</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Enterprise-grade safety — approval gates, blast radius limits, verified rollback, and immutable audit trail.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-emerald-400" />Human approval for high-risk changes</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-emerald-400" />Pre-verified rollback strategies</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-emerald-400" />Outcome learning and safety gates</li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <EnterpriseTrustSignals />

      {/* How it works — Axiom's workflow */}
      <AnimateOnScroll>
        <section id="how-it-works" className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                The autonomous loop
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                12 steps from connection to continuous operation. Every step is auditable.
              </p>
            </div>
            <ServicePipeline />
          </div>
        </section>
      </AnimateOnScroll>

      {/* Supported cloud platforms */}
      <AnimateOnScroll>
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-8">
            Multi-cloud support
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "AWS", status: "Full support", statusColor: "bg-emerald-500", desc: "Scan, plan, and execute" },
              { name: "Azure", status: "Scan only", statusColor: "bg-amber-500", desc: "Plan and execute on roadmap" },
              { name: "GCP", status: "Scan only", statusColor: "bg-amber-500", desc: "Plan and execute on roadmap" },
              { name: "Terraform", status: "Auto-generated", statusColor: "bg-violet-500", desc: "IaC plans with rollback" },
            ].map((p) => (
              <div key={p.name} className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-4 text-center">
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">{p.name}</div>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.statusColor}`} />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{p.status}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500">{p.desc}</div>
              </div>
            ))}
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
          <h2 id="faq-heading" className="text-center text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-8">
            Frequently asked questions
          </h2>
          <FAQAccordion items={axiomFAQ} />
        </div>
      </section>
      </AnimateOnScroll>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Your cloud, operated by an agent you control
          </h2>
          <p className="text-slate-300 text-lg mb-8 max-w-lg mx-auto">
            Connect your AWS account. Axiom scans, reasons, plans, and executes — nothing changes until you approve.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <Link
              href="/operator/onboarding"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-slate-900 rounded-xl font-semibold text-sm hover:bg-slate-100 transition-colors"
            >
              Run Axiom
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/operator/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/10 transition-colors"
            >
              View plans
            </Link>
          </div>
          <a
            href="mailto:support@visionxixlabs.com"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            support@visionxixlabs.com
          </a>
        </div>
      </section>

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
                <li><Link href="/axiom/operations" className="hover:text-white transition-colors">Operations</Link></li>
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
