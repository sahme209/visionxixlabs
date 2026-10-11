import Link from "next/link";
import { ArrowRightIcon, PlayCircleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { CinematicAxiomDemo } from "@/components/marketing/CinematicAxiomDemo";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { listScenarios, type DemoScenario } from "@/lib/demo/demoScenarios";

export const dynamic = "force-dynamic";

export default function DemoLanding() {
  const scenarios = listScenarios("client");

  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100">
      <Navigation />
      <main>
        <section className="mx-auto max-w-[1400px] px-5 pb-10 pt-36 sm:px-8 lg:px-12 lg:pt-44">
          <div className="max-w-4xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-orange-400">Safe product tour · scripted data</p>
            <h1 className="mt-5 text-5xl font-medium leading-[0.98] tracking-[-0.055em] text-zinc-50 sm:text-7xl">
              Watch one request become a governed release.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">
              Choose the context, inspect evidence, coordinate dependencies, approve the exact action, and preserve proof. The tour is interactive; no account or cloud access is required.
            </p>
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#product-tour" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-white">
              Start the tour <ArrowRightIcon className="h-4 w-4" />
            </a>
            <Link href="/download" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 px-6 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">
              Download the desktop app
            </Link>
          </div>
        </section>

        <CinematicAxiomDemo />

        <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-8 border-t border-white/[0.08] pt-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-orange-400">Explore by outcome</p>
              <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em] text-zinc-100 sm:text-4xl">Go deeper without a sales call.</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-zinc-500">Each walkthrough uses isolated sample data and explains the authority boundary before showing an action.</p>
            </div>
            <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {scenarios.map((scenario, index) => <ScenarioRow key={scenario.id} scenario={scenario} index={index} />)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8 lg:px-12">
          <div className="flex flex-col gap-6 rounded-2xl border border-white/[0.08] bg-[#1A1A1A] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex max-w-2xl gap-4">
              <ShieldCheckIcon className="mt-0.5 h-6 w-6 shrink-0 text-orange-400" />
              <div>
                <h2 className="text-lg font-medium text-zinc-100">A safe demonstration, not a hidden control plane.</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">No connector credentials are stored, no webhooks fire, no AI credits are spent, and no production action can run from this website.</p>
              </div>
            </div>
            <Link href="/docs/getting-started" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-white/10 px-5 text-sm text-zinc-300 transition hover:bg-white/[0.04]">Read the quickstart</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function ScenarioRow({ scenario, index }: { scenario: DemoScenario; index: number }) {
  return (
    <Link href={`/demo/${scenario.id}`} className="group grid gap-3 py-6 transition sm:grid-cols-[48px_1fr_auto] sm:items-center">
      <span className="font-mono text-xs text-zinc-600">{String(index + 1).padStart(2, "0")}</span>
      <div>
        <h3 className="text-base font-medium text-zinc-200 transition group-hover:text-white">{scenario.title}</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">{scenario.pitch}</p>
      </div>
      <span className="inline-flex items-center gap-2 text-xs text-zinc-500 transition group-hover:text-orange-300"><PlayCircleIcon className="h-4 w-4" /> {scenario.steps.length} steps</span>
    </Link>
  );
}
