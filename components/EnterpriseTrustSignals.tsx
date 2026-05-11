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
      className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80"
      aria-labelledby="trust-signals-heading"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2
            id="trust-signals-heading"
            className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3"
          >
            Enterprise governance built in
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            Axiom can never self-escalate. Every action is scoped, approved, auditable, and reversible.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {GOVERNANCE.map((block) => (
            <div
              key={block.title}
              className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 p-5"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                {block.title}
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {block.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
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
