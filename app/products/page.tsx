"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CpuChipIcon,
  CodeBracketIcon,
  ChatBubbleLeftRightIcon,
  CloudIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { Footer } from "@/components/Footer";

const PRODUCTS = [
  {
    id: "axiom",
    name: "Axiom",
    tagline: "Autonomous Cloud Operations",
    description:
      "AI-powered cloud operations agent that scans your infrastructure, reasons about issues, generates execution plans, and applies approved changes — with continuous drift monitoring and outcome learning.",
    icon: CpuChipIcon,
    href: "/axiom",
    pricingHref: "/operator/pricing",
    features: [
      "12-step autonomous reasoning loop",
      "Cost, security, and drift analysis",
      "Terraform code generation",
      "Governance with approval gates",
      "Multi-cloud: AWS, Azure, GCP",
      "Immutable audit trail",
    ],
    accentColor: "indigo",
    borderClass: "border-indigo-500/30 hover:border-indigo-500/50",
    glowClass: "bg-indigo-500/[0.04]",
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-400",
    dotColor: "bg-indigo-400",
  },
  {
    id: "builder",
    name: "Website Builder",
    tagline: "AI-Powered Web Development",
    description:
      "Describe what you want, get a production-ready website. AI generates responsive, accessible code with hosting, CDN, and CI/CD — deploy in minutes, not weeks.",
    icon: CodeBracketIcon,
    href: "/builder",
    pricingHref: "/builder/pricing",
    features: [
      "AI code generation from prompts",
      "Production-ready React/Next.js output",
      "Built-in hosting and CDN",
      "CI/CD pipeline included",
      "White-label branding",
      "Responsive by default",
    ],
    accentColor: "cyan",
    borderClass: "border-cyan-500/30 hover:border-cyan-500/50",
    glowClass: "bg-cyan-500/[0.04]",
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
    dotColor: "bg-cyan-400",
  },
  {
    id: "ai-assistant",
    name: "AI Assistant",
    tagline: "Intelligent Cloud Guidance",
    description:
      "Chat-based AI assistant trained on cloud architecture, DevOps, and infrastructure best practices. Get answers, generate configs, and troubleshoot issues in real time.",
    icon: ChatBubbleLeftRightIcon,
    href: "/visionxix-ai-assistant",
    pricingHref: "/visionxix-ai/pricing",
    features: [
      "Cloud architecture guidance",
      "Real-time troubleshooting",
      "Config generation",
      "Security best practices",
      "Cost optimization advice",
      "Embeddable widget",
    ],
    accentColor: "violet",
    borderClass: "border-violet-500/30 hover:border-violet-500/50",
    glowClass: "bg-violet-500/[0.04]",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
    dotColor: "bg-violet-400",
  },
  {
    id: "cloud-studio",
    name: "Cloud Studio",
    tagline: "Infrastructure Analysis Platform",
    description:
      "Upload your cloud config or connect your account. Get a comprehensive analysis of cost optimization opportunities, security gaps, and architecture recommendations.",
    icon: CloudIcon,
    href: "/cloud-studio",
    pricingHref: "/operator/pricing",
    features: [
      "One-click cloud analysis",
      "Cost optimization report",
      "Security posture assessment",
      "Architecture recommendations",
      "Exportable reports",
      "Team collaboration",
    ],
    accentColor: "emerald",
    borderClass: "border-emerald-500/30 hover:border-emerald-500/50",
    glowClass: "bg-emerald-500/[0.04]",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    dotColor: "bg-emerald-400",
  },
];

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-dots opacity-20" aria-hidden />
      <div className="absolute -top-60 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/[0.04] blur-[120px]" aria-hidden />
      <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full bg-blue-600/[0.04] blur-[100px]" aria-hidden />
      <div className="absolute bottom-40 left-10 w-72 h-72 rounded-full bg-cyan-600/[0.04] blur-[100px]" aria-hidden />

      <Navigation />

      {/* Hero */}
      <section className="pt-36 pb-16 text-center px-4 relative">
        <div className="beam-sweep absolute inset-0" aria-hidden />
        <Reveal>
          <p className="text-sm font-semibold text-blue-400 mb-4 tracking-wide uppercase">Products</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Everything you need to<br className="hidden sm:block" />
            operate your cloud
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
            From autonomous infrastructure operations to AI-powered development — a unified platform
            built for modern engineering teams.
          </p>
        </Reveal>
      </section>

      {/* Products Grid */}
      <section className="pb-28 px-4">
        <div className="max-w-6xl mx-auto">
          <Stagger className="grid md:grid-cols-2 gap-8" interval={0.1}>
            {PRODUCTS.map((product) => {
              const Icon = product.icon;
              return (
                <div
                  key={product.id}
                  className={`group electric-card card-shine-sweep relative flex flex-col transition-all duration-500 ${product.borderClass}`}
                >
                  <div className={`absolute inset-0 ${product.glowClass} rounded-[1.25rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700`} aria-hidden />

                  <div className="relative p-8 flex flex-col flex-1 z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl ${product.iconBg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${product.iconColor}`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{product.name}</h3>
                        <p className={`text-xs font-medium ${product.iconColor}`}>{product.tagline}</p>
                      </div>
                    </div>

                    <p className="text-sm text-zinc-400 leading-relaxed mb-6">{product.description}</p>

                    <ul className="space-y-2.5 flex-1 mb-8">
                      {product.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                          <span className={`w-1.5 h-1.5 rounded-full ${product.dotColor}`} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center gap-3">
                      <Link
                        href={product.href}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.06)]"
                      >
                        Learn more
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={product.pricingHref}
                        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                      >
                        Pricing
                        <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* Platform Benefits */}
      <section className="pb-24 px-4">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">One platform, unified experience</h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                All products share authentication, billing, and data — no integration overhead.
              </p>
            </div>
          </Reveal>
          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" interval={0.06}>
            {[
              { icon: SparklesIcon, title: "Unified billing", desc: "One membership, all products." },
              { icon: ShieldCheckIcon, title: "Enterprise-grade", desc: "SOC 2, SSO, audit logging." },
              { icon: BoltIcon, title: "White-label ready", desc: "Your brand, no extra cost." },
              { icon: CloudIcon, title: "Multi-cloud", desc: "AWS, Azure, GCP support." },
            ].map((item) => (
              <div key={item.title} className="electric-card card-shine-sweep p-5 text-center">
                <div className="relative z-10">
                  <item.icon className="h-7 w-7 text-blue-400 mx-auto mb-3" />
                  <p className="font-semibold text-white text-sm mb-1">{item.title}</p>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-white/[0.04] text-center px-4 relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-indigo-500/5 blur-[100px]" aria-hidden />
        <Reveal>
          <h2 className="text-3xl font-bold mb-5">Ready to get started?</h2>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">7 days free on any paid plan. No credit card required.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/operator/onboarding"
              className="btn-amber-shimmer inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.08)]"
            >
              Run Axiom
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/operator/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] px-8 py-3.5 text-sm font-semibold text-zinc-400 hover:text-white hover:border-white/[0.2] transition-colors"
            >
              View pricing
            </Link>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
