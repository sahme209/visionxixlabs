"use client";

import { AnimateOnScroll } from "@/components/AnimateOnScroll";

const GOVERNANCE = [
  {
    title: "Access model",
    icon: (
      <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    items: [
      "Assume-role model — zero stored credentials, zero shared passwords",
      "Read-only by default — write access scoped, temporary, and approval-gated",
      "Revoke instantly — active sessions self-terminate within 60 seconds",
    ],
  },
  {
    title: "Approval & safety",
    icon: (
      <svg className="w-5 h-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    items: [
      "Human approval required for cost, network, IAM, and past-failure changes",
      "Blast radius limits — instance changes capped, network changes staged to non-prod first",
      "Pre-verified rollback — rollback plan validated before execution, not after failure",
      "Outcome memory — prior failures on resource X require manual approval on retry",
    ],
  },
  {
    title: "Audit & compliance",
    icon: (
      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
      </svg>
    ),
    items: [
      "Immutable audit trail — what changed, who approved, cost impact, rollback status",
      "Full reasoning chain — every decision logged with rationale and confidence score",
      "Hard trust boundaries — the agent can never self-escalate its own autonomy level",
      "Governance policies per team — cost budgets, approval thresholds, change windows",
    ],
  },
];

export function EnterpriseTrustSignals() {
  return (
    <section
      className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/[0.04] relative overflow-hidden"
      aria-labelledby="trust-signals-heading"
    >
      {/* Grid mesh background */}
      <div className="absolute inset-0 bg-dots opacity-20" aria-hidden />
      <div className="absolute inset-0 bg-grid-mesh opacity-30" aria-hidden />

      <div className="max-w-5xl mx-auto relative">
        <AnimateOnScroll>
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
              Enterprise Governance
            </p>
            <h2
              id="trust-signals-heading"
              className="text-3xl md:text-4xl font-bold mb-4"
            >
              Autonomous operations.<br className="hidden sm:block" />
              <span className="text-zinc-500">Zero autonomous risk.</span>
            </h2>
            <p className="text-zinc-400 max-w-lg mx-auto">
              The agent enforces governance at every step — approval gates for blast-radius changes, cost visibility per decision, and immutable audit trails that prove compliance.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid gap-5 md:grid-cols-3">
          {GOVERNANCE.map((block, idx) => (
            <AnimateOnScroll key={block.title} delay={idx * 100}>
              <div className="animated-border glow-border-card card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm hover:border-white/[0.12] hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    {block.icon}
                  </div>
                  <h3 className="text-sm font-semibold">
                    {block.title}
                  </h3>
                </div>
                <ul className="space-y-2.5 text-sm text-zinc-400">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
