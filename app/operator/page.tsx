"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import {
  ShieldCheckIcon,
  CloudIcon,
  BoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  CpuChipIcon,
  LockClosedIcon,
  CurrencyDollarIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

const steps = [
  {
    number: "01",
    title: "Connect your cloud",
    description: "Link your AWS account via a read-only IAM role in under 2 minutes. No stored credentials — we assume a role and scan. Revoke access anytime.",
    icon: CloudIcon,
    color: "from-blue-500 to-cyan-500",
  },
  {
    number: "02",
    title: "Axiom scans and reasons",
    description: "The cognitive engine analyzes your infrastructure — cost waste, security gaps, drift, and misconfigurations — then prioritizes what matters most.",
    icon: ChartBarIcon,
    color: "from-violet-500 to-purple-500",
  },
  {
    number: "03",
    title: "Review and approve",
    description: "Get a prioritized findings report with phased execution plans, Terraform code, and rollback strategies. Nothing changes without your explicit approval.",
    icon: BoltIcon,
    color: "from-emerald-500 to-green-500",
  },
];

const features = [
  {
    icon: ShieldCheckIcon,
    title: "Read-only by default",
    description: "Scans never modify your resources. Every action is logged with a full audit trail.",
  },
  {
    icon: LockClosedIcon,
    title: "Approval gates",
    description: "No infrastructure changes without your explicit approval. High-risk changes require additional confirmation.",
  },
  {
    icon: CpuChipIcon,
    title: "Cognitive reasoning",
    description: "A 9-phase AI loop — observe, interpret, reason, prioritize, plan, execute, verify, reflect, learn — that thinks like a senior cloud engineer.",
  },
  {
    icon: CurrencyDollarIcon,
    title: "Cost optimization",
    description: "Identifies waste, rightsizing opportunities, and savings — with cost estimates before any change is applied.",
  },
  {
    icon: ClockIcon,
    title: "Verified rollback",
    description: "Every execution plan includes a pre-verified rollback strategy. If something goes wrong, changes are reversed automatically.",
  },
  {
    icon: CloudIcon,
    title: "Governance & compliance",
    description: "Trust levels, blast radius limits, and compliance policies (SOC 2, ISO 27001, GDPR) ensure safe operations at every step.",
  },
];

const plans = [
  {
    name: "Scan",
    price: "$0",
    period: "forever",
    description: "Read-only analysis. No credit card.",
    features: [
      "1 AWS account",
      "Infrastructure findings report",
      "Cost, security, and drift analysis",
      "Prioritized recommendations",
      "Community support",
    ],
    cta: "Start Free",
    ctaHref: "/auth/signup?plan=free&redirect=/operator/onboarding",
    highlighted: false,
  },
  {
    name: "Agent",
    price: "$149",
    period: "/month",
    description: "Full autonomous agent with execution.",
    features: [
      "3 cloud accounts",
      "Cognitive reasoning engine",
      "Phased execution plans + Terraform",
      "Governance policies and approval gates",
      "Verified rollback on every change",
      "Slack + email alerts",
      "Priority support",
    ],
    cta: "Get started",
    ctaHref: "/auth/signup?plan=pro&redirect=/operator/onboarding",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For teams managing critical infrastructure.",
    features: [
      "Unlimited cloud accounts",
      "Autonomous operations with trust ladder",
      "Daily compliance scans",
      "Custom Terraform modules",
      "SSO + audit logging",
      "Dedicated account manager",
      "SLA guarantee",
      "Compliance frameworks (SOC 2, ISO 27001)",
    ],
    cta: "Talk to us",
    ctaHref: "/contact?ref=operator-enterprise",
    highlighted: false,
  },
];

const faqs = [
  {
    q: "What does Axiom actually do?",
    a: "Axiom is an autonomous cloud operations agent. It connects to your AWS account via a read-only IAM role, scans your infrastructure, uses a 9-phase cognitive reasoning loop to identify and prioritize issues, then generates phased execution plans with Terraform code. Nothing changes without your approval.",
  },
  {
    q: "Do you modify my infrastructure?",
    a: "Never without your approval. Scans are read-only. Execution plans require your explicit approval before anything is applied. Every change includes a pre-verified rollback strategy, and every action is logged with a full audit trail.",
  },
  {
    q: "How long does setup take?",
    a: "About 5 minutes. Create a read-only IAM role in AWS, paste the ARN, and Axiom starts scanning. Your first findings report is ready in under a minute.",
  },
  {
    q: "What clouds are supported?",
    a: "AWS has full support — scan, plan, and execution. Azure and GCP currently support scan-only analysis, with plan and execution on the roadmap.",
  },
  {
    q: "How does Axiom keep my infrastructure safe?",
    a: "Axiom uses a governance framework with trust levels, blast radius limits, approval gates, and compliance policies. The agent can never self-escalate its own autonomy level. High-risk changes always require human approval.",
  },
];

export default function OperatorLandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 relative">
      {/* Background layers */}
      <div className="fixed inset-0 bg-dots opacity-15 pointer-events-none" aria-hidden />
      <div className="fixed inset-0 noise-grain pointer-events-none" aria-hidden />

      {/* Nav */}
      <nav className="border-b border-white/[0.06] backdrop-blur-sm sticky top-0 z-50 bg-[#09090b]/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/operator" className="flex items-center gap-2">
            <CpuChipIcon className="h-7 w-7 text-violet-400" />
            <span className="font-bold text-lg">Cloud Operator</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">
              Sign in
            </Link>
            <AnimatedButton href="/auth/signup?redirect=/operator/onboarding" variant="primary" className="text-sm px-4 py-2">
              Start Free
            </AnimatedButton>
          </div>
        </div>
      </nav>

      {/* Hero — Apple-grade: coral × violet × cyan aurora, mono-label
          eyebrow, .font-display headline with restrained coral hairline */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] spotlight-orb opacity-40 pointer-events-none" aria-hidden />
        <div className="ambient-drift absolute -top-40 -right-32 w-[460px] h-[420px] rounded-full bg-brand-coral/[0.07] blur-[130px] pointer-events-none" aria-hidden />
        <div className="ambient-drift absolute top-1/4 left-1/4 w-[400px] h-[320px] rounded-full bg-brand-violet/[0.08] blur-[120px] pointer-events-none" style={{ animationDelay: "-8s" }} aria-hidden />
        <div className="ambient-drift absolute bottom-0 -left-32 w-[380px] h-[300px] rounded-full bg-cyan-500/[0.05] blur-[110px] pointer-events-none" style={{ animationDelay: "-14s" }} aria-hidden />
        <div className="hero-beam-vertical pointer-events-none" aria-hidden />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 text-center relative">
          <Reveal>
            <p className="mono-label inline-flex items-center gap-2.5 mb-6">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
              <span className="text-emerald-300/85">In public beta</span>
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-[1.04]">
              Your cloud, operated by<br />
              <span className="relative inline-block">
                an AI agent.
                <span aria-hidden className="absolute left-0 -bottom-1 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
              </span>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed text-dim-paragraph">
              Axiom scans your AWS infrastructure, reasons about what to fix, <span className="dim-1">generates phased execution plans, and applies approved changes</span> <span className="dim-2">— with full governance and audit trail.</span>
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <AnimatedButton href="/auth/signup?redirect=/operator/onboarding" variant="primary" className="btn-amber-shimmer px-8 py-4 text-base">
                Start Free
                <ArrowRightIcon className="h-4 w-4" />
              </AnimatedButton>
              <AnimatedButton href="#how-it-works" variant="ghost" className="px-6 py-4 text-base">
                See how it works
              </AnimatedButton>
            </div>
          </Reveal>
          <Reveal delay={0.4}>
            <div className="mt-12 flex items-center justify-center gap-6 text-sm text-zinc-500">
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                Read-only scans
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                Setup in 5 min
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Visual Demo — Score Preview */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="glass-card rounded-2xl border border-white/[0.06] p-8 sm:p-12">
              <div className="grid sm:grid-cols-3 gap-8 items-center">
                <div className="sm:col-span-1 flex flex-col items-center">
                  <div className="relative w-32 h-32">
                    <svg width="128" height="128" viewBox="0 0 128 128">
                      <circle cx="64" cy="64" r="54" fill="none" stroke="#1e293b" strokeWidth="8" />
                      <circle
                        cx="64" cy="64" r="54" fill="none"
                        stroke="#f59e0b" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 54}`}
                        strokeDashoffset={`${2 * Math.PI * 54 * (1 - 0.42)}`}
                        transform="rotate(-90 64 64)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-amber-400">14</span>
                      <span className="text-xs text-zinc-500">Findings</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-3 text-center">Typical first scan</p>
                </div>
                <div className="sm:col-span-2 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Cost Optimization</span>
                    <span className="text-red-400 font-medium">5 critical</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full"><div className="h-1.5 bg-red-500 rounded-full" style={{ width: "70%" }} /></div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Security Gaps</span>
                    <span className="text-red-400 font-medium">3 high</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full"><div className="h-1.5 bg-red-500 rounded-full" style={{ width: "55%" }} /></div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Configuration Drift</span>
                    <span className="text-yellow-400 font-medium">4 medium</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full"><div className="h-1.5 bg-yellow-500 rounded-full" style={{ width: "40%" }} /></div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Resource Utilization</span>
                    <span className="text-yellow-400 font-medium">2 low</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full"><div className="h-1.5 bg-yellow-500 rounded-full" style={{ width: "25%" }} /></div>
                </div>
              </div>
              <div className="gradient-line mt-8 mb-6" />
              <p className="text-center text-zinc-500 text-sm">
                Axiom finds what matters and prioritizes it. <strong className="text-zinc-300">What&apos;s hiding in your cloud?</strong>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* How It Works */}
      <section id="how-it-works" className="py-20 relative">
        <div className="absolute inset-0 bg-grid-mesh opacity-20 pointer-events-none" aria-hidden />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Reveal>
            <div className="mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-[-0.04em]">How Axiom works.{" "}<span className="text-zinc-500">Scan to execution in minutes.</span></h2>
              <p className="mt-4 text-dim-paragraph text-lg max-w-2xl leading-relaxed">
                From first scan to approved execution plan <span className="dim-1">in under 5 minutes.</span>
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-8">
            <Stagger>
              {steps.map((step) => (
                <div key={step.number} className="relative animated-border card-inner-glow card-hover rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-colors">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} mb-6`}>
                    <step.icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="absolute top-8 right-8 text-5xl font-bold text-white/[0.04]">{step.number}</span>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-zinc-400 leading-relaxed text-sm">{step.description}</p>
                </div>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Features */}
      <section id="features" className="py-20 relative">
        <div className="absolute inset-0 bg-grid-mesh opacity-15 pointer-events-none" aria-hidden />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Reveal>
            <div className="mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-[-0.04em]">Built for trust.{" "}<span className="text-zinc-500">Every action is reversible.</span></h2>
              <p className="mt-4 text-dim-paragraph text-lg max-w-2xl leading-relaxed">
                We never touch your infrastructure without your explicit approval. <span className="dim-1">Every action is logged, every change is reversible.</span>
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Stagger>
              {features.map((f) => (
                <div key={f.title} className="animated-border card-inner-glow card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors">
                  <f.icon className="h-6 w-6 text-violet-400 mb-4" />
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Social proof */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-gradient">9</div>
                <p className="text-sm text-zinc-500 mt-1">Cognitive phases</p>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-emerald-400">14</div>
                <p className="text-sm text-zinc-500 mt-1">Workflow stages</p>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-fuchsia-400">0</div>
                <p className="text-sm text-zinc-500 mt-1">Changes without approval</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Pricing */}
      <section id="pricing" className="py-20 relative">
        <div className="absolute inset-0 bg-grid-mesh opacity-15 pointer-events-none" aria-hidden />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Reveal>
            <div className="mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-[-0.04em]">Simple pricing.{" "}<span className="text-zinc-500">Start free, scale when ready.</span></h2>
              <p className="mt-4 text-dim-paragraph text-lg max-w-2xl leading-relaxed">
                Start with a free scan. <span className="dim-1">Upgrade to the full autonomous agent when you&apos;re ready.</span>
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Stagger>
              {plans.map((plan) => (
                <div
                key={plan.name}
                className={`flex flex-col ${
                  plan.highlighted
                    ? "electric-card-featured"
                    : plan.name === "Enterprise"
                      ? "electric-card-enterprise"
                      : "electric-card"
                }`}
              >
                <div className="relative p-8 flex flex-col flex-1 z-10">
                  {plan.highlighted && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 text-xs font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/25 px-4 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gradient">{plan.price}</span>
                    {plan.period && <span className="text-zinc-500">{plan.period}</span>}
                  </div>
                  <p className="text-sm text-zinc-400 mt-2">{plan.description}</p>
                  <ul className="mt-6 space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <AnimatedButton
                    href={plan.ctaHref}
                    variant={plan.highlighted ? "primary" : "secondary"}
                    className={`mt-8 w-full justify-center ${plan.highlighted ? "btn-amber-shimmer" : ""}`}
                  >
                    {plan.cta}
                  </AnimatedButton>
                </div>
              </div>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-12 tracking-[-0.04em]">Frequently asked questions.</h2>
          </Reveal>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <details className="group animated-border rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                    {faq.q}
                    <span className="text-zinc-500 group-open:rotate-45 transition-transform text-xl">+</span>
                  </summary>
                  <p className="mt-4 text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] spotlight-orb opacity-20 pointer-events-none" aria-hidden />
        <div className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full bg-fuchsia-600/8 blur-[100px] pointer-events-none" aria-hidden />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <Reveal>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-[-0.04em]">
              What&apos;s hiding in your cloud?<br className="hidden sm:block" />
              <span className="text-zinc-500">Find out in 60 seconds.</span>
            </h2>
            <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto">
              Connect your AWS account, let Axiom scan and reason, and see exactly what needs fixing — prioritized and ready to act on.
            </p>
            <AnimatedButton href="/auth/signup?redirect=/operator/onboarding" variant="primary" className="btn-amber-shimmer px-10 py-4 text-base">
              Start Free — No Credit Card
              <ArrowRightIcon className="h-4 w-4" />
            </AnimatedButton>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
