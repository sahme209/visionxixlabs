"use client";

import { AnimateOnScroll } from "@/components/AnimateOnScroll";

const GOVERNANCE = [
  {
    title: "Access model",
    icon: (
      <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    items: [
      "Repository-scoped GitHub App tokens are minted for the selected repository",
      "AWS ECS uses GitHub Actions OIDC instead of stored AWS access keys",
      "Desktop actions remain scoped to the signed-in workspace and role",
    ],
  },
  {
    title: "Approval & safety",
    icon: (
      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
    items: [
      "Medium- and high-risk agent writes stop at an explicit proposal",
      "Production-targeted writes are escalated to high risk",
      "An administrator must approve or reject the proposed action",
      "ECS waits for steady state and restores the prior task definition on failure",
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
      "Every tool call receives a persisted action record",
      "Read-only observations and writes are both visible in the audit history",
      "The agent cannot approve its own proposed write",
      "Connection status is shown as verified only after server-side validation",
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
          <div className="text-center mb-14">
            <p className="mono-label inline-flex items-center gap-3 mb-5">
              <span className="text-brand-coral/90 tabular-nums">EG</span>
              <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
              Enterprise governance
            </p>
            <h2
              id="trust-signals-heading"
              className="font-display text-3xl md:text-4xl font-bold mb-4 leading-[1.04]"
            >
              Powerful automation.<br className="hidden sm:block" />
              <span className="relative inline-block">
                Explicit human authority.
                <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-amber-400/70 to-transparent" />
              </span>
            </h2>
            <p className="text-zinc-400 max-w-lg mx-auto leading-relaxed">
              Axiom separates observation, proposal, approval, and execution so teams can move quickly without hiding who authorized a change.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid gap-5 md:grid-cols-3">
          {GOVERNANCE.map((block, idx) => (
            <AnimateOnScroll key={block.title} delay={idx * 100}>
              <div className="surface-glass rounded-xl p-6 hover:border-brand-coral/20 hover:-translate-y-0.5 transition-all duration-300">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-1.5 rounded-lg bg-brand-coral/[0.08] border border-brand-coral/15">
                    {block.icon}
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    {block.title}
                  </h3>
                </div>
                <ul className="space-y-2.5 text-sm text-zinc-400">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-brand-coral/70 mt-2 shrink-0" />
                      <span className="leading-relaxed">{item}</span>
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
