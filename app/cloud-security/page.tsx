import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { SecurityServiceCard } from "@/components/SecurityServiceCard";
import { SecurityPrinciplesBlock } from "@/components/SecurityPrinciplesBlock";
import { AccessModelSection } from "@/components/AccessModelSection";
import { FAQAccordion } from "@/components/FAQAccordion";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import {
  cloudSecurityHero,
  cloudSecurityServices,
  accessModelItems,
  whatWeAreNot,
  whatWeFocusOnSecurity,
  securityPrinciples,
  cloudSecurityFAQ,
} from "@/lib/cloudSecurityContent";

export const metadata: Metadata = {
  title: "Cloud Security & Infrastructure Hardening",
  description:
    "Secure-by-design cloud engineering. Security baseline enforcement, DevOps hardening, AI security review, zero-trust deployment, and measurable risk reduction.",
  openGraph: {
    title: "Cloud Security & Infrastructure Hardening | Vision XIX Labs",
    description: "Cloud security workflows with persisted audit evidence, role-aware access controls, and explicit connector state.",
    url: "https://visionxixlabs.com/cloud-security",
  },
  alternates: { canonical: "https://visionxixlabs.com/cloud-security" },
};

export default function CloudSecurityPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none" />
      <div className="bg-dots absolute inset-0 pointer-events-none" />
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-8 text-xs text-zinc-500"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/" className="hover:text-violet-400">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Cloud Security
              </li>
            </ol>
          </nav>

          {/* Hero — Huly numbered + coral underline */}
          <Reveal direction="up" blur>
            <header className="mb-16">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4 inline-flex items-center gap-3">
                <span className="text-brand-coral/90 tabular-nums">SC</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                Cloud security
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-[-0.04em] leading-[1.04]">
                <span className="relative inline-block">
                  {cloudSecurityHero.title}
                  <span aria-hidden className="absolute left-0 -bottom-1 h-[3px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400 to-transparent opacity-85" />
                </span>
              </h1>
              <p className="text-lg text-zinc-400 max-w-2xl">
                {cloudSecurityHero.subtitle}
              </p>
            </header>
          </Reveal>

          <div className="section-divider my-16" />

          {/* Security services */}
          <Reveal direction="up" delay={0.1}>
            <section
              className="mb-16"
              aria-labelledby="services-heading"
            >
              <h2 id="services-heading" className="text-2xl font-bold text-white mb-6 tracking-[-0.04em]">
                Security <span className="text-gradient">offerings</span>
              </h2>
              <p className="text-zinc-400 mb-8 max-w-2xl">
                Lock down your platform: hardened CI/CD, zero-trust deployment, security baseline enforcement. Clear scope, auditable outcomes, measurable risk reduction.
              </p>
              <Stagger className="grid gap-6 sm:grid-cols-2">
                {cloudSecurityServices.map((service) => (
                  <SecurityServiceCard
                    key={service.id}
                    {...service}
                    ctaHref="/contact"
                    ctaLabel="Discuss this service"
                  />
                ))}
              </Stagger>
            </section>
          </Reveal>

          <div className="section-divider my-16" />

          {/* How we access your environment + What we are not */}
          <Reveal direction="up" delay={0.1}>
            <AccessModelSection
              weOperateUsing={accessModelItems}
              whatWeAreNot={whatWeAreNot}
              whatWeFocusOn={whatWeFocusOnSecurity}
            />
          </Reveal>

          <div className="section-divider my-16" />

          {/* Trust principles */}
          <Reveal direction="up" delay={0.1}>
            <SecurityPrinciplesBlock
              title="Trust and transparency"
              items={securityPrinciples}
            />
          </Reveal>

          <div className="section-divider my-16" />

          {/* FAQ */}
          <Reveal direction="up" delay={0.1}>
            <section className="mt-16" aria-labelledby="faq-heading">
              <h2 id="faq-heading" className="text-2xl font-bold text-white mb-6 tracking-[-0.04em]">
                Frequently asked questions
              </h2>
              <FAQAccordion items={cloudSecurityFAQ} />
            </section>
          </Reveal>

          {/* CTA */}
          <Reveal direction="up" delay={0.1}>
            <div className="mt-16 text-center">
              <p className="text-zinc-400 mb-3">
                90-minute cloud security audit: governance maturity scorecard, compliance readiness assessment, and quantified risk reduction roadmap.
              </p>
              <p className="text-xs text-zinc-500 mb-4">
                Includes a structured 30-minute cloud health assessment with findings report.
              </p>
              <Link
                href="/contact"
                className="btn-huly cta-glow inline-flex items-center px-6 py-3 bg-white text-zinc-900 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Book a Security Audit
              </Link>
            </div>
          </Reveal>
        </div>
      </main>

      {/* Floating blur orbs */}
      <div className="ambient-drift absolute bottom-1/3 left-10 w-[380px] h-[340px] bg-brand-violet/[0.08] rounded-full blur-[120px] pointer-events-none" />
      <div className="ambient-drift absolute top-1/2 right-0 w-[420px] h-[360px] bg-brand-coral/[0.06] rounded-full blur-[130px] pointer-events-none" style={{ animationDelay: "-8s" }} />
      <div className="ambient-drift absolute top-1/4 right-1/4 w-[340px] h-[260px] bg-cyan-500/[0.04] rounded-full blur-[110px] pointer-events-none" style={{ animationDelay: "-14s" }} />
    </div>
  );
}
