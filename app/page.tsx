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
import { cloudFAQ } from "@/lib/cloudContent";

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

      {/* Outcome cards — what Axiom delivers */}
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

      {/* How it works — connected service pipeline */}
      <AnimateOnScroll>
        <section id="how-it-works" className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80">
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
              <div className="text-xs text-slate-600 dark:text-slate-400">Full support</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Azure</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Coming soon</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">GCP</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Coming soon</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">AI + IaC</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Intelligent automation</div>
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
          <FAQAccordion items={cloudFAQ.slice(0, 6)} />
        </div>
      </section>
      </AnimateOnScroll>

      {/* Contact Section */}
      <AnimateOnScroll>
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700" aria-labelledby="contact-heading">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="contact-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Ready to optimize your cloud?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10">
            Connect your AWS account in minutes. Axiom runs a read-only analysis and shows you exactly what to fix — no changes without your approval.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <Link
              href="/cloud-operator"
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
            Your cloud, fully understood
          </h2>
          <p className="text-slate-300 text-lg mb-8">
            Axiom connects to your AWS account, runs real analysis, and gives you clear recommendations — all read-only until you approve a change.
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
              href="/pricing"
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
                AI-powered cloud operations for AWS, Azure, and GCP. Connect, analyze, and optimize — with full control.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/cloud-operator" className="hover:text-white transition-colors">Run Axiom</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/insights" className="hover:text-white transition-colors">Insights</Link></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
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
