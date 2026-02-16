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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-8 text-xs text-slate-500 dark:text-slate-400"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link
                  href="/"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400"
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
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-slate-100 mb-4">
              {caseStudiesHero.title}
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {caseStudiesHero.subtitle}
            </p>
          </header>

          {/* Case Studies */}
          <section
            className="mb-20"
            aria-labelledby="case-studies-heading"
          >
            <h2
              id="case-studies-heading"
              className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-8"
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
          <hr className="border-slate-200 dark:border-slate-700 mb-16" />

          {/* Reference Architectures */}
          <section
            className="mb-16"
            aria-labelledby="reference-arch-heading"
          >
            <h2
              id="reference-arch-heading"
              className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6"
            >
              Reference architecture models
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl">
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
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 italic">
              {caseStudiesDisclaimer}
            </p>
          </section>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Link
              href="/contact"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Discuss your requirements
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
