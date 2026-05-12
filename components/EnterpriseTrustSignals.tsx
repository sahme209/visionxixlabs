const GOVERNANCE = [
  {
    title: "Access model",
    items: [
      "Assume-role — no stored credentials",
      "Read-only by default, write requires explicit opt-in",
      "Revoke access from your console at any time",
    ],
  },
  {
    title: "Approval & safety",
    items: [
      "Human approval required for all high-risk changes",
      "Blast radius limits enforced per action",
      "Pre-verified rollback strategy before every apply",
      "Outcome memory — prior failures block auto-fix",
    ],
  },
  {
    title: "Audit & compliance",
    items: [
      "Immutable audit trail for every action",
      "Full reasoning chain visible per decision",
      "Trust levels prevent agent self-escalation",
      "Governance policies configurable per organization",
    ],
  },
];

export function EnterpriseTrustSignals() {
  return (
    <section
      className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/[0.04] relative overflow-hidden"
      aria-labelledby="trust-signals-heading"
    >
      <div className="absolute inset-0 bg-dots opacity-20" aria-hidden />
      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
            Enterprise Governance
          </p>
          <h2
            id="trust-signals-heading"
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            Enterprise governance built in
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto">
            Axiom can never self-escalate. Every action is scoped, approved, auditable, and reversible.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {GOVERNANCE.map((block) => (
            <div
              key={block.title}
              className="glow-border-card card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm hover:border-white/[0.12] transition-colors"
            >
              <h3 className="text-sm font-semibold mb-4">
                {block.title}
              </h3>
              <ul className="space-y-2.5 text-sm text-zinc-400">
                {block.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 mt-2 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
