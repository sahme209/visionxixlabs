import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, ShieldCheckIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Enterprise Readiness & Engagement Model",
  description:
    "How we work with larger organizations: security and access model, governance, delivery approach, and support for Cloud & AI Engineering engagements.",
  openGraph: {
    title: "Enterprise Readiness & Engagement Model | Vision XIX Labs",
    description:
      "Security-first, automation-first, and cost-aware Cloud & AI Engineering. How we handle access, governance, delivery, and support for larger organizations.",
    url: "https://visionxixlabs.com/enterprise-readiness",
  },
  alternates: { canonical: "https://visionxixlabs.com/enterprise-readiness" },
};

export default function EnterpriseReadinessPage() {
  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
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
                Enterprise Readiness
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <header className="mb-12 text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-violet-500/10 px-4 py-1.5 text-xs font-semibold text-violet-400 mb-3">
              Cloud &amp; AI Engineering for Modern Infrastructure
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4">
              Enterprise readiness &amp; engagement model
            </h1>
            <p className="text-sm md:text-base text-zinc-400 max-w-2xl mx-auto">
              How we handle access, governance, delivery, and support when working with larger teams.
              No certifications or metrics claimed that you do not have&mdash;just clear engineering practices.
            </p>
          </header>

          {/* Security & Access Model */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheckIcon className="h-6 w-6 text-violet-400" />
              <h2 className="text-2xl font-bold text-white">
                Security &amp; access model
              </h2>
            </div>
            <p className="text-zinc-400 mb-4 max-w-3xl">
              We align with your security team’s expectations: role-based access, auditability, and
              time-bound privileges. We do not ask for root credentials or shared passwords.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 text-sm text-zinc-300">
                <p className="font-semibold mb-1">Identity &amp; roles</p>
                <ul className="space-y-1">
                  <li>• Role-based access scoped to project or account</li>
                  <li>• Federation/SSO where available</li>
                  <li>• Temporary elevation if needed, with approval</li>
                </ul>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 text-sm text-zinc-300">
                <p className="font-semibold mb-1">Change &amp; deployment</p>
                <ul className="space-y-1">
                  <li>• Infrastructure-as-code and CI/CD based changes</li>
                  <li>• Reviewable pull requests and pipelines</li>
                  <li>• No ad-hoc changes in production</li>
                </ul>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 text-sm text-zinc-300">
                <p className="font-semibold mb-1">Audit &amp; logging</p>
                <ul className="space-y-1">
                  <li>• Activity logged in your cloud accounts</li>
                  <li>• Change history in version control and pipelines</li>
                  <li>• Access review support for security and compliance teams</li>
                </ul>
              </div>
            </div>
          </section>

          {/* AI Governance & Risk */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <ClipboardDocumentCheckIcon className="h-6 w-6 text-violet-400" />
              <h2 className="text-2xl font-bold text-white">
                AI governance &amp; risk management
              </h2>
            </div>
            <p className="text-zinc-400 mb-4 max-w-3xl">
              AI systems are treated like any other production system: scoped access, logging,
              and explicit ownership. We do not bypass your existing risk and compliance processes.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 text-sm text-zinc-300">
                <p className="font-semibold mb-1">Data &amp; access boundaries</p>
                <ul className="space-y-1">
                  <li>• AI endpoints restricted to approved data sources</li>
                  <li>• No training on sensitive data unless explicitly scoped and approved</li>
                  <li>• Clear separation between environments (dev/test/prod)</li>
                </ul>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 text-sm text-zinc-300">
                <p className="font-semibold mb-1">Monitoring &amp; incident process</p>
                <ul className="space-y-1">
                  <li>• Request/response logging and usage metrics for AI workloads</li>
                  <li>• Cost and usage dashboards; alerts on anomalies</li>
                  <li>• Runbooks for investigation, rollback, and communication</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-3">
              We do not claim compliance certifications on your behalf. Instead, we design
              architectures and processes so your existing compliance framework can be applied.
            </p>
          </section>

          {/* Delivery & collaboration */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-3">
              Delivery, collaboration, and support
            </h2>
            <p className="text-zinc-400 mb-4 max-w-3xl">
              We work as an engineering partner, not a black box. Engagements are structured,
              scoped, and documented.
            </p>
            <div className="grid gap-4 md:grid-cols-3 text-sm text-zinc-300">
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                <p className="font-semibold mb-1">Discovery &amp; scoping</p>
                <ul className="space-y-1">
                  <li>• Use-case, constraints, and success criteria defined up front</li>
                  <li>• Written scope and assumptions for each phase</li>
                  <li>• Alignment with your internal stakeholders</li>
                </ul>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                <p className="font-semibold mb-1">Implementation</p>
                <ul className="space-y-1">
                  <li>• Iterative delivery with visible milestones</li>
                  <li>• Use of your tools (GitHub, ticketing, chat) where possible</li>
                  <li>• Regular touchpoints with technical leads</li>
                </ul>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                <p className="font-semibold mb-1">Handover &amp; aftercare</p>
                <ul className="space-y-1">
                  <li>• Documentation and runbooks delivered at the end of each engagement</li>
                  <li>• Handover workshop for your team</li>
                  <li>• Optional follow-on support defined explicitly per engagement</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Working with larger organizations */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-3">
              Working with larger organizations
            </h2>
            <p className="text-zinc-400 mb-4 max-w-3xl">
              We adapt to your procurement, security review, and change-management processes instead of
              asking you to work around ours.
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>• Willing to participate in security and architecture reviews with your internal teams</li>
              <li>• Happy to work within existing ticketing and change-control processes</li>
              <li>• Clear points of contact and escalation paths for each engagement</li>
            </ul>
          </section>

          {/* Cross-links & CTA */}
          <section className="mt-10">
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white mb-1">
                  Ready to review your environment?
                </h2>
                <p className="text-sm text-zinc-400">
                  Start with a Free Cloud &amp; AI Review or share your requirements directly.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/free-review"
                  className="inline-flex items-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Free Cloud &amp; AI Review
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center px-5 py-2.5 rounded-xl border border-white/[0.08] text-sm font-semibold text-white hover:border-slate-400 hover:border-white/[0.08] transition-colors"
                >
                  Talk to an Engineer
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3 text-sm text-zinc-300">
              <Link
                href="/cloud-security"
                className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 hover:border-indigo-400 hover:border-white/[0.08] transition-colors"
              >
                <p className="font-semibold mb-1">Cloud Security &amp; Access Model</p>
                <p className="text-zinc-400 text-xs">
                  How we handle access, hardening, and visibility for cloud workloads.
                </p>
              </Link>
              <Link
                href="/ai-engineering"
                className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 hover:border-indigo-400 hover:border-white/[0.08] transition-colors"
              >
                <p className="font-semibold mb-1">AI Engineering &amp; LLM Systems</p>
                <p className="text-zinc-400 text-xs">
                  Architecture, integration, and operations for production AI systems.
                </p>
              </Link>
              <Link
                href="/case-studies"
                className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 hover:border-indigo-400 hover:border-white/[0.08] transition-colors"
              >
                <p className="font-semibold mb-1">Representative Case Studies</p>
                <p className="text-zinc-400 text-xs">
                  Examples of cloud, DevOps, and AI systems we design and implement.
                </p>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

