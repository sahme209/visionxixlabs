import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { CaseStudyBlock } from "@/components/CaseStudyBlock";
import { ArchitectureReferenceCard } from "@/components/ArchitectureReferenceCard";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import {
  caseStudiesHero,
  caseStudies,
  referenceArchitectures,
  caseStudiesDisclaimer,
} from "@/lib/caseStudiesContent";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Engineering Case Studies & Reference Architectures",
  description:
    "Representative engineering engagements: cloud modernization, CI/CD, cost optimization, secure AI deployment, multi-environment infrastructure. Example architectures and capability demonstrations.",
  openGraph: {
    title: "Engineering Case Studies & Reference Architectures | Vision XIX Labs",
    description:
      "Representative cloud, DevOps, and AI engagements. Reference architecture models for SaaS, CI/CD, AI, and governance.",
    url: "https://visionxixlabs.com/case-studies",
  },
  alternates: { canonical: "https://visionxixlabs.com/case-studies" },
};

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-mesh opacity-10 pointer-events-none" aria-hidden />
      <div className="spotlight-orb absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-600/[0.06] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-40 right-0 w-80 h-80 rounded-full bg-fuchsia-600/[0.04] blur-[120px] pointer-events-none" aria-hidden />

      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-8 text-xs text-zinc-500"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link
                  href="/"
                  className="hover:text-violet-400"
                >
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Case Studies
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <Reveal direction="up" blur delay={0.05}>
            <header className="mb-16 text-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-[-0.04em]">
                <span className="text-gradient">{caseStudiesHero.title}</span>
              </h1>
              <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto">
                {caseStudiesHero.subtitle}
              </p>
              <p className="mt-3 text-xs md:text-sm text-zinc-500 max-w-2xl mx-auto">
                These are representative examples of Cloud &amp; AI Engineering work&mdash;architecture, integration,
                and operations. No client names, logos, or fabricated metrics.
              </p>
            </header>
          </Reveal>

          {/* Case Studies */}
          <section
            className="mb-20"
            aria-labelledby="case-studies-heading"
          >
            <Reveal direction="up" blur delay={0.1}>
              <h2
                id="case-studies-heading"
                className="text-2xl font-bold text-white mb-8 tracking-[-0.04em]"
              >
                Representative engagements
              </h2>
            </Reveal>
            <Stagger delay={0.12} interval={0.08}>
              <div className="space-y-10">
                {caseStudies.map((study, index) => (
                  <div key={study.id} className="animated-border card-inner-glow rounded-xl">
                    <CaseStudyBlock
                      study={study}
                      index={index + 1}
                    />
                  </div>
                ))}
              </div>
            </Stagger>
          </section>

          {/* Section separator */}
          <div className="section-divider mb-16" />

          {/* Reference Architectures */}
          <section
            className="mb-16"
            aria-labelledby="reference-arch-heading"
          >
            <Reveal direction="up" blur delay={0.1}>
              <h2
                id="reference-arch-heading"
                className="text-2xl font-bold text-white mb-6 tracking-[-0.04em]"
              >
                Reference architecture models
              </h2>
              <p className="text-zinc-400 mb-8 max-w-2xl">
                High-level blueprints for common patterns. Core components, access model, deployment, observability, and cost control.
              </p>
            </Reveal>
            <Stagger delay={0.1} interval={0.06}>
              <div className="grid gap-6 md:grid-cols-2">
                {referenceArchitectures.map((arch) => (
                  <div key={arch.id} className="glow-border-card card-hover">
                    <ArchitectureReferenceCard
                      architecture={arch}
                    />
                  </div>
                ))}
              </div>
            </Stagger>
          </section>

          {/* Disclaimer */}
          <Reveal direction="up" blur delay={0.1}>
            <section className="glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <p className="text-sm text-zinc-400 italic">
                {caseStudiesDisclaimer}
              </p>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          {/* CTA */}
          <Reveal direction="up" blur delay={0.15}>
            <div className="mt-12 text-center">
              <AnimatedButton variant="primary" href="/contact">
                Discuss your requirements
              </AnimatedButton>
            </div>
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}
