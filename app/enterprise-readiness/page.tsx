import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, ClockIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { PageHero } from "@/components/marketing/PageHero";

export const metadata: Metadata = {
  title: "Enterprise readiness — V19",
  description:
    "Implementation scope, evidence to inspect, and the customer workflows still awaiting verification.",
};

const implemented = [
  "Repository-scoped GitHub App token paths for reads and selected writes; verify the configured scopes and exact operation",
  "Stored proposals and admin-review paths; exact workflow support and reviewer separation require verification",
  "AWS ECS workflow source for environment targets and GitHub Actions OIDC; provider permissions and actual outcomes need separate checks",
  "ECS validation and task-definition recovery code; live health and recovery acceptance remain unverified",
  "Airflow monitoring and governed automation paths; connection, action and provider acceptance remain deployment-specific",
];

const pending = [
  "Complete Governance coverage and activation remain unfinished",
  "Installed desktop, live provider outcomes and recovery require their own acceptance evidence",
  "Enterprise OIDC or SAML sign-in requires verification of the actual provider path; saved configuration is not acceptance",
  "Azure and Google Cloud are not presented as released production deployment targets",
  "Self-service paid billing stays disabled until Stripe test-mode products, seats, quotas, and webhooks reconcile",
];

export default function EnterpriseReadinessPage() {
  return (
    <div className="axiom-canvas min-h-screen text-zinc-100">
      <Navigation />
      <main className="pt-32">
        <section className="mx-auto max-w-[1240px] px-5 pb-16 sm:px-10 lg:pb-24">
          <PageHero
            eyebrow="Enterprise readiness"
            title="Powerful controls."
            muted="No hidden claims."
            lead="Separate implemented source from configuration and verified customer workflows. Inspect the evidence for your installed version, permissions and exact operation."
            actions={<>
              <Link href="/download" className="public-feature-action">Download V19</Link>
              <Link href="/docs/permissions-model" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/12 px-5 text-sm font-medium text-zinc-200 hover:bg-white/5">Review the permission model</Link>
            </>}
          />
        </section>

        <section className="border-y border-white/8 bg-[var(--public-surface)]">
          <div className="mx-auto grid max-w-[1240px] gap-14 px-5 py-20 sm:px-10 lg:grid-cols-[0.72fr_1.28fr] lg:px-10 lg:py-28">
            <div>
              <ShieldCheckIcon className="h-7 w-7 text-zinc-400" aria-hidden />
              <h2 className="mt-5 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
                Implementation and evidence
              </h2>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                These entries describe code paths to inspect, not proof of a
                released customer workflow or verified provider outcome.
              </p>
            </div>
            <ul className="divide-y divide-white/8 border-y border-white/8">
              {implemented.map((item) => (
                <li key={item} className="flex gap-4 py-5 text-sm leading-6 text-zinc-300">
                  <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1240px] gap-14 px-5 py-20 sm:px-10 lg:grid-cols-[0.72fr_1.28fr] lg:px-10 lg:py-28">
          <div>
            <ClockIcon className="h-7 w-7 text-zinc-400" aria-hidden />
            <h2 className="mt-5 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
              Still gated
            </h2>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Saved configuration and roadmap code do not become customer-facing
              capability until the end-to-end path is verified.
            </p>
          </div>
          <ul className="divide-y divide-white/8 border-y border-white/8">
            {pending.map((item) => (
              <li key={item} className="flex gap-4 py-5 text-sm leading-6 text-zinc-400">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-white/8">
          <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-10 lg:px-10 lg:py-28">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Self-service path</p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8 md:grid-cols-4">
              {[
                ["01", "Download", "Review installer availability and verification details on the download page."],
                ["02", "Connect", "Choose a repository and configure only the environment you intend to use."],
                ["03", "Validate", "Run read-only checks and resolve any missing permission or target."],
                ["04", "Approve", "Where supported, review the exact proposal and verify the required authorization before execution."],
              ].map(([step, title, detail]) => (
                <div key={step} className="bg-[var(--public-surface)] p-6">
                  <p className="font-mono text-xs text-zinc-400">{step}</p>
                  <h3 className="mt-8 text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
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
