import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { SecurityServiceCard } from "@/components/SecurityServiceCard";
import { SecurityPrinciplesBlock } from "@/components/SecurityPrinciplesBlock";
import { AccessModelSection } from "@/components/AccessModelSection";
import { FAQAccordion } from "@/components/FAQAccordion";
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
    "Secure-by-design cloud engineering. Security baseline, DevOps hardening, AI security review, visibility and monitoring — practical hardening without exaggerated claims.",
  openGraph: {
    title: "Cloud Security & Infrastructure Hardening | Vision XIX Labs",
    description: "Practical cloud security hardening and deployment discipline. Role-based access, no shared credentials, auditable changes.",
    url: "https://visionxixlabs.com/cloud-security",
  },
  alternates: { canonical: "https://visionxixlabs.com/cloud-security" },
};

export default function CloudSecurityPage() {
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
                <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Cloud Security
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <header className="mb-16 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {cloudSecurityHero.title}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {cloudSecurityHero.subtitle}
            </p>
          </header>

          {/* Security services */}
          <section
            className="mb-16"
            aria-labelledby="services-heading"
          >
            <h2 id="services-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
              Security offerings
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl">
              Structured services to harden your cloud environment and deployment process. No fear-based marketing — clear scope and deliverables.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              {cloudSecurityServices.map((service) => (
                <SecurityServiceCard
                  key={service.id}
                  {...service}
                  ctaHref="/contact"
                  ctaLabel="Discuss this service"
                />
              ))}
            </div>
          </section>

          {/* How we access your environment + What we are not */}
          <AccessModelSection
            weOperateUsing={accessModelItems}
            whatWeAreNot={whatWeAreNot}
            whatWeFocusOn={whatWeFocusOnSecurity}
          />

          {/* Trust principles */}
          <SecurityPrinciplesBlock
            title="Trust and transparency"
            items={securityPrinciples}
          />

          {/* FAQ */}
          <section className="mt-16" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
              Frequently asked questions
            </h2>
            <FAQAccordion items={cloudSecurityFAQ} />
          </section>

          {/* CTA */}
          <div className="mt-16 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Book a cloud review call to walk through your environment, risks, and improvement options.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Includes a free 30-minute cloud health assessment for qualified teams.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Book a Cloud Review Call
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
