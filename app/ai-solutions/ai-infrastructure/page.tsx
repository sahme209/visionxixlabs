import type { Metadata } from "next";
import Link from "next/link";
import { aiFAQ } from "../../../lib/aiContent";
import {
  aiTechnicalSection,
  engineeringPrinciples,
  techStackGroups,
  implementationMethodologyShort,
  aiDeliverables,
  idealClientsAI,
  whatWeFocusOn,
  whatWeDoNotDo,
} from "../../../lib/engineeringContent";
import { Navigation } from "../../../components/Navigation";
import { TechnicalSection } from "../../../components/TechnicalSection";
import { ArchitectureBlock } from "../../../components/ArchitectureBlock";
import { DeliverableList } from "../../../components/DeliverableList";
import { TechStackSection } from "../../../components/TechStackSection";
import { FAQAccordion } from "../../../components/FAQAccordion";
import { CTASection } from "../../../components/CTASection";
import { WhatWeDoNotDo } from "../../../components/WhatWeDoNotDo";

export const metadata: Metadata = {
  title: "Secure AI Infrastructure & AI Applications",
  description:
    "Private LLM deployments, API-based AI integration, cloud model hosting, and AI-powered applications. Production-grade secure AI infrastructure.",
  openGraph: { url: "https://visionxixlabs.com/ai-solutions/ai-infrastructure" },
  alternates: { canonical: "https://visionxixlabs.com/ai-solutions/ai-infrastructure" },
};

export default function AIInfrastructurePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 text-xs text-slate-500 dark:text-slate-400"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/ai-solutions" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  AI Solutions
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Secure AI Infrastructure
              </li>
            </ol>
          </nav>

          {/* 1. Overview */}
          <section id="overview" className="mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Secure AI Infrastructure & AI-Powered Applications
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
              We design and deploy secure AI infrastructure—private LLM deployments, API-based integration, cloud model hosting, and logging and monitoring—so you can run AI-powered applications and features in production with confidence.
            </p>
            <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 mb-8">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                What we deliver
              </h2>
              <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                <li>• Private LLM deployments in your cloud</li>
                <li>• API-based AI integration with your apps</li>
                <li>• Cloud-based model hosting (AWS, Azure, GCP)</li>
                <li>• Logging and monitoring for AI usage and cost</li>
                <li>• AI chat interfaces, recommendations, and custom LLM integrations</li>
              </ul>
            </div>
          </section>

          {/* 2. Technical Scope */}
          <TechnicalSection {...aiTechnicalSection} />

          {/* 3. Architecture Approach */}
          <ArchitectureBlock title="Engineering principles" principles={engineeringPrinciples} />

          {/* 4. Tooling & Stack */}
          <TechStackSection title="Tooling & stack" groups={techStackGroups} />

          {/* 5. Implementation Methodology */}
          <section className="mb-12">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Implementation methodology
            </h2>
            <p className="text-slate-600 dark:text-slate-400">{implementationMethodologyShort}</p>
          </section>

          {/* 6. Deliverables */}
          <DeliverableList title="Deliverables" items={aiDeliverables} />

          {/* 7. Engagement Model */}
          <section className="mb-12">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Engagement model
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We offer AI Readiness Assessment, Pilot Deployment, and full AI Platform Build. See engagement packages on the main AI Solutions page.
            </p>
            <Link href="/ai-solutions" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline text-sm">
              View AI engagement options →
            </Link>
          </section>

          {/* 8. Ideal Clients */}
          <section className="mb-12">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Ideal clients
            </h2>
            <ul className="space-y-2 text-slate-700 dark:text-slate-300">
              {idealClientsAI.map((item) => (
                <li key={item} className="flex items-start">
                  <span className="text-indigo-500 mr-2 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <WhatWeDoNotDo focusItems={whatWeFocusOn} notDoItems={whatWeDoNotDo} />

          {/* 9. FAQ */}
          <section className="mb-12">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              FAQ
            </h2>
            <FAQAccordion items={aiFAQ} />
          </section>

          {/* 10. CTA */}
          <CTASection
            title="Ready to run AI in production?"
            subtitle="Talk to us about your infrastructure and app needs. We'll help you deploy AI securely in your cloud."
            primaryLabel="Talk to an Engineer"
            primaryHref="/contact"
            secondaryLabel="Email Us"
            secondaryHref="mailto:support@visionxixlabs.com"
            plansHref="/visionxix-ai/pricing"
          />

          <p className="mt-8">
            <Link href="/ai-solutions" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium">
              ← Back to AI Solutions
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
