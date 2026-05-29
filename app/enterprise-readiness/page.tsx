import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, ShieldCheckIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { Footer } from "@/components/Footer";

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

          {/* Hero — Huly numbered + coral underline */}
          <Reveal direction="up" blur>
            <header className="mb-12">
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4 inline-flex items-center gap-3">
                <span className="text-brand-coral/90 tabular-nums">E1</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                Enterprise trust architecture
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-[-0.04em] leading-[1.04]">
                Powerful, but{" "}
                <span className="relative inline-block">
                  controlled.
                  <span aria-hidden className="absolute left-0 -bottom-1 h-[3px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400 to-transparent opacity-85" />
                </span>
              </h1>
              <p className="text-base text-zinc-400 max-w-2xl">
                Axiom is designed so autonomous operations never compromise governance, auditability, or human oversight. Every action is approval-gated, fully audited, and reversible.
              </p>
            </header>
          </Reveal>

          <div className="section-divider my-12" />

          {/* Security & Access Model */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheckIcon className="h-6 w-6 text-violet-400" />
                <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-[-0.04em]">
                  Security &amp; access model
                </h2>
              </div>
              <p className="text-zinc-400 mb-4 max-w-3xl">
                We align with your security team's expectations: role-based access, auditability, and
                time-bound privileges. We do not ask for root credentials or shared passwords.
              </p>
              <Stagger className="grid gap-4 md:grid-cols-3">
                <div className="glass-card rounded-xl p-4 text-sm text-zinc-300 border border-white/[0.06] animated-border card-inner-glow card-shine-sweep card-reactive">
                  <p className="font-semibold mb-1">Identity &amp; roles</p>
                  <ul className="space-y-1">
                    <li>• Role-based access scoped to project or account</li>
                    <li>• Federation/SSO where available</li>
                    <li>• Temporary elevation if needed, with approval</li>
                  </ul>
                </div>
                <div className="glass-card rounded-xl p-4 text-sm text-zinc-300 border border-white/[0.06] animated-border card-inner-glow card-shine-sweep card-reactive">
                  <p className="font-semibold mb-1">Change &amp; deployment</p>
                  <ul className="space-y-1">
                    <li>• Infrastructure-as-code and CI/CD based changes</li>
                    <li>• Reviewable pull requests and pipelines</li>
                    <li>• No ad-hoc changes in production</li>
                  </ul>
                </div>
                <div className="glass-card rounded-xl p-4 text-sm text-zinc-300 border border-white/[0.06] animated-border card-inner-glow card-shine-sweep card-reactive">
                  <p className="font-semibold mb-1">Audit &amp; logging</p>
                  <ul className="space-y-1">
                    <li>• Activity logged in your cloud accounts</li>
                    <li>• Change history in version control and pipelines</li>
                    <li>• Access review support for security and compliance teams</li>
                  </ul>
                </div>
              </Stagger>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          {/* AI Governance & Risk */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <ClipboardDocumentCheckIcon className="h-6 w-6 text-violet-400" />
                <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-[-0.04em]">
                  AI governance &amp; risk management
                </h2>
              </div>
              <p className="text-zinc-400 mb-4 max-w-3xl">
                AI systems are treated like any other production system: scoped access, logging,
                and explicit ownership. We do not bypass your existing risk and compliance processes.
              </p>
              <Stagger className="grid gap-4 md:grid-cols-2">
                <div className="glass-card rounded-xl p-4 text-sm text-zinc-300 border border-white/[0.06] animated-border card-inner-glow card-shine-sweep card-reactive">
                  <p className="font-semibold mb-1">Data &amp; access boundaries</p>
                  <ul className="space-y-1">
                    <li>• AI endpoints restricted to approved data sources</li>
                    <li>• No training on sensitive data unless explicitly scoped and approved</li>
                    <li>• Clear separation between environments (dev/test/prod)</li>
                  </ul>
                </div>
                <div className="glass-card rounded-xl p-4 text-sm text-zinc-300 border border-white/[0.06] animated-border card-inner-glow card-shine-sweep card-reactive">
                  <p className="font-semibold mb-1">Monitoring &amp; incident process</p>
                  <ul className="space-y-1">
                    <li>• Request/response logging and usage metrics for AI workloads</li>
                    <li>• Cost and usage dashboards; alerts on anomalies</li>
                    <li>• Runbooks for investigation, rollback, and communication</li>
                  </ul>
                </div>
              </Stagger>
              <p className="text-xs text-zinc-500 mt-3">
                We do not claim compliance certifications on your behalf. Instead, we design
                architectures and processes so your existing compliance framework can be applied.
              </p>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          {/* Delivery & collaboration */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3 tracking-[-0.04em]">
                Delivery, collaboration, and support.
              </h2>
              <p className="text-zinc-400 mb-4 max-w-3xl">
                We work as an engineering partner, not a black box. Engagements are structured,
                scoped, and documented.
              </p>
              <Stagger className="grid gap-4 md:grid-cols-3 text-sm text-zinc-300">
                <div className="glass-card rounded-xl p-4 border border-white/[0.06] animated-border card-inner-glow card-shine-sweep card-reactive">
                  <p className="font-semibold mb-1">Discovery &amp; scoping</p>
                  <ul className="space-y-1">
                    <li>• Use-case, constraints, and success criteria defined up front</li>
                    <li>• Written scope and assumptions for each phase</li>
                    <li>• Alignment with your internal stakeholders</li>
                  </ul>
                </div>
                <div className="glass-card rounded-xl p-4 border border-white/[0.06] animated-border card-inner-glow card-shine-sweep card-reactive">
                  <p className="font-semibold mb-1">Implementation</p>
                  <ul className="space-y-1">
                    <li>• Iterative delivery with visible milestones</li>
                    <li>• Use of your tools (GitHub, ticketing, chat) where possible</li>
                    <li>• Regular touchpoints with technical leads</li>
                  </ul>
                </div>
                <div className="glass-card rounded-xl p-4 border border-white/[0.06] animated-border card-inner-glow card-shine-sweep card-reactive">
                  <p className="font-semibold mb-1">Handover &amp; aftercare</p>
                  <ul className="space-y-1">
                    <li>• Documentation and runbooks delivered at the end of each engagement</li>
                    <li>• Handover workshop for your team</li>
                    <li>• Optional follow-on support defined explicitly per engagement</li>
                  </ul>
                </div>
              </Stagger>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          {/* Axiom Trust Architecture */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3 tracking-[-0.04em]">
                Axiom trust architecture.
              </h2>
              <p className="text-zinc-400 mb-4 max-w-3xl">
                Built-in governance at every layer — the agent can never self-escalate, bypass approval, or execute without verified safety.
              </p>
              <Stagger className="grid gap-3 md:grid-cols-2 text-sm text-zinc-300">
                <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white mb-0.5">Read-only by default</p>
                    <p className="text-zinc-500 text-xs">Scans use IAM assume-role with least-privilege policies. No credentials stored.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white mb-0.5">Approval-gated execution</p>
                    <p className="text-zinc-500 text-xs">Every infrastructure change requires explicit human approval. The agent never auto-applies.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white mb-0.5">Pre-verified rollback</p>
                    <p className="text-zinc-500 text-xs">State captured before execution. Rollback plans validated. Recovery instructions in audit log.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white mb-0.5">Outcome memory</p>
                    <p className="text-zinc-500 text-xs">Failed actions auto-downgrade future recommendations from auto-fix to human review.</p>
                  </div>
                </div>
              </Stagger>
            </section>
          </Reveal>

          {/* Cross-links & CTA */}
          <Reveal direction="up" delay={0.1}>
            <section className="mt-10">
              <div className="glass-card rounded-2xl border border-white/[0.06] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 glow-border-card">
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-1 tracking-[-0.04em]">
                    See your infrastructure clearly.
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Connect a read-only IAM role. Get your intelligence report — cost savings, security findings, and execution plan — in minutes.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/auth/signup?redirect=/dashboard/connect-cloud"
                    className="btn-huly inline-flex items-center px-7 py-3 rounded-full bg-white text-zinc-900 text-sm font-semibold uppercase tracking-wide hover:bg-zinc-100 transition-all shadow-lg shadow-white/10"
                  >
                    Run Axiom
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    href="/contact"
                    className="btn-huly inline-flex items-center px-7 py-3 rounded-full border border-white/[0.12] text-sm font-semibold uppercase tracking-wide text-white hover:border-white/[0.20] hover:bg-white/[0.05] transition-all"
                  >
                    Talk to an Engineer
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>

              <Stagger className="mt-8 grid gap-4 md:grid-cols-3 text-sm text-zinc-300">
                <Link
                  href="/cloud-security"
                  className="glass-card rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-colors card-hover card-shine-sweep card-reactive"
                >
                  <p className="font-semibold mb-1">Cloud Security &amp; Access Model</p>
                  <p className="text-zinc-400 text-xs">
                    How we handle access, hardening, and visibility for cloud workloads.
                  </p>
                </Link>
                <Link
                  href="/axiom"
                  className="glass-card rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-colors card-hover card-shine-sweep card-reactive"
                >
                  <p className="font-semibold mb-1">Axiom Agent</p>
                  <p className="text-zinc-400 text-xs">
                    Autonomous cloud operations powered by AI intelligence.
                  </p>
                </Link>
                <Link
                  href="/case-studies"
                  className="glass-card rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-colors card-hover card-shine-sweep card-reactive"
                >
                  <p className="font-semibold mb-1">Representative Case Studies</p>
                  <p className="text-zinc-400 text-xs">
                    Examples of cloud, DevOps, and AI systems we design and implement.
                  </p>
                </Link>
              </Stagger>
            </section>
          </Reveal>
        </div>
      </main>

      <Footer />

      {/* Floating blur orbs */}
      <div className="ambient-drift absolute bottom-1/4 left-10 w-[380px] h-[340px] bg-brand-violet/[0.08] rounded-full blur-[120px] pointer-events-none" />
      <div className="ambient-drift absolute top-1/2 right-0 w-[420px] h-[360px] bg-brand-coral/[0.06] rounded-full blur-[130px] pointer-events-none" style={{ animationDelay: "-8s" }} />
      <div className="ambient-drift absolute top-1/4 left-1/3 w-[360px] h-[280px] bg-cyan-500/[0.04] rounded-full blur-[110px] pointer-events-none" style={{ animationDelay: "-14s" }} />
    </div>
  );
}
