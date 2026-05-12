import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { CaseStudyBlock } from "@/components/CaseStudyBlock";
import { ArchitectureReferenceCard } from "@/components/ArchitectureReferenceCard";
import {
  caseStudiesHero,
  caseStudies,
  referenceArchitectures,
  caseStudiesDisclaimer,
} from "@/lib/caseStudiesContent";

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
    <div className="min-h-screen bg-[#09090b]">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
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
          <header className="mb-16 text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4">
              {caseStudiesHero.title}
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto">
              {caseStudiesHero.subtitle}
            </p>
            <p className="mt-3 text-xs md:text-sm text-zinc-500 max-w-2xl mx-auto">
              These are representative examples of Cloud &amp; AI Engineering work&mdash;architecture, integration,
              and operations. No client names, logos, or fabricated metrics.
            </p>
          </header>

          {/* Case Studies */}
          <section
            className="mb-20"
            aria-labelledby="case-studies-heading"
          >
            <h2
              id="case-studies-heading"
              className="text-2xl font-bold text-white mb-8"
            >
              Representative engagements
            </h2>
            <div className="space-y-10">
              {caseStudies.map((study, index) => (
                <CaseStudyBlock
                  key={study.id}
                  study={study}
                  index={index + 1}
                />
              ))}
            </div>
          </section>

          {/* Section separator */}
          <hr className="border-white/[0.06] mb-16" />

          {/* Reference Architectures */}
          <section
            className="mb-16"
            aria-labelledby="reference-arch-heading"
          >
            <h2
              id="reference-arch-heading"
              className="text-2xl font-bold text-white mb-6"
            >
              Reference architecture models
            </h2>
            <p className="text-zinc-400 mb-8 max-w-2xl">
              High-level blueprints for common patterns. Core components, access model, deployment, observability, and cost control.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {referenceArchitectures.map((arch) => (
                <ArchitectureReferenceCard
                  key={arch.id}
                  architecture={arch}
                />
              ))}
            </div>
          </section>

          {/* Disclaimer */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="text-sm text-zinc-400 italic">
              {caseStudiesDisclaimer}
            </p>
          </section>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Link
              href="/contact"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-white text-zinc-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Discuss your requirements
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
