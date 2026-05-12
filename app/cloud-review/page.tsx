import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

export const metadata: Metadata = {
  title: "Cloud & AI Infrastructure Review Session",
  description:
    "A structured 20-30 minute cloud and AI infrastructure review for small engineering teams. Focused on security, deployments, cost, and AI usage--no sales pitch, just practical observations and next steps.",
  openGraph: {
    title: "Cloud & AI Infrastructure Review Session | Vision XIX Labs",
    description:
      "Short, structured review of your cloud security, deployments, cost, and AI usage. Designed for SaaS and growing engineering teams.",
    url: "https://visionxixlabs.com/cloud-review",
  },
  alternates: { canonical: "https://visionxixlabs.com/cloud-review" },
};

export default function CloudReviewPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none" />
      <div className="bg-dots absolute inset-0 pointer-events-none" />
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
                Cloud Review Session
              </li>
            </ol>
          </nav>

          <Reveal direction="up" delay={0.1}>
            <div className="mb-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 glass-card">
              <p className="text-xs font-semibold text-white mb-1">
                Prefer instant infrastructure intelligence? Run Axiom.
              </p>
              <p className="text-xs text-zinc-200 mb-3">
                Axiom provides automated infrastructure scoring and a 30-day plan. This Cloud Review Session is a human-led working session.
              </p>
              <Link
                href="/cloud-operator"
                className="btn-huly inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Run Axiom Analysis
              </Link>
            </div>
          </Reveal>

          {/* Hero */}
          <Reveal direction="up" blur>
            <header className="mb-12 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-[-0.04em]">
                Cloud &amp; AI Infrastructure <span className="text-gradient">Review Session</span>
              </h1>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                A 20-30 minute human-led working session to understand your current cloud and AI
                setup, surface risks and gaps, and outline practical next steps. Designed
                for SaaS startups and growing engineering teams.
              </p>
            </header>
          </Reveal>

          <div className="section-divider my-12" />

          {/* What we cover */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-12" aria-labelledby="what-we-cover-heading">
              <h2
                id="what-we-cover-heading"
                className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]"
              >
                What we <span className="text-gradient">cover</span>
              </h2>
              <p className="text-zinc-400 mb-4">
                The session is conversational and technical. We keep it focused so you
                leave with a clear picture of where you are today and what to do next.
              </p>
              <ol className="space-y-3 text-zinc-300 list-decimal list-inside">
                <li>
                  <span className="font-semibold">Your current state.</span>{" "}
                  Cloud provider, environments, deployment process, monitoring/logging,
                  and upcoming changes.
                </li>
                <li>
                  <span className="font-semibold">Risks &amp; gaps.</span>{" "}
                  Security, deployments, cost, and AI usage--framed against teams similar
                  to yours.
                </li>
                <li>
                  <span className="font-semibold">Example architecture model.</span>{" "}
                  How we think about secure, repeatable cloud foundations.
                </li>
                <li>
                  <span className="font-semibold">Security hardening flow.</span>{" "}
                  IAM, logging, guardrails, and access model improvements.
                </li>
                <li>
                  <span className="font-semibold">CI/CD improvement options.</span>{" "}
                  Moving away from manual console changes to safer, traceable pipelines.
                </li>
                <li>
                  <span className="font-semibold">AI integration model (if relevant).</span>{" "}
                  How to deploy AI assistants or features with clear access controls,
                  logging, and cost visibility.
                </li>
                <li>
                  <span className="font-semibold">Engagement model &amp; next steps.</span>{" "}
                  How a short assessment or fixed-scope sprint could look, if you decide
                  to move forward.
                </li>
              </ol>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          {/* Format & who it's for */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-12" aria-labelledby="format-heading">
              <h2
                id="format-heading"
                className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]"
              >
                Format &amp; who it&apos;s for
              </h2>
              <Stagger className="grid gap-6 md:grid-cols-2">
                <div className="glass-card rounded-xl border border-white/[0.06] p-5 animated-border card-inner-glow">
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Format
                  </h3>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li>20-30 minutes, remote, screenshare-friendly.</li>
                    <li>Engineering-focused conversation, not a sales presentation.</li>
                    <li>We use your real environment as the reference point.</li>
                  </ul>
                </div>
                <div className="glass-card rounded-xl border border-white/[0.06] p-5 animated-border card-inner-glow">
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Best fit
                  </h3>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li>SaaS startups and small engineering teams (roughly 5-50 people).</li>
                    <li>Running on AWS, Azure, or GCP.</li>
                    <li>
                      Experiencing concerns around security, deployments, cost, or AI
                      usage.
                    </li>
                  </ul>
                </div>
              </Stagger>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          {/* Demo walkthrough */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-12" aria-labelledby="demo-walkthrough-heading">
              <h2
                id="demo-walkthrough-heading"
                className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]"
              >
                What an example <span className="text-gradient">demo looks like</span>
              </h2>
              <p className="text-zinc-400 mb-4">
                To make this concrete, here&apos;s how a typical review runs for a SaaS
                team on AWS. The same structure applies to Azure and GCP.
              </p>
              <Stagger className="space-y-4 text-sm text-zinc-300">
                <div className="glass-card rounded-xl border border-white/[0.06] p-4 hover-lift">
                  <h3 className="font-semibold mb-1">1) Quick context (5 minutes)</h3>
                  <p>
                    You briefly walk through your product, current architecture at a high
                    level, and what&apos;s worrying you most (security, deployments, cost,
                    AI, or a mix).
                  </p>
                </div>
                <div className="glass-card rounded-xl border border-white/[0.06] p-4 hover-lift">
                  <h3 className="font-semibold mb-1">2) Architecture &amp; access review (10 minutes)</h3>
                  <p>
                    We sketch or refine a simple view of your environments (dev / test /
                    prod), networking, and IAM patterns. We highlight where access,
                    logging, or deployment controls might need tightening.
                  </p>
                </div>
                <div className="glass-card rounded-xl border border-white/[0.06] p-4 hover-lift">
                  <h3 className="font-semibold mb-1">3) Deployments, cost, and AI usage (10 minutes)</h3>
                  <p>
                    We look at how changes reach production today (manual vs CI/CD),
                    what you have for monitoring and alerts, and--if you&apos;re using
                    AI--how endpoints are secured and monitored.
                  </p>
                </div>
                <div className="glass-card rounded-xl border border-white/[0.06] p-4 hover-lift">
                  <h3 className="font-semibold mb-1">4) Concrete next steps (5 minutes)</h3>
                  <p>
                    We summarise 3-5 specific, realistic changes you could make over the
                    next few weeks, and how a short engagement or package might support
                    that if you choose to involve us.
                  </p>
                </div>
              </Stagger>
              <div className="mt-4 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-xs text-zinc-400">
                <p className="font-semibold mb-1">Example flow (text-based diagram)</p>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
{`Your context
  → Quick diagram of environments & IAM
    → Security & logging observations
      → Deployments / CI/CD observations
        → Cost & AI usage notes
          → 3–5 recommended next steps`}
                </pre>
              </div>
            </section>
          </Reveal>

          <div className="section-divider my-12" />

          {/* How to prepare */}
          <Reveal direction="up" delay={0.1}>
            <section className="mb-12" aria-labelledby="prepare-heading">
              <h2
                id="prepare-heading"
                className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]"
              >
                How to prepare (optional)
              </h2>
              <p className="text-zinc-400 mb-4">
                You don&apos;t need to prepare slides. If you have them handy, these are
                useful:
              </p>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>Rough architecture diagram or list of core services.</li>
                <li>How you currently deploy (manual, scripts, CI/CD tools).</li>
                <li>Any internal docs or notes on security or compliance expectations.</li>
                <li>Your main concern: security, deployments, cost, AI, or a mix.</li>
              </ul>
            </section>
          </Reveal>

          {/* CTA */}
          <Reveal direction="up" delay={0.1}>
            <section className="text-center">
              <p className="text-zinc-400 mb-3">
                If this sounds useful, the next step is simply to share a bit about your
                environment and priorities.
              </p>
              <p className="text-xs text-zinc-500 mb-4">
                For qualified teams, we offer a free 30-minute cloud health assessment as
                part of this review.
              </p>
              <Link
                href="/contact?topic=Cloud%20Security%20Review"
                className="btn-huly cta-glow inline-flex items-center px-6 py-3 bg-white text-zinc-900 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Book a Cloud Review Call
              </Link>
            </section>
          </Reveal>
        </div>
      </main>

      {/* Floating blur orbs */}
      <div className="absolute bottom-1/4 left-10 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-80 h-80 bg-fuchsia-600/8 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
