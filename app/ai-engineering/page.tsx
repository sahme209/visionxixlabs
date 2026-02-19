import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { aiDifferentiators } from "@/lib/aiCapabilitiesContent";

type AIPackage = {
  id: string;
  name: string;
  timeline: string;
  technicalScope: string[];
  securityConsiderations: string[];
  deliverables: string[];
  handover: string[];
};

const aiPackages: AIPackage[] = [
  {
    id: "ai-readiness",
    name: "AI Readiness Assessment",
    timeline: "2–3 weeks",
    technicalScope: [
      "Review of current cloud environment and data sources",
      "Inventory of existing AI experiments, tools, and APIs in use",
      "Assessment of security, access patterns, and logging around AI usage (if any)",
      "Gap analysis for data, infrastructure, and governance needed for production AI",
    ],
    securityConsiderations: [
      "Initial review of identity and access controls around AI-related systems",
      "High-level data classification for intended AI use cases",
      "Identification of potential data exposure paths (e.g. direct API calls to public LLMs)",
    ],
    deliverables: [
      "Short report on AI readiness across architecture, data, security, and operations",
      "Recommended use cases that can realistically move to production",
      "List of technical and process gaps to close before deployment",
    ],
    handover: [
      "Walk-through of findings with engineering and stakeholders",
      "Prioritized backlog of tasks for internal teams or later engagement",
    ],
  },
  {
    id: "ai-pilot",
    name: "AI Pilot Deployment",
    timeline: "4–8 weeks (single use case)",
    technicalScope: [
      "Selection of one concrete use case (e.g. internal assistant, workflow automation)",
      "Model and integration pattern selection (API-based, hosted model, or both)",
      "Design and implementation of retrieval or integration pipeline for one data domain",
      "Minimal but production-grade deployment path (non-prod + prod)",
    ],
    securityConsiderations: [
      "Role-based access to data sources and AI components",
      "No training on sensitive data unless explicitly agreed and designed for",
      "Logging of AI requests/responses for the pilot scope",
    ],
    deliverables: [
      "Working AI pilot deployed in your cloud account",
      "Architecture and data flow diagrams for the pilot",
      "Runbook for operating and iterating on the pilot",
    ],
    handover: [
      "Knowledge transfer session for developers and operators",
      "Documented next steps to scale or extend the pilot",
    ],
  },
  {
    id: "ai-infra-buildout",
    name: "AI Infrastructure Buildout",
    timeline: "8–16 weeks (multi-use-case platform)",
    technicalScope: [
      "Shared AI integration layer (API gateway or service) for multiple use cases",
      "Standardized retrieval pipelines and vector stores where needed",
      "Infrastructure-as-code and CI/CD for AI services and components",
      "Observability (metrics, logs, and traces) for AI workloads",
    ],
    securityConsiderations: [
      "Centralized role-based access and policy guardrails for AI services",
      "Data isolation across environments and teams",
      "Governance patterns for model and prompt changes (review and approval paths)",
    ],
    deliverables: [
      "Cloud-native AI infrastructure running in your AWS/Azure/GCP accounts",
      "Integration layer and reference implementations for initial use cases",
      "Dashboards for usage, cost, and health of AI workloads",
    ],
    handover: [
      "Handover workshops for engineering, security, and operations",
      "Documentation of patterns, guardrails, and extension guidelines",
    ],
  },
];

export const metadata: Metadata = {
  title: "AI Engineering & LLM Systems",
  description:
    "We engineer AI systems for production environments: secure, scalable, and cost-aware AI deployment inside your cloud.",
  openGraph: {
    title: "AI Engineering & LLM Systems | Vision XIX Labs",
    description:
      "Cloud-native AI infrastructure and LLM systems. Secure, scalable, and cost-aware AI deployment inside your cloud.",
    url: "https://visionxixlabs.com/ai-engineering",
  },
  alternates: { canonical: "https://visionxixlabs.com/ai-engineering" },
};

export default function AIEngineeringPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-6 text-xs text-slate-500 dark:text-slate-400"
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
                AI Engineering &amp; LLM Systems
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <section className="mb-16">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                AI Engineering &amp; LLM Systems
              </h1>
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-6">
                Designing secure, scalable, and production-ready AI systems inside your cloud environment.
              </p>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
                We focus on AI infrastructure, integration, and operations&mdash;not model research.
                Our work is about predictable, governed AI systems that fit your existing cloud, security, and delivery practices.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/free-review"
                  className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  Free Cloud &amp; AI Review
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center px-6 py-3 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 hover:-translate-y-0.5 transition-all"
                >
                  Talk to an Engineer
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </div>
          </section>

          {/* AI Differentiators */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
              Why Vision XIX for AI Engineering
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {aiDifferentiators.map((d) => (
                <div
                  key={d.title}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
                >
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{d.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{d.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 1 – AI Architecture & Strategy */}
          <section className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                AI Architecture &amp; Strategy
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
                Before building anything, we help teams make the right architectural decisions:
                what to build, what to integrate, and what to avoid. The goal is a design that
                can be deployed in production without surprises.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Build vs integrate
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                  Not every AI capability needs a bespoke system. We help you decide when
                  to integrate existing services and when a dedicated internal system is justified.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <li>• Off-the-shelf tools vs internal platforms</li>
                  <li>• Internal APIs vs direct vendor API calls</li>
                  <li>• What must live in your cloud vs what can stay external</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Fine-tuning vs Retrieval-Augmented Generation
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                  For many business use cases, RAG over your data is safer and more maintainable
                  than training or fine-tuning a model. We evaluate when fine-tuning is justified.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <li>• Data availability, quality, and labeling requirements</li>
                  <li>• Change rate of the underlying knowledge</li>
                  <li>• Operational complexity and monitoring for each approach</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Open-source vs API-based models
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                  We do not claim to build new foundation models. Instead, we help you select
                  between open-source deployments and managed APIs based on risk, cost, and control.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <li>• Data residency and privacy constraints</li>
                  <li>• Latency, throughput, and availability requirements</li>
                  <li>• Operational responsibility vs vendor-managed SLAs</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Cost and data pipeline planning
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                  We estimate realistic operating costs and define the data flows needed for
                  AI systems to be accurate and sustainable.
                </p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <li>• Token and request volume projections by environment</li>
                  <li>• Data ingestion, transformation, and indexing pipelines</li>
                  <li>• Security and isolation patterns for data used by AI</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 – LLM Integration Engineering */}
          <section className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                LLM Integration Engineering
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
                We design and implement the glue between models, your data, and your applications:
                retrieval pipelines, API layers, and policies that keep usage under control.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Retrieval pipelines &amp; vector stores
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Design of ingestion, chunking, embedding, and retrieval flows. We prioritize
                  predictable behavior over aggressive recall: clear data boundaries, versioned indexes,
                  and measurable impact on answers.
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Prompt and orchestration layer
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Centralized prompt templates, tools, and guardrails instead of prompts scattered across apps.
                  This makes it possible to reason about changes, roll back, and audit behavior.
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  API gateway and access control
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  We implement an integration surface that enforces authentication, rate limits,
                  and routing. Clients talk to your API; your API talks to one or more model providers.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 – AI Infrastructure & Deployment */}
          <section className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                AI Infrastructure &amp; Deployment
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
                We deploy AI workloads as part of your cloud platform: inference endpoints, containerized services,
                and pipelines that treat AI like any other production component.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Cloud-based inference endpoints
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Hosted endpoints for models or orchestration services, deployed in your AWS, Azure, or GCP account.
                  Integrated with your networking, identity, and monitoring.
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  GPU vs API cost strategy
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  We model the tradeoffs between managed APIs and self-hosted models:
                  utilization patterns, engineering overhead, and long-term cost.
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  CI/CD and version control
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Models, prompts, and orchestration code are deployed via pipelines and tracked in version control.
                  This makes changes auditable and reversible.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 – AI Security & Governance */}
          <section className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                AI Security &amp; Governance
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
                We design AI systems to respect existing security and governance practices:
                role-based access, data isolation, logging, and traceability by default.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Access and data boundaries
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <li>• Role-based access to AI endpoints and underlying data</li>
                  <li>• Isolation between environments and tenants where applicable</li>
                  <li>• Explicit control over what data AI systems can see and use</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Logging, monitoring, and cost anomalies
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <li>• Request/response logging for investigation and support</li>
                  <li>• Usage metrics and dashboards (latency, errors, volume)</li>
                  <li>• Alerts for cost or usage anomalies without claiming certifications</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 5 – AI Cost Optimization */}
          <section className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                AI Cost Optimization
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
                We treat AI as part of your FinOps practice: visibility, guardrails, and
                iterative optimization&mdash;not guesswork or one-off cost cuts.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Token and model strategies
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <li>• Prompt and context window design to avoid unnecessary tokens</li>
                  <li>• Model selection by use case (not everything needs the largest model)</li>
                  <li>• Caching and reuse where responses can be safely reused</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Architecture and control
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <li>• Hybrid use of APIs and hosted models where it makes economic sense</li>
                  <li>• Rate limits and quotas per environment, team, or application</li>
                  <li>• Dashboards for cost by project, feature, or client</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Who this is for */}
          <section className="mb-16">
            <div className="mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Who this is for
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
                We work with teams that need AI systems to behave like any other production system:
                secure, observable, and maintainable.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                <li>• SaaS startups adding AI features to existing products</li>
                <li>• Companies building internal AI assistants on top of internal data</li>
                <li>• Teams experimenting with custom or open-source models and needing a path to production</li>
              </ul>
              <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                <li>• Businesses concerned about AI-related data exposure and governance</li>
                <li>• Companies seeing high or unpredictable AI API bills and wanting cost control</li>
              </ul>
            </div>
          </section>

          {/* Engagement packages */}
          <section className="mb-16">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                AI engagement packages
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                Structured ways to get started with AI in production&mdash;from assessment to
                pilot to platform. Timelines are indicative and depend on scope and access.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {aiPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col"
                >
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    {pkg.name}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
                    Approx. timeline: {pkg.timeline}
                  </p>
                  <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 flex-1">
                    <div>
                      <p className="font-semibold mb-1">Technical scope</p>
                      <ul className="list-disc list-inside space-y-1">
                        {pkg.technicalScope.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Security considerations</p>
                      <ul className="list-disc list-inside space-y-1">
                        {pkg.securityConsiderations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Deliverables</p>
                      <ul className="list-disc list-inside space-y-1">
                        {pkg.deliverables.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Handover</p>
                      <ul className="list-disc list-inside space-y-1">
                        {pkg.handover.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link
                      href="/contact"
                      className="inline-flex items-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Discuss this option
                      <ArrowRightIcon className="ml-1 h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Technical depth – how we make tradeoffs */}
          <section className="mb-20">
            <div className="mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Technical depth: how we make decisions
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
                We engineer AI systems for production environments. That means explicit tradeoffs,
                documented assumptions, and designs that your team can operate after we step away.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Model selection and retrieval vs fine-tune
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  We start with business constraints (latency, accuracy, data sensitivity) and only
                  then pick models and patterns. Often, retrieval over your data plus a managed model
                  is the right answer; fine-tuning is reserved for cases where it clearly adds value
                  and you can support the lifecycle.
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Hosting vs API and scaling
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  For some teams, fully managed APIs are the right choice; for others, hosting models
                  in their own cloud is required. We compare utilization patterns, regulatory needs,
                  and operational capacity before recommending one or a hybrid. Scaling plans are
                  defined in terms of load, failure modes, and budgets&mdash;not vague promises.
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm md:col-span-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Governance and operations
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Governance is not marketing language&mdash;it is a combination of access controls,
                  logging, approvals, and runbooks. We align AI systems with your existing
                  governance processes: who can change prompts, who can add a new model, how changes
                  are reviewed, and how incidents are handled. We do not claim certifications you do
                  not have; instead, we design with compliance requirements in mind.
                </p>
              </div>
            </div>
          </section>

          {/* Cross-links */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Looking for a broader view of AI offerings?
            </p>
            <Link
              href="/ai-solutions"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Explore AI Solutions →
            </Link>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Prefer to start with a short working session?
            </p>
            <Link
              href="/free-review"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Free Cloud &amp; AI Infrastructure Review →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

