import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  ClockIcon,
  CpuChipIcon,
  FingerPrintIcon,
  LinkIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { HomepageMediaShowcase } from "@/components/marketing/HomepageMediaShowcase";
import { CinematicAxiomDemo } from "@/components/marketing/CinematicAxiomDemo";

const phases = ["Window", "Scope", "Execution", "Validation", "Recovery"];

const pillars = [
  {
    icon: CpuChipIcon,
    eyebrow: "AI",
    title: "Context before action.",
    copy: "Select repository context and ask in everyday language. Repository assistance helps inspect the selected context and explain evidence; available tools and actions depend on the installed version and current access.",
  },
  {
    icon: ShieldCheckIcon,
    eyebrow: "Governance",
    title: "Authority stays explicit.",
    copy: "Keep the proposed change, required human review, requester execution, and recorded outcome distinct. Available actions depend on current permissions and the enabled workflow.",
  },
  {
    icon: LinkIcon,
    eyebrow: "Integrations",
    title: "Evidence after execution.",
    copy: "Connect repository context, dependency checks, and release workflows. Connector availability and recorded evidence determine what is ready for your environment.",
  },
];

export default function Home() {
  return (
    <div className="axiom-canvas min-h-screen text-[#ecece8]">
      <Navigation />
      <main>
        <section className="mx-auto max-w-[1280px] px-5 pb-16 pt-28 sm:px-8 lg:px-10 lg:pb-20 lg:pt-36">
          <div className="mx-auto max-w-[880px] text-left lg:mx-0">
            <span className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
              Axiom Agent · the governed engineering workspace
            </span>
            <h1 className="mt-7 text-[clamp(2.8rem,5.8vw,5rem)] font-medium leading-[1.02] tracking-[-0.052em] text-[#f1f1ed]">
              Engineering work.<br /><span className="text-zinc-400">With you in control.</span>
            </h1>
            <p className="mt-6 max-w-[650px] text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
              A governed workspace for deployments and connected operational changes. Bring repository context, AI assistance, human review, and recorded outcomes into one clear flow.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/product" className="btn-axiom inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#efefec] px-7 py-3 text-sm font-semibold text-[#151513] hover:bg-white">
                Explore Axiom <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href="/demo" className="btn-axiom inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-7 py-3 text-sm font-medium text-zinc-200 hover:bg-white/[0.08]">
                Explore the scripted tour <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-sm leading-6 text-zinc-400">
            Actual actions depend on the installed version, current permissions, and enabled workflow. Complete Governance enforcement and activation are not established.{" "}
            <Link href="/security" className="text-zinc-200 underline underline-offset-4">Assess security boundaries</Link>{" · "}
            <Link href="/docs/approval-workflow" className="text-zinc-200 underline underline-offset-4">Read the approval workflow</Link>.
          </p>

          <HomepageMediaShowcase fallback={<CinematicAxiomDemo variant="hero" />} />
        </section>

        <section className="border-y border-white/[0.06] bg-[#0e0e0c] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="mx-auto max-w-[1280px]">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Built around the engineering workflow</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-5xl">More context. Clearer decisions.</h2>
            <div className="mt-12 grid border-y border-white/[0.08] md:grid-cols-3 md:divide-x md:divide-white/[0.08]">
              {pillars.map((pillar) => (
                <article key={pillar.eyebrow} className="border-b border-white/[0.08] py-8 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0">
                  <pillar.icon className="h-5 w-5 text-zinc-300" />
                  <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-orange-300">{pillar.eyebrow}</p>
                  <h3 className="mt-2 text-lg font-medium leading-snug tracking-[-0.02em] text-zinc-100">{pillar.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{pillar.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] space-y-8 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">These boards are conceptual examples. Support depends on the installed version and enabled workflow. A saved request, approval, or workflow is not a verified provider result, application health, or rollback proof.</p>
          <EditorialPanel
            eyebrow="01 · Structured intake"
            title="Five stages to frame a request."
            copy="The illustrated request separates the deployment window, affected scope, execution, production validation, and recovery path for review. Recorded fields alone do not establish readiness."
            visual={<StageBoard />}
          />
          <EditorialPanel
            reverse
            eyebrow="02 · Revision integrity"
            title="Keep revisions in view."
            copy="The illustrated history keeps authorship and revisions visible for comparison. Revision and conflict handling depend on the supported surface and installed version."
            visual={<HistoryBoard />}
          />
          <EditorialPanel
            eyebrow="03 · Operational truth"
            title="A green workflow is not production validation."
            copy="Assess trigger state, execution results, technical and functional validation, rollback readiness, and closure evidence separately. A workflow acceptance or recorded recovery instruction alone does not verify the outcome."
            visual={<ValidationBoard />}
          />
        </section>

        <section className="border-y border-white/[0.06] bg-[#11110f] px-5 py-20 sm:px-8 lg:px-12">
          <h2 className="mx-auto max-w-[1280px] text-center text-3xl font-medium tracking-[-0.04em] sm:text-4xl">Designed around production reality.</h2>
          <div className="mx-auto mt-9 grid max-w-[1280px] gap-3 md:grid-cols-3 px-5 sm:px-8 lg:px-12">
            <EvidenceCard icon={<ScaleIcon className="h-6 w-6" />} title="Policy remains authoritative" detail="Desktop preferences cannot weaken organization approvals, permission boundaries, or production gates." />
            <EvidenceCard icon={<FingerPrintIcon className="h-6 w-6" />} title="Browser-authorized desktop sessions" detail="Sign-in and account creation happen in the system browser through an expiring, one-time device-bound challenge." />
            <EvidenceCard icon={<ClockIcon className="h-6 w-6" />} title="Reconnect without rewriting history" detail="Last-known records remain visible and are explicitly marked stale with the last successful service-response time." />
          </div>
        </section>

        <section className="border-y border-white/[0.07] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-orange-300">Founding Supporters</p>
              <h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-5xl">Help advance autonomous engineering with human control at its core.</h2>
            </div>
            <Link href="/support" className="inline-flex min-h-12 shrink-0 items-center gap-2 self-start rounded-full border border-white/[0.14] px-6 text-sm font-medium text-zinc-200 transition hover:border-orange-300/35 hover:bg-white/[0.04]">Meet the Founding Supporters program <ArrowRightIcon className="h-4 w-4" /></Link>
          </div>
        </section>

        <section className="px-5 py-28 text-center sm:px-8 lg:py-40">
          <h2 className="text-[clamp(3.5rem,8vw,7.8rem)] font-medium leading-none tracking-[-0.065em]">Start with a verified request.</h2>
          <Link href="/download" className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#efefec] px-8 py-3 text-sm font-semibold text-[#151513] hover:bg-white">Download Axiom Agent <ArrowRightIcon className="h-4 w-4" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function EditorialPanel({ eyebrow, title, copy, visual, reverse = false }: { eyebrow: string; title: string; copy: string; visual: ReactNode; reverse?: boolean }) {
  return <article className="grid gap-8 border-t border-white/[0.08] py-10 lg:grid-cols-2 lg:items-center lg:gap-16">
    <div className={`max-w-lg ${reverse ? "lg:order-2" : ""}`}><p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">{eyebrow}</p><h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">{title}</h2><p className="mt-4 text-base leading-7 text-zinc-400">{copy}</p></div>
    <div className={`min-w-0 rounded-lg border border-white/[0.08] bg-[#141414] p-5 sm:p-7 ${reverse ? "lg:order-1" : ""}`}><p className="mb-4 text-[10px] uppercase tracking-widest text-zinc-400">Illustrated record · sample data</p>{visual}</div>
  </article>;
}

function StageBoard() { return <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-white/[0.1] bg-[#10110f]/95 text-zinc-200"><div className="border-b border-white/[0.07] px-5 py-4 text-sm">Request completeness</div>{phases.map((phase, index) => <div key={phase} className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4 last:border-0"><span className={`h-2 w-2 rounded-full ${index < 4 ? 'bg-orange-300' : 'bg-zinc-600'}`} /><span className="text-sm">{phase}</span><span className="ml-auto text-xs text-zinc-400">{index < 4 ? 'Recorded' : 'Review required'}</span></div>)}</div>; }
function HistoryBoard() { return <div className="mx-auto max-w-xl rounded-xl border border-white/[0.1] bg-[#10110f]/95 p-5 text-zinc-200"><p className="text-sm font-medium">Immutable history</p>{[4,3,2].map((version, index) => <div key={version} className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex justify-between"><span className="text-sm">Revision {version}</span><span className="text-xs text-zinc-400">{index === 0 ? 'Current record' : 'Superseded'}</span></div><p className="mt-2 text-xs text-zinc-400">Actor recorded · changed field names only · SHA-256 digest</p></div>)}</div>; }
function ValidationBoard() { return <div className="mx-auto grid max-w-2xl gap-px overflow-hidden rounded-xl border border-white/[0.1] bg-black/35 text-zinc-200 sm:grid-cols-2">{[["Trigger","Workflow accepted"],["Execution","No result yet"],["Technical validation","Required"],["Functional validation","Required"],["Rollback","Instruction recorded"],["Closure","Blocked until evidence"]].map(([label,value]) => <div key={label} className="bg-[#10110f]/95 p-5"><p className="text-xs text-zinc-400">{label}</p><p className="mt-2 text-sm">{value}</p></div>)}</div>; }
function EvidenceCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <article className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-7 sm:p-8"><span className="text-zinc-400">{icon}</span><h3 className="mt-5 text-lg font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-400">{detail}</p></article>; }
