import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const playbookPhases = [
  "Scope and affected systems",
  "Approvals, access, and window",
  "Exact execution and rollback",
  "Validation, evidence, and closure",
];

const promises = [
  {
    title: "Understand the change",
    body: "See what is changing, why it matters, who owns it, and what must be true before production.",
    icon: DocumentCheckIcon,
  },
  {
    title: "Run it safely",
    body: "Keep manual steps, automation, approvals, deployment triggers, and rollback instructions distinct.",
    icon: ShieldCheckIcon,
  },
  {
    title: "Prove the outcome",
    body: "Capture technical and functional validation, evidence, deferred follow-up, and an audit-ready record.",
    icon: CheckCircleIcon,
  },
];

export function MobileHome() {
  return (
    <main className="md:hidden overflow-x-clip">
      <section className="relative px-4 pb-12 pt-24">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-80"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 50% 0%, rgba(139,92,246,0.20), transparent 68%)",
          }}
        />
        <div className="relative mx-auto max-w-md">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200">
            <span className="h-2 w-2 rounded-full bg-brand-coral" />
            Desktop deployment operations
          </div>

          <h1 className="text-[clamp(2.65rem,13vw,3.6rem)] font-bold leading-[0.96] tracking-[-0.055em] text-white">
            Your request becomes the playbook.
          </h1>
          <p className="mt-6 text-[17px] leading-7 text-zinc-300">
            Axiom turns deployment intake into a governed runbook your team can
            approve, execute, validate, and close with evidence.
          </p>

          <div className="mt-8 grid gap-3">
            <Link
              href="/download"
              className="btn-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold"
            >
              Get the desktop app
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-[15px] font-semibold text-white"
            >
              <PlayCircleIcon className="h-5 w-5 text-brand-coral" />
              Explore the isolated demo
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-3 divide-x divide-white/[0.08] rounded-xl border border-white/[0.08] bg-white/[0.025] py-4 text-center">
            <div className="px-2">
              <p className="text-xs font-semibold text-white">Desktop</p>
              <p className="mt-1 text-[10px] text-zinc-500">Delivered locally</p>
            </div>
            <div className="px-2">
              <p className="text-xs font-semibold text-white">Governed</p>
              <p className="mt-1 text-[10px] text-zinc-500">Approval gated</p>
            </div>
            <div className="px-2">
              <p className="text-xs font-semibold text-white">Auditable</p>
              <p className="mt-1 text-[10px] text-zinc-500">Versioned evidence</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.018] px-4 py-12">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-brand-coral">
            Request → playbook
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-white">
            One operational record.
          </h2>
          <p className="mt-3 text-[15px] leading-6 text-zinc-400">
            No scattered checklist, mystery trigger, or green workflow standing
            in for production validation.
          </p>

          <div className="mt-7 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101015] shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">
                  Playbook
                </p>
                <p className="mt-0.5 text-sm font-semibold text-white">
                  Production deployment
                </p>
              </div>
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
                Awaiting approval
              </span>
            </div>
            <ol className="divide-y divide-white/[0.06] px-4">
              {playbookPhases.map((phase, index) => (
                <li key={phase} className="flex items-center gap-3 py-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-mono text-zinc-300">
                    {index + 1}
                  </span>
                  <span className="text-sm text-zinc-200">{phase}</span>
                </li>
              ))}
            </ol>
            <div className="border-t border-white/[0.07] bg-emerald-400/[0.035] px-4 py-3 text-xs text-emerald-200">
              Evidence and audit events stay attached to the versioned runbook.
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-brand-coral">
            Built for production reality
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-white">
            Understand. Run. Prove.
          </h2>
          <div className="mt-7 grid gap-3">
            {promises.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
              >
                <item.icon className="h-6 w-6 text-brand-coral" />
                <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-14">
        <div className="mx-auto max-w-md rounded-2xl border border-brand-coral/20 bg-gradient-to-br from-brand-coral/[0.09] to-brand-violet/[0.08] p-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-rose-200">
            Explore safely
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.035em] text-white">
            See the workflow without entering a production control plane.
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            The website demo is isolated and synthetic. Live operations remain
            in the installed application.
          </p>
          <div className="mt-6 grid gap-3">
            <Link
              href="/demo"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950"
            >
              Open the isolated demo
            </Link>
            <Link
              href="/docs"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white"
            >
              Read documentation
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
