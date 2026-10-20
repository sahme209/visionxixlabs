import Link from "next/link";
import { ArrowRightIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { CinematicAxiomDemo } from "@/components/marketing/CinematicAxiomDemo";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";

export const dynamic = "force-dynamic";

const verifiedOutcomes = [
  {
    title: "Prepare a repository change",
    detail: "Select a GitHub repository, branch, file, and environment. Axiom reads through repository-scoped access, then pauses the proposed write for approval.",
    href: "/docs/approval-workflow",
    meta: "GitHub · approval gated",
  },
  {
    title: "Gate delivery on an Airflow DAG",
    detail: "Choose a validated DAG, monitor its run, evaluate dependencies, and create an auditable deployment proposal when the configured condition is satisfied.",
    href: "/integrations",
    meta: "Airflow 3 · automated condition",
  },
  {
    title: "Deploy to AWS ECS with recovery armed",
    detail: "Dispatch the tenant workflow with short-lived GitHub OIDC credentials, wait for ECS steady state, and roll back inside the authenticated job if stability fails.",
    href: "/docs/aws-setup",
    meta: "AWS ECS · GitHub OIDC",
  },
] as const;

export default function DemoLanding() {
  return (
    <div className="min-h-screen bg-[#101010] text-zinc-100">
      <Navigation />
      <main>
        <section className="mx-auto max-w-[1280px] px-5 pb-6 pt-28 sm:px-8 lg:px-10 lg:pt-36">
          <div className="max-w-4xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-orange-400">Safe product tour · scripted data</p>
            <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.05] tracking-[-0.05em] text-zinc-50">
              Watch one request become a governed release.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 sm:text-lg text-zinc-400">
              Choose the context, inspect evidence, coordinate dependencies, approve the exact action, and preserve proof. The tour is interactive; no account or cloud access is required.
            </p>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#product-tour" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-white">
              Start the tour <ArrowRightIcon className="h-4 w-4" />
            </a>
            <Link href="/download" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/10 px-6 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">
              Download the desktop app
            </Link>
          </div>
        </section>

        <CinematicAxiomDemo />

        <section className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
          <div className="grid gap-8 border-t border-white/[0.08] pt-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-orange-400">Implemented workflows</p>
              <h2 className="mt-4 text-2xl font-medium tracking-[-0.035em] text-zinc-100 sm:text-3xl">See exactly where Axiom acts—and where it waits.</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">These paths map to released desktop and service behavior. The visuals use scripted data and never touch a live customer system.</p>
            </div>
            <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {verifiedOutcomes.map((outcome, index) => (
                <Link key={outcome.title} href={outcome.href} className="group grid gap-3 py-6 transition sm:grid-cols-[48px_1fr_auto] sm:items-center">
                  <span className="font-mono text-xs text-zinc-400">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-base font-medium text-zinc-200 transition group-hover:text-white">{outcome.title}</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">{outcome.detail}</p>
                    <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-400">{outcome.meta}</p>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-orange-300" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-5 pb-16 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-6 rounded-xl border border-white/[0.08] bg-[#151515] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex max-w-2xl gap-4">
              <ShieldCheckIcon className="mt-0.5 h-6 w-6 shrink-0 text-orange-400" />
              <div>
                <h2 className="text-lg font-medium text-zinc-100">A safe demonstration, not a hidden control plane.</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">No connector credentials are stored, no webhooks fire, no AI credits are spent, and no production action can run from this website.</p>
              </div>
            </div>
            <Link href="/docs/getting-started" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-white/10 px-5 text-sm text-zinc-300 transition hover:bg-white/[0.04]">Read the quickstart</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
