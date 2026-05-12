"use client";

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
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

export default function AIInfrastructurePage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative">
      <div className="absolute inset-0 bg-grid-mesh opacity-20 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 noise-grain pointer-events-none" aria-hidden />
      {/* Floating blur orbs */}
      <div className="absolute -top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-violet-500/[0.06] blur-[130px] pointer-events-none" aria-hidden />
      <div className="absolute top-[40%] -left-40 w-[400px] h-[400px] rounded-full bg-fuchsia-500/[0.05] blur-[100px] pointer-events-none" aria-hidden />

      <div className="relative z-10">
        <Navigation />
        <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <nav aria-label="Breadcrumb" className="mb-6 text-xs text-zinc-500">
              <ol className="flex items-center space-x-2">
                <li><Link href="/" className="hover:text-violet-400 transition-colors">Home</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/ai-solutions" className="hover:text-violet-400 transition-colors">AI Solutions</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="font-semibold text-zinc-300">Secure AI Infrastructure</li>
              </ol>
            </nav>

            {/* 1. Overview */}
            <section id="overview" className="mb-12 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] spotlight-orb opacity-40 pointer-events-none" aria-hidden />
              <div className="relative">
                <Reveal direction="up" blur delay={0}>
                  <span className="huly-badge text-xs font-semibold text-violet-400 tracking-wide uppercase px-3 py-1 mb-4 inline-block">
                    AI Infrastructure
                  </span>
                </Reveal>
                <Reveal direction="up" blur delay={0.1}>
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-[-0.04em]">
                    Secure AI Infrastructure &amp; <span className="text-gradient">AI-Powered Applications</span>
                  </h1>
                </Reveal>
                <Reveal direction="up" blur delay={0.15}>
                  <p className="text-lg text-zinc-400 mb-6 max-w-3xl">
                    We design and deploy secure AI infrastructure—private LLM deployments, API-based integration, cloud model hosting, and logging and monitoring—so you can run AI-powered applications and features in production with confidence.
                  </p>
                </Reveal>
                <Reveal direction="up" blur delay={0.2}>
                  <div className="animated-border card-inner-glow card-hover bg-white/[0.02] rounded-2xl p-6 border border-white/[0.06] mb-8 hover:border-white/[0.12] transition-all">
                    <h2 className="text-xl font-semibold text-white mb-3">What we deliver</h2>
                    <ul className="space-y-2 text-zinc-400">
                      <li>&#8226; Private LLM deployments in your cloud</li>
                      <li>&#8226; API-based AI integration with your apps</li>
                      <li>&#8226; Cloud-based model hosting (AWS, Azure, GCP)</li>
                      <li>&#8226; Logging and monitoring for AI usage and cost</li>
                      <li>&#8226; AI chat interfaces, recommendations, and custom LLM integrations</li>
                    </ul>
                  </div>
                </Reveal>
              </div>
            </section>

            <div className="section-divider" />

            {/* 2. Technical Scope */}
            <div className="mt-12">
              <TechnicalSection {...aiTechnicalSection} />
            </div>

            {/* 3. Architecture Approach */}
            <ArchitectureBlock title="Engineering principles" principles={engineeringPrinciples} />

            {/* 4. Tooling & Stack */}
            <TechStackSection title="Tooling & stack" groups={techStackGroups} />

            <div className="section-divider" />

            {/* 5. Implementation Methodology */}
            <section className="mb-12 mt-12">
              <Reveal direction="up" blur>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-[-0.04em]">
                  Implementation <span className="text-gradient">methodology</span>
                </h2>
                <p className="text-zinc-400">{implementationMethodologyShort}</p>
              </Reveal>
            </section>

            {/* 6. Deliverables */}
            <DeliverableList title="Deliverables" items={aiDeliverables} />

            <div className="section-divider" />

            {/* 7. Engagement Model */}
            <section className="mb-12 mt-12">
              <Reveal direction="up" blur>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
                  Engagement <span className="text-gradient">model</span>
                </h2>
                <p className="text-zinc-400 mb-4">
                  We offer AI Readiness Assessment, Pilot Deployment, and full AI Platform Build. See engagement packages on the main AI Solutions page.
                </p>
                <Link href="/ai-solutions" className="text-violet-400 font-medium hover:text-violet-300 text-sm transition-colors">
                  View AI engagement options &rarr;
                </Link>
              </Reveal>
            </section>

            {/* 8. Ideal Clients */}
            <section className="mb-12">
              <Reveal direction="up" blur>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
                  Ideal <span className="text-gradient">clients</span>
                </h2>
              </Reveal>
              <ul className="space-y-2 text-zinc-300">
                {idealClientsAI.map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="text-violet-400 mr-2 mt-0.5">&#8226;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <WhatWeDoNotDo focusItems={whatWeFocusOn} notDoItems={whatWeDoNotDo} />

            <div className="section-divider" />

            {/* 9. FAQ */}
            <section className="mb-12 mt-12">
              <Reveal direction="up" blur>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
                  <span className="text-gradient">FAQ</span>
                </h2>
              </Reveal>
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

            <div className="gradient-line mt-8 mb-4" />

            <p className="mt-8">
              <Link href="/ai-solutions" className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
                &larr; Back to AI Solutions
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
