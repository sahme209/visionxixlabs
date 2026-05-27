import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheckIcon,
  KeyIcon,
  BellAlertIcon,
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  DocumentCheckIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { DocHeader, Callout, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Best Practices — Axiom Agent | VisionXIXLabs",
  description: "Production-readiness checklist for running Axiom in real cloud accounts. Trust levels, blast radius, audit retention, on-call wiring, and the things to set up before you hit the autopilot button.",
};

interface Practice {
  num: string;
  category: "trust" | "security" | "ops" | "team";
  title: string;
  body: string;
  recommendation: string;
}

const PRACTICES: readonly Practice[] = [
  {
    num: "01",
    category: "trust",
    title: "Start at the lowest autonomy tier",
    body: "Axiom supports three autonomy tiers: Scan-only, Recommend, and Execute-with-approval. For the first week, stay on Scan-only. You're learning what Axiom catches and how its priorities map to your actual operational pain.",
    recommendation: "Stay on Scan-only for 7 days. Move to Recommend in week 2. Only enable Execute-with-approval once you've reviewed ~10 recommendations and trust the agent's judgment.",
  },
  {
    num: "02",
    category: "trust",
    title: "Set a blast radius limit you'd accept losing",
    body: "Blast radius caps how many resources a single approved plan can touch. The default is 5, which works for most teams. For high-stakes accounts (production payment APIs, etc.), set it to 1 or 2.",
    recommendation: "Production accounts: blast radius ≤ 2. Staging: ≤ 5. Dev: unlimited. Override per environment in your charter config.",
  },
  {
    num: "03",
    category: "security",
    title: "Rotate the IAM External ID quarterly",
    body: "The External ID is the second factor that authorizes Axiom to assume your read-only role. Rotating it every 90 days limits the window any leaked role ARN could be exploited (in the unlikely event the ARN leaks; we never log it).",
    recommendation: "Set a calendar reminder. Rotate in your AWS console + paste the new External ID into Axiom. Old ID auto-expires.",
  },
  {
    num: "04",
    category: "security",
    title: "Lock down who can approve high-risk plans",
    body: "By default, any workspace admin can approve any plan. For regulated environments, configure two-step approval: one engineer drafts, one (different) approves. Both must be in the org's RBAC role allowlist.",
    recommendation: "SOC 2 / compliance environments: enable two-step approval for plans tagged 'high-risk'. Configure in /dashboard/approvals.",
  },
  {
    num: "05",
    category: "ops",
    title: "Wire incident alerts to your on-call tool",
    body: "Axiom emits alerts via Slack, PagerDuty, Opsgenie, and webhooks. When a finding crosses your severity threshold, you want it in the same surface your team already monitors — not an Axiom inbox they have to remember to check.",
    recommendation: "Connect at least one alert sink before the first scan. /dashboard/notifications.",
  },
  {
    num: "06",
    category: "ops",
    title: "Set up daily scheduled scans",
    body: "Ad-hoc scans are fine for exploring. Scheduled daily scans are what catch drift before it becomes a Friday-evening incident. Pick a time outside your peak load.",
    recommendation: "Schedule: 02:00 UTC daily. Coverage: all regions. Run takes <2 min for typical accounts.",
  },
  {
    num: "07",
    category: "ops",
    title: "Keep audit logs > 90 days minimum",
    body: "Every approval, execution, and rollback writes a sha-256-signed audit row. Default retention is 1 year. Don't lower this — incident postmortems often need to look back 6 months.",
    recommendation: "Retention: 365 days (default). Export to your SIEM weekly if you have one.",
  },
  {
    num: "08",
    category: "team",
    title: "Build a small allowlist of \"auto-approvable\" categories",
    body: "Some finding categories are unambiguously safe — orphaned EBS volumes, unused Elastic IPs, expired access keys. As trust builds, mark those categories as auto-approvable so Axiom handles them while you focus on the harder ones.",
    recommendation: "Start with orphaned-resource cleanup. Never auto-approve IAM changes or anything touching production routing.",
  },
  {
    num: "09",
    category: "team",
    title: "Run a monthly drift review with the platform team",
    body: "Even with daily scans, take 30 min once a month to flip through the trend graphs in /dashboard/analytics. Look for: which categories keep recurring (process gap), which fixes get rejected (Axiom's reasoning has a blind spot), which accounts produce 80% of the findings (concentration risk).",
    recommendation: "Recurring calendar invite. Platform lead + one ops engineer. 30 min max.",
  },
];

const CATEGORY_TONE: Record<Practice["category"], { label: string; cls: string; icon: typeof ShieldCheckIcon }> = {
  trust:    { label: "Trust",    cls: "text-brand-coral bg-brand-coral/10 border-brand-coral/30",  icon: KeyIcon },
  security: { label: "Security", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", icon: ShieldCheckIcon },
  ops:      { label: "Ops",      cls: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",          icon: BellAlertIcon },
  team:     { label: "Team",     cls: "text-violet-300 bg-violet-500/10 border-violet-500/30",    icon: UserGroupIcon },
};

export default function BestPracticesPage() {
  return (
    <>
      <DocHeader
        number="03"
        kicker="Best practices"
        title="The nine things to set up before flipping autopilot on."
        summary="Axiom works the day you connect it. It works well the week you tune it. These nine practices are how teams running Axiom in production avoid the mistakes the early adopters made — without paying for that experience themselves."
      />

      <Callout variant="info" title="When to read this">
        Day-one users: skip this for now and run a few scans first. Week-two users: read everything below before you raise your autonomy tier. Production-grade environments: every item here is mandatory before the first execute-with-approval plan runs.
      </Callout>

      {/* The nine practices */}
      <div className="space-y-3 mb-12">
        {PRACTICES.map((p) => {
          const tone = CATEGORY_TONE[p.category];
          const Icon = tone.icon;
          return (
            <article
              key={p.num}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 hover:border-brand-coral/20 transition-colors"
            >
              <header className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-brand-coral/15 to-brand-violet/15 border border-brand-coral/30 flex items-center justify-center text-[11px] font-mono font-semibold text-brand-coral tabular-nums mt-0.5">
                    {p.num}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-semibold text-white leading-tight">{p.title}</h3>
                    <span className={`inline-flex items-center gap-1 mt-1.5 text-[9.5px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px ${tone.cls}`}>
                      <Icon className="h-3 w-3" />
                      {tone.label}
                    </span>
                  </div>
                </div>
              </header>
              <p className="text-[13.5px] text-zinc-400 leading-relaxed mb-3">{p.body}</p>
              <div className="rounded-lg border border-brand-coral/20 bg-brand-coral/[0.04] px-3.5 py-2.5 flex items-start gap-2">
                <DocumentCheckIcon className="h-3.5 w-3.5 text-brand-coral mt-0.5 shrink-0" />
                <p className="text-[12.5px] text-zinc-200 leading-relaxed">
                  <span className="font-semibold text-brand-coral">Recommendation: </span>
                  {p.recommendation}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {/* Anti-patterns */}
      <section className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-6 mb-12">
        <header className="flex items-center gap-2 mb-3">
          <ExclamationTriangleIcon className="h-4 w-4 text-rose-400" />
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-rose-300">
            Don&apos;t
          </p>
        </header>
        <ul className="space-y-2 text-[13.5px] text-rose-100/85 leading-relaxed">
          <li>· Don&apos;t enable Execute-with-approval on day one. You haven&apos;t earned the right calibration yet.</li>
          <li>· Don&apos;t give Axiom AWS root credentials. The CloudFormation onboarding generates a least-privilege role on purpose.</li>
          <li>· Don&apos;t set blast radius higher than 10 in production. A bad plan with a high cap is the worst kind of incident.</li>
          <li>· Don&apos;t auto-approve IAM changes — ever. Identity is where the worst outages start.</li>
          <li>· Don&apos;t skip the drift review. AI agents drift in their reasoning too; a monthly human check keeps it calibrated.</li>
        </ul>
      </section>

      {/* What's next */}
      <section className="grid sm:grid-cols-3 gap-3 mb-8">
        <Link href="/docs/security-model" className="group rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 hover:border-brand-coral/25 hover:bg-brand-coral/[0.03] transition-all">
          <ShieldCheckIcon className="h-4 w-4 text-brand-coral/70 group-hover:text-brand-coral mb-2 transition-colors" />
          <p className="text-[13.5px] font-semibold text-white">Security model</p>
          <p className="text-[11.5px] text-zinc-400 mt-1">What's stored, what's not.</p>
        </Link>
        <Link href="/docs/audit-logs" className="group rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 hover:border-brand-coral/25 hover:bg-brand-coral/[0.03] transition-all">
          <ClockIcon className="h-4 w-4 text-brand-coral/70 group-hover:text-brand-coral mb-2 transition-colors" />
          <p className="text-[13.5px] font-semibold text-white">Audit logs</p>
          <p className="text-[11.5px] text-zinc-400 mt-1">Retention + export.</p>
        </Link>
        <Link href="/docs/troubleshooting" className="group rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 hover:border-brand-coral/25 hover:bg-brand-coral/[0.03] transition-all">
          <ChartBarIcon className="h-4 w-4 text-brand-coral/70 group-hover:text-brand-coral mb-2 transition-colors" />
          <p className="text-[13.5px] font-semibold text-white">Troubleshooting</p>
          <p className="text-[11.5px] text-zinc-400 mt-1">When things go sideways.</p>
        </Link>
      </section>

      <DocFeedback />
    </>
  );
}
