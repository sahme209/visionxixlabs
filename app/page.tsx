"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Navigation } from "../components/Navigation";
import { EnterpriseTrustSignals } from "@/components/EnterpriseTrustSignals";
import { AnimateOnScroll } from "@/components/AnimateOnScroll";
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

const TRUST_LOGOS = [
  "AWS Partner", "SOC 2 Type II", "ISO 27001", "GDPR", "Terraform",
  "Read-only IAM", "Approval Gates", "Immutable Audit", "Rollback Ready", "Outcome Memory",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative">
      <div className="absolute inset-0 bg-grid-mesh opacity-40" aria-hidden />
      <div className="relative z-10">
      <Navigation />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <RealisticFogBackground backgroundColor="transparent" opacity={0.3} darken contained />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] spotlight-orb opacity-60" aria-hidden />
        <div className="absolute top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-[120px]" aria-hidden />
        <div className="absolute top-60 -left-40 w-[400px] h-[400px] rounded-full bg-fuchsia-600/5 blur-[120px]" aria-hidden />

        <div className="max-w-4xl mx-auto text-center relative">
          <Reveal direction="up" blur>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 text-sm font-medium mb-8 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Autonomous Cloud Operations
            </span>
          </Reveal>
          <Reveal direction="up" blur delay={0.04}>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.05] tracking-tight">
              Infrastructure intelligence<br className="hidden sm:block" />
              that operates <span className="text-gradient">autonomously.</span>
            </h1>
          </Reveal>
          <Reveal direction="up" delay={0.06}>
            <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Axiom scans your cloud, identifies issues, reasons about priority and risk, generates execution plans, and applies approved changes — with continuous drift monitoring and outcome learning.
            </p>
          </Reveal>
          <Stagger delay={0.12}>
            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <AnimatedButton
                href="/operator/onboarding"
                variant="primary"
                className="btn-huly cta-glow shadow-lg shadow-violet-500/20"
              >
                Run Axiom
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </AnimatedButton>
              <AnimatedButton
                href="/axiom"
                variant="ghost"
                className="border-white/10 text-zinc-300 hover:bg-white/5 hover:border-white/20"
              >
                How it works
              </AnimatedButton>
            </div>
          </Stagger>
          <Reveal direction="up" delay={0.2}>
            <p className="text-sm text-zinc-500">
              Read-only by default · No changes without your approval · Full audit trail
            </p>
          </Reveal>
          <Reveal direction="up" delay={0.3}>
            <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-zinc-500">
              {["Assume-role model", "Approval enforcement", "Rollback capability", "Immutable audit trail"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Trust Marquee ──────────────────────────────────────────── */}
      <section className="py-8 border-y border-white/[0.04] overflow-hidden relative">
        <div className="absolute inset-0 bg-white/[0.01]" aria-hidden />
        <div className="relative overflow-hidden">
          <div className="marquee-track">
            {[...TRUST_LOGOS, ...TRUST_LOGOS].map((logo, i) => (
              <span key={i} className="text-sm font-medium text-zinc-600 whitespace-nowrap tracking-wide">
                {logo}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Reveal direction="up">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
                What Axiom Delivers
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Operational intelligence, not dashboards
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Axiom doesn&apos;t show you charts. It scans, reasons, and acts — then reports what it did and why.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                dot: "bg-violet-500",
                title: "Deep Scanning",
                desc: "Full infrastructure snapshot — cost waste, security gaps, misconfigurations, and drift from desired state.",
                items: [
                  { dot: "bg-violet-400/60", text: "Cost optimization and rightsizing" },
                  { dot: "bg-violet-400/60", text: "Security findings with severity scoring" },
                  { dot: "bg-violet-400/60", text: "Continuous drift detection" },
                ],
              },
              {
                dot: "bg-fuchsia-500",
                title: "Autonomous Reasoning",
                desc: "AI reasoning engine that prioritizes findings, builds dependency-aware execution plans, and generates Terraform code.",
                items: [
                  { dot: "bg-fuchsia-400/60", text: "Multi-phase cognitive reasoning" },
                  { dot: "bg-fuchsia-400/60", text: "Phased plans with dependency graphs" },
                  { dot: "bg-fuchsia-400/60", text: "Terraform and CLI code generation" },
                ],
              },
              {
                dot: "bg-emerald-500",
                title: "Governed Execution",
                desc: "Enterprise-grade safety — approval gates, blast radius limits, verified rollback, and immutable audit trail.",
                items: [
                  { dot: "bg-emerald-400/60", text: "Human approval for high-risk changes" },
                  { dot: "bg-emerald-400/60", text: "Pre-verified rollback strategies" },
                  { dot: "bg-emerald-400/60", text: "Outcome learning and safety gates" },
                ],
              },
            ].map((card, i) => (
              <Reveal key={card.title} direction="up" delay={i * 0.06}>
                <div className="glow-border-card card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 h-full backdrop-blur-sm hover:border-white/[0.12] transition-colors">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className={`w-2 h-2 rounded-full ${card.dot}`} />
                    <h3 className="text-base font-semibold">{card.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-400 mb-5 leading-relaxed">{card.desc}</p>
                  <ul className="text-sm text-zinc-500 space-y-2">
                    {card.items.map((item) => (
                      <li key={item.text} className="flex items-center gap-2">
                        <span className={`w-1 h-1 rounded-full ${item.dot}`} />
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <EnterpriseTrustSignals />

      {/* ── How it works ───────────────────────────────────────────── */}
      <AnimateOnScroll>
        <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
                How Axiom Operates
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                The autonomous loop
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto">
                12 steps from connection to continuous operation. Every step is auditable.
              </p>
            </div>
            <ServicePipeline />
          </div>
        </section>
      </AnimateOnScroll>

      {/* ── Multi-cloud ────────────────────────────────────────────── */}
      <AnimateOnScroll>
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
              Platform Support
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Multi-cloud support
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "AWS", status: "Full support", statusColor: "bg-emerald-500", desc: "Scan, plan, and execute" },
              { name: "Azure", status: "Scan only", statusColor: "bg-amber-500", desc: "Plan and execute on roadmap" },
              { name: "GCP", status: "Scan only", statusColor: "bg-amber-500", desc: "Plan and execute on roadmap" },
              { name: "Terraform", status: "Auto-generated", statusColor: "bg-violet-500", desc: "IaC plans with rollback" },
            ].map((p) => (
              <div key={p.name} className="card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center hover:border-white/[0.12] transition-colors">
                <div className="text-xl font-bold mb-2">{p.name}</div>
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.statusColor}`} />
                  <span className="text-xs font-medium text-zinc-400">{p.status}</span>
                </div>
                <div className="text-xs text-zinc-500">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </AnimateOnScroll>

      {/* ── Testimonials ───────────────────────────────────────────── */}
      <Reveal direction="up">
        <TestimonialsCarousel />
      </Reveal>

      {/* ── FAQ ────────────────────────────────────────────────────── */}
      <AnimateOnScroll>
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/[0.04]" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto">
          <h2 id="faq-heading" className="text-center text-3xl md:text-4xl font-bold mb-12">
            Frequently asked questions
          </h2>
          <FAQAccordion items={axiomFAQ} />
        </div>
      </section>
      </AnimateOnScroll>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 diagonal-streak opacity-40" aria-hidden />
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-600/8 blur-[120px]" aria-hidden />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-fuchsia-600/8 blur-[120px]" aria-hidden />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-5">
            Your cloud, operated by an<br className="hidden sm:block" />
            agent <span className="text-gradient">you control</span>
          </h2>
          <p className="text-zinc-400 text-lg mb-10 max-w-lg mx-auto">
            Connect your AWS account. Axiom scans, reasons, plans, and executes — nothing changes until you approve.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link
              href="/operator/onboarding"
              className="btn-huly cta-glow inline-flex items-center gap-2 px-8 py-4 bg-white text-zinc-900 rounded-xl font-semibold text-sm shadow-lg hover:bg-zinc-100 transition-colors"
            >
              Run Axiom
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/operator/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/[0.12] text-zinc-300 rounded-xl font-semibold text-sm hover:bg-white/5 hover:border-white/20 transition-colors"
            >
              View plans
            </Link>
          </div>
          <a
            href="mailto:support@visionxixlabs.com"
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            support@visionxixlabs.com
          </a>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-5">
                <Image
                  src="/vision-xix-logo.png"
                  alt="Vision XIX Labs"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-lg font-bold text-gradient">
                  Vision XIX Labs
                </span>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-sm">
                Axiom is an autonomous cloud operations agent. It scans, reasons, plans, and executes — with governance, rollback, and full audit trail. You stay in control.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">Product</h4>
              <ul className="space-y-2.5 text-sm text-zinc-500">
                <li><Link href="/operator/onboarding" className="hover:text-white transition-colors">Run Axiom</Link></li>
                <li><Link href="/operator/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/axiom" className="hover:text-white transition-colors">About Axiom</Link></li>
                <li><Link href="/axiom/operations" className="hover:text-white transition-colors">Operations</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-2.5 text-sm text-zinc-500">
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="mailto:support@visionxixlabs.com" className="hover:text-white transition-colors">Support</a></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
                <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.04] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-zinc-600 text-sm">
              © {new Date().getFullYear()} Vision XIX Labs LLC. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
