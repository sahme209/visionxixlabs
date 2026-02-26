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
  title: "Internal AI Assistants",
  description:
    "Company knowledge copilots, document search, ticket triage, and Slack/Teams AI bots. Deploy internal AI assistants securely in your cloud.",
  openGraph: { url: "https://visionxixlabs.com/ai-solutions/internal-ai" },
  alternates: { canonical: "https://visionxixlabs.com/ai-solutions/internal-ai" },
};

export default function InternalAIPage() {
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
                Internal AI Assistants
              </li>
            </ol>
          </nav>

          {/* 1. Overview */}
          <section id="overview" className="mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Internal AI Assistants
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
              We build AI that works with your company knowledge and tools—knowledge copilots, document search, ticket triage, and Slack or Teams bots—deployed securely inside your cloud.
            </p>
            <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 mb-8">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                What we deliver
              </h2>
              <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                <li>• Company knowledge copilots and document search systems</li>
                <li>• Ticket triage and support assistants</li>
                <li>• Slack / Teams AI bots integrated with your data</li>
                <li>• Secure deployment in your AWS, Azure, or GCP environment</li>
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
          <section id="engagement" className="mb-12">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Engagement model
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We offer AI Readiness Assessment, Pilot Deployment, and full AI Platform Build. See engagement packages and next steps on the main AI Solutions page.
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
            title="Ready to deploy internal AI securely?"
            subtitle="Talk to us about your use case. We'll help you design and deploy AI that fits your cloud and your data."
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
