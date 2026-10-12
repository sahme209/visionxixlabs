import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, ClockIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Enterprise readiness — Axiom Agent",
  description:
    "The released governance boundary, current integration scope, and clearly identified work still in verification.",
};

const released = [
  "Repository-scoped GitHub App tokens for reads, branches, commits, pull requests, and workflow dispatch",
  "Persisted action proposals with explicit admin approval before repository writes or deployment",
  "Environment-specific AWS ECS targets using GitHub Actions OIDC instead of stored AWS access keys",
  "ECS steady-state validation with rollback to the previous task definition when stabilization fails",
  "Airflow DAG selection, dependency checks, governed automation, retries, notifications, and audit records",
];

const pending = [
  "Enterprise identity records are configuration-only until a real OIDC or SAML sign-in path is verified",
  "Azure and Google Cloud are not presented as released production deployment targets",
  "Self-service paid billing stays disabled until Stripe test-mode products, seats, quotas, and webhooks reconcile",
];

export default function EnterpriseReadinessPage() {
  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100">
      <Navigation />
      <main>
        <section className="mx-auto max-w-[1400px] px-5 pb-20 pt-28 sm:px-8 lg:px-12 lg:pb-28 lg:pt-36">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#ff783d]">
            Enterprise readiness
          </p>
          <h1 className="mt-6 max-w-5xl text-5xl font-medium leading-[0.98] tracking-[-0.055em] sm:text-7xl lg:text-[5.5rem]">
            Powerful controls.
            <span className="block text-zinc-500">No hidden claims.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
            Axiom separates what is released, what requires workspace
            configuration, and what is still under verification. Production
            authority is explicit, scoped, and auditable.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/download" className="inline-flex min-h-12 items-center rounded-full bg-zinc-100 px-6 text-sm font-semibold text-zinc-950 hover:bg-white">
              Download Axiom
            </Link>
            <Link href="/docs/permissions-model" className="inline-flex min-h-12 items-center rounded-full border border-white/[0.12] px-6 text-sm font-medium text-zinc-200 hover:bg-white/[0.05]">
              Review the permission model
            </Link>
          </div>
        </section>

        <section className="border-y border-white/[0.08] bg-[#181818]">
          <div className="mx-auto grid max-w-[1400px] gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-12 lg:py-28">
            <div>
              <ShieldCheckIcon className="h-7 w-7 text-[#ff783d]" aria-hidden />
              <h2 className="mt-5 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
                Released governance boundary
              </h2>
              <p className="mt-4 text-sm leading-6 text-zinc-500">
                These statements map to desktop routes, service responders, and
                provider workflows in the current codebase.
              </p>
            </div>
            <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {released.map((item) => (
                <li key={item} className="flex gap-4 py-5 text-sm leading-6 text-zinc-300">
                  <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-[#ff783d]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1400px] gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-12 lg:py-28">
          <div>
            <ClockIcon className="h-7 w-7 text-zinc-500" aria-hidden />
            <h2 className="mt-5 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
              Still gated
            </h2>
            <p className="mt-4 text-sm leading-6 text-zinc-500">
              Saved configuration and roadmap code do not become customer-facing
              capability until the end-to-end path is verified.
            </p>
          </div>
          <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {pending.map((item) => (
              <li key={item} className="flex gap-4 py-5 text-sm leading-6 text-zinc-400">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-white/[0.08]">
          <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#ff783d]">Self-service path</p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-4">
              {[
                ["01", "Download", "Install the current signed release shown on the download page."],
                ["02", "Connect", "Choose a repository and configure only the environment you intend to use."],
                ["03", "Validate", "Run read-only checks and resolve any missing permission or target."],
                ["04", "Approve", "Review the exact proposal before a write or deployment can execute."],
              ].map(([step, title, detail]) => (
                <div key={step} className="bg-[#181818] p-6">
                  <p className="font-mono text-xs text-zinc-600">{step}</p>
                  <h3 className="mt-8 text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
