"use client";

import Link from "next/link";
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
    description: "Link your AWS, Azure, or GCP account in under 2 minutes. Read-only access — we never modify your infrastructure without explicit approval.",
    icon: CloudIcon,
    color: "from-blue-500 to-cyan-500",
  },
  {
    number: "02",
    title: "See your risk score",
    description: "Our AI scans your infrastructure, identifies single points of failure, and scores your resilience from 0 to 100. Most single-cloud setups score below 30.",
    icon: ChartBarIcon,
    color: "from-violet-500 to-purple-500",
  },
  {
    number: "03",
    title: "Deploy standby infrastructure",
    description: "Review the AI-generated Terraform plan, approve it with one confirmation, and deploy standby infrastructure on a second cloud. Full control, zero surprises.",
    icon: BoltIcon,
    color: "from-emerald-500 to-green-500",
  },
];

const features = [
  {
    icon: ShieldCheckIcon,
    title: "Read-only scanning",
    description: "Discovery and security scans never modify your resources. Every action is logged.",
  },
  {
    icon: LockClosedIcon,
    title: "Approval required",
    description: "No infrastructure changes without your explicit typed confirmation: CONFIRM APPLY.",
  },
  {
    icon: CpuChipIcon,
    title: "AI-powered analysis",
    description: "Senior cloud architect AI analyzes your setup and recommends the simplest, safest path to resilience.",
  },
  {
    icon: CurrencyDollarIcon,
    title: "Cost transparency",
    description: "Know exactly how much standby infrastructure costs before you commit. Typically 20-35% of your current bill.",
  },
  {
    icon: ClockIcon,
    title: "5-minute RTO",
    description: "Active-Passive architecture means your standby is always warm. If your primary goes down, failover takes minutes, not hours.",
  },
  {
    icon: CloudIcon,
    title: "Multi-cloud ready",
    description: "AWS, Azure, and GCP supported. Start with one, add more as you grow. No vendor lock-in.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "See your risk. No credit card.",
    features: [
      "1 cloud connection",
      "Resilience score + report",
      "AI architecture recommendation",
      "Security scan (read-only)",
      "Community support",
    ],
    cta: "Start Free",
    ctaHref: "/auth/signup?plan=free&redirect=/operator/onboarding",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/month",
    description: "Deploy and monitor multi-cloud.",
    features: [
      "3 cloud connections",
      "Terraform generation + execution",
      "Weekly automated scans",
      "Cost impact analysis",
      "Axiom AI assistant",
      "Slack + email alerts",
      "Priority support",
    ],
    cta: "Start 14-day trial",
    ctaHref: "/auth/signup?plan=pro&redirect=/operator/onboarding",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For teams managing critical infrastructure.",
    features: [
      "Unlimited cloud connections",
      "Active-Active architecture",
      "Daily compliance scans",
      "Custom Terraform modules",
      "SSO + audit logging",
      "Dedicated account manager",
      "SLA guarantee",
      "On-call architecture review",
    ],
    cta: "Talk to us",
    ctaHref: "/contact?ref=operator-enterprise",
    highlighted: false,
  },
];

const faqs = [
  {
    q: "What if AWS goes down?",
    a: "That's exactly what we solve. Our AI detects your single-cloud dependency, recommends a standby setup on Azure or GCP, and generates the Terraform to deploy it. If AWS goes down, your standby is already running.",
  },
  {
    q: "Do you modify my infrastructure?",
    a: "Never without your approval. Scans are read-only. Terraform changes require you to type 'CONFIRM APPLY' before anything is deployed. Every action is logged and auditable.",
  },
  {
    q: "How long does setup take?",
    a: "About 5 minutes. Connect your cloud account, run the analysis, review the plan. Deploying standby infrastructure takes another 2-3 minutes after you approve.",
  },
  {
    q: "What does it cost to run standby infrastructure?",
    a: "Typically 20-35% of your current cloud bill. For Active-Passive, you're running minimal resources on the secondary cloud — just enough to failover quickly. We show you the exact cost before you approve.",
  },
  {
    q: "Can I use this for compliance?",
    a: "Yes. Multi-cloud resilience is a common requirement for SOC 2, ISO 27001, and FedRAMP. The resilience report and audit logs help demonstrate compliance.",
  },
];

export default function OperatorLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <nav className="border-b border-slate-800/50 backdrop-blur-sm sticky top-0 z-50 bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/operator" className="flex items-center gap-2">
            <CpuChipIcon className="h-7 w-7 text-violet-400" />
            <span className="font-bold text-lg">Cloud Operator</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
              Sign in
            </Link>
            <AnimatedButton href="/auth/signup?redirect=/operator/onboarding" variant="primary" className="text-sm px-4 py-2">
              Start Free
            </AnimatedButton>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center relative">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Now in public beta
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Stop depending on
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                a single cloud
              </span>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              AI Cloud Operator scans your infrastructure, scores your resilience, and deploys
              standby infrastructure on a second cloud — so one outage never takes you down.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <AnimatedButton href="/auth/signup?redirect=/operator/onboarding" variant="primary" className="px-8 py-4 text-base">
                Start Free
                <ArrowRightIcon className="h-4 w-4" />
              </AnimatedButton>
              <AnimatedButton href="#how-it-works" variant="ghost" className="px-6 py-4 text-base">
                See how it works
              </AnimatedButton>
            </div>
          </Reveal>
          <Reveal delay={0.4}>
            <div className="mt-12 flex items-center justify-center gap-6 text-sm text-slate-500">
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-8 sm:p-12">
              <div className="grid sm:grid-cols-3 gap-8 items-center">
                <div className="sm:col-span-1 flex flex-col items-center">
                  <div className="relative w-32 h-32">
                    <svg width="128" height="128" viewBox="0 0 128 128">
                      <circle cx="64" cy="64" r="54" fill="none" stroke="#1e293b" strokeWidth="8" />
                      <circle
                        cx="64" cy="64" r="54" fill="none"
                        stroke="#ef4444" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 54}`}
                        strokeDashoffset={`${2 * Math.PI * 54 * (1 - 0.23)}`}
                        transform="rotate(-90 64 64)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-red-400">23</span>
                      <span className="text-xs text-slate-500">Grade F</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-center">Typical single-cloud score</p>
                </div>
                <div className="sm:col-span-2 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Cloud Dependency</span>
                    <span className="text-red-400 font-medium">4/20</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full"><div className="h-1.5 bg-red-500 rounded-full" style={{ width: "20%" }} /></div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Regional Redundancy</span>
                    <span className="text-red-400 font-medium">3/20</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full"><div className="h-1.5 bg-red-500 rounded-full" style={{ width: "15%" }} /></div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Backup & Replication</span>
                    <span className="text-yellow-400 font-medium">8/20</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full"><div className="h-1.5 bg-yellow-500 rounded-full" style={{ width: "40%" }} /></div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Security Exposure</span>
                    <span className="text-yellow-400 font-medium">8/20</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full"><div className="h-1.5 bg-yellow-500 rounded-full" style={{ width: "40%" }} /></div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Monitoring & Recovery</span>
                    <span className="text-red-400 font-medium">0/20</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full"><div className="h-1.5 bg-red-500 rounded-full" style={{ width: "0%" }} /></div>
                </div>
              </div>
              <p className="text-center text-slate-500 text-sm mt-8 border-t border-slate-800 pt-6">
                This is what most single-cloud companies look like. <strong className="text-slate-300">What&apos;s your score?</strong>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold">Three steps to multi-cloud resilience</h2>
              <p className="mt-4 text-slate-400 text-lg max-w-2xl mx-auto">
                From single point of failure to production-grade redundancy in under 10 minutes.
              </p>
            </div>
          </Reveal>
          <Stagger className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-8 hover:border-slate-700 transition-colors">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} mb-6`}>
                  <step.icon className="h-6 w-6 text-white" />
                </div>
                <span className="absolute top-8 right-8 text-5xl font-bold text-slate-800/50">{step.number}</span>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{step.description}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-slate-900/30 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold">Built for trust</h2>
              <p className="mt-4 text-slate-400 text-lg max-w-2xl mx-auto">
                We never touch your infrastructure without your explicit approval. Every action is logged, every change is reversible.
              </p>
            </div>
          </Reveal>
          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition-colors">
                <f.icon className="h-6 w-6 text-violet-400 mb-4" />
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20 border-t border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-violet-400">500+</div>
                <p className="text-sm text-slate-500 mt-1">Scans completed</p>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-emerald-400">99.9%</div>
                <p className="text-sm text-slate-500 mt-1">Uptime achieved</p>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-fuchsia-400">5 min</div>
                <p className="text-sm text-slate-500 mt-1">Average RTO</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-slate-900/30 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold">Simple pricing</h2>
              <p className="mt-4 text-slate-400 text-lg">
                Start free. Upgrade when you need Terraform execution and monitoring.
              </p>
            </div>
          </Reveal>
          <Stagger className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 flex flex-col ${
                  plan.highlighted
                    ? "border-violet-500/50 bg-violet-950/20 ring-1 ring-violet-500/20"
                    : "border-slate-800 bg-slate-900/50"
                }`}
              >
                {plan.highlighted && (
                  <span className="text-xs font-medium text-violet-300 bg-violet-500/10 px-2.5 py-1 rounded-full self-start mb-4">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-slate-500">{plan.period}</span>}
                </div>
                <p className="text-sm text-slate-400 mt-2">{plan.description}</p>
                <ul className="mt-6 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircleIcon className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <AnimatedButton
                  href={plan.ctaHref}
                  variant={plan.highlighted ? "primary" : "secondary"}
                  className="mt-8 w-full justify-center"
                >
                  {plan.cta}
                </AnimatedButton>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-12">Frequently asked questions</h2>
          </Reveal>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <details className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                  <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                    {faq.q}
                    <span className="text-slate-500 group-open:rotate-45 transition-transform text-xl">+</span>
                  </summary>
                  <p className="mt-4 text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-b from-slate-950 via-violet-950/10 to-slate-950 border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              What&apos;s your resilience score?
            </h2>
            <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
              Connect your cloud, get your score, and see exactly what it takes to stop depending on a single provider.
            </p>
            <AnimatedButton href="/auth/signup?redirect=/operator/onboarding" variant="primary" className="px-10 py-4 text-base">
              Start Free — No Credit Card
              <ArrowRightIcon className="h-4 w-4" />
            </AnimatedButton>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CpuChipIcon className="h-5 w-5 text-violet-400" />
              <span className="font-semibold text-sm">Cloud Operator</span>
              <span className="text-xs text-slate-600 ml-2">by Vision XIX Labs</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
              <Link href="/terms" className="hover:text-slate-300">Terms</Link>
              <Link href="/contact" className="hover:text-slate-300">Contact</Link>
              <span>support@visionxixlabs.com</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
