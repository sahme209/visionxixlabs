import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { ArrowRightIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { CinematicAxiomDemo } from "@/components/marketing/CinematicAxiomDemo";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";

export const dynamic = "force-dynamic";

const workflowGuides = [
  {
    title: "Prepare a repository change",
    detail: "Check the guide for your installed version. The local preview separates independent review from the original requester’s execution; this tour does not establish production activation.",
    href: "/docs/approval-workflow",
    meta: "GitHub · Version-specific guide",
  },
  {
    title: "Inspect an Airflow dependency",
    detail: "Read the connector’s current scope and validation requirements. DAG monitoring, dependency conditions and action paths depend on the enabled implementation and exact operation checks.",
    href: "/integrations",
    meta: "Airflow · Implementation scope",
  },
  {
    title: "Understand the AWS ECS workflow",
    detail: "Inspect AWS setup and workflow requirements. Dispatch acceptance is separate from ECS completion, application health and verified recovery; no rollback outcome is demonstrated here.",
    href: "/docs/aws-setup",
    meta: "AWS ECS · Provider-specific guide",
  },
] as const;

export default function DemoLanding() {
  return (
    <div className="min-h-screen bg-[#101010] text-zinc-100">
      <Navigation />
      <main>
        <section className="mx-auto max-w-[1280px] px-5 pb-6 pt-24 sm:px-8 lg:px-10 lg:pt-28">
          <PageHero
            eyebrow="Scripted interactive tour"
            title="Explore the workflow. Know what is simulated."
            lead="Explore illustrative context, review and outcome steps using scripted data. This is an interactive simulation, not a recording of a live execution. No account or cloud access is required."
            actions={<>
              <a href="#product-tour" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-white">
                Start the scripted tour <ArrowRightIcon className="h-4 w-4" />
              </a>
              <Link href="/download" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/10 px-6 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">
                Check available downloads
              </Link>
            </>}
          />
        </section>

        <p className="mx-auto max-w-[1280px] px-5 pt-4 text-sm leading-6 text-zinc-400 sm:px-8 lg:px-10">Recorded product walkthroughs are not available on this page. Authentic recordings need their own version, source and availability context; the controls below operate the scripted tour only.</p>

        <CinematicAxiomDemo />

        <section className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
          <div className="grid gap-8 border-t border-white/[0.08] pt-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-orange-400">Guides behind the stories</p>
              <h2 className="mt-4 text-2xl font-medium tracking-[-0.035em] text-zinc-100 sm:text-3xl">Check the real workflow and its limits.</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">These links explain version- and operation-specific behavior. A scripted scene is not evidence of a released feature, provider confirmation or complete Governance coverage.</p>
            </div>
            <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {workflowGuides.map((outcome, index) => (
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
                <h2 className="text-lg font-medium text-zinc-100">This tour has no action authority.</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">This scripted tour does not request connector credentials, call AI services or run provider actions. Other account and product surfaces have their own access checks; this statement applies only to the tour.</p>
              </div>
            </div>
            <Link href="/docs/approval-workflow" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-white/10 px-5 text-sm text-zinc-300 transition hover:bg-white/[0.04]">Read the approval guide</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
