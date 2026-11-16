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
import { AxiomPublicHero } from "@/components/marketing/AxiomPublicHero";
import { PublicFeatureSection } from "@/components/marketing/PublicFeatureSection";
import { PublicFeaturePanel } from "@/components/marketing/PublicFeaturePanel";
import { WorksWithStrip } from "@/components/marketing/WorksWithStrip";

const phases = ["Window", "Scope", "Execution", "Validation", "Recovery"];

const pillars = [
  {
    icon: CpuChipIcon,
    eyebrow: "AI",
    title: "Context before action.",
    copy: "Pick a repository and ask in plain language. The agent reads that context and explains the evidence. Tools depend on your version and access.",
  },
  {
    icon: ShieldCheckIcon,
    eyebrow: "Governance",
    title: "Authority stays explicit.",
    copy: "Proposal, human review, execution and outcome stay separate steps. What you can do depends on your permissions and workflow.",
  },
  {
    icon: LinkIcon,
    eyebrow: "Integrations",
    title: "Evidence after execution.",
    copy: "Connect repositories, dependency checks and release workflows. Recorded evidence, not a green light, decides what is ready.",
  },
];

export default function Home() {
  return (
    <div className="axiom-canvas min-h-screen text-white">
      <Navigation />
      <main>
        <AxiomPublicHero />

        <PublicFeatureSection labelledBy="public-features-title">
          <div className="public-section-intro"><p>// Inside the workflow</p><h2 id="public-features-title">Frame the request.<br/><span>Follow the evidence.</span></h2></div>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">These boards are conceptual examples. Support depends on the installed version and enabled workflow. A saved request, approval, or workflow is not a verified provider result, application health, or rollback proof.</p>
          <PublicFeaturePanel
            eyebrow="01 · Intake"
            action={{ href: "/docs/execution-plans", label: "Explore execution plans" }}
            title="Every request, fully framed."
            copy="Window, scope, execution, validation and recovery are captured before review. Recorded fields alone do not make a change ready."
            visual={<StageBoard />}
          />
          <PublicFeaturePanel
            reverse
            eyebrow="02 · History"
            action={{ href: "/docs/audit-logs", label: "Understand audit history" }}
            title="Every revision, kept."
            copy="Authorship and earlier revisions stay visible for comparison. Conflict handling depends on your surface and installed version."
            visual={<HistoryBoard />}
          />
          <PublicFeaturePanel
            eyebrow="03 · Validation"
            action={{ href: "/docs/releaseops/readiness", label: "Read the readiness guide" }}
            title="Green is not the same as validated."
            copy="Trigger, execution, technical and functional checks, rollback and closure are judged separately. A passing workflow alone does not verify the outcome."
            visual={<ValidationBoard />}
          />
        </PublicFeatureSection>
        <div className="public-feature-followup">
          <Link href="/product#deployment-model" className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-300 underline underline-offset-4 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4">Inspect deployment scenarios and stages <span aria-hidden="true">↗</span></Link>
        </div>

        <WorksWithStrip />



        <section aria-labelledby="workspace-preview-title" className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-10">
          <div className="mb-8 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Inside the workspace</p>
            <h2 id="workspace-preview-title" className="mt-3 text-3xl font-medium tracking-[-0.04em] text-zinc-100 sm:text-[40px] sm:leading-[1.1]">See the workflow in context.</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">Explore the product presentation below. When recorded product media is unavailable, a clearly labelled scripted tour illustrates the workflow.</p>
          </div>
          <HomepageMediaShowcase fallback={<CinematicAxiomDemo variant="hero" />} />
        </section>

        <section className="px-5 py-24 sm:px-8 lg:px-10" aria-labelledby="public-benefits-title">
          <div className="mx-auto max-w-[1080px]">
            <div className="public-section-intro"><p>// Built for engineering teams</p><h2 id="public-benefits-title">More context.<br/><span>Clearer decisions.</span></h2></div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {pillars.map(pillar=><EvidenceCard key={pillar.eyebrow} eyebrow={pillar.eyebrow} icon={<pillar.icon className="h-5 w-5" />} title={pillar.title} detail={pillar.copy} />)}
              <EvidenceCard icon={<ScaleIcon className="h-5 w-5" />} title="Policy stays in charge" detail="Local preferences cannot weaken your organization's approvals, permissions or production gates." />
              <EvidenceCard icon={<FingerPrintIcon className="h-5 w-5" />} title="Sign in through your browser" detail="Desktop sessions start in the system browser with an expiring, one-time, device-bound challenge." />
              <EvidenceCard icon={<ClockIcon className="h-5 w-5" />} title="History survives reconnects" detail="Last-known records stay visible, clearly marked stale with the time of the last good response." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1128px] px-6 py-24 text-center">
          <div className="rounded-xl bg-[#171615] px-6 py-16">
            <h2 className="text-4xl leading-tight">Start with a verified request.</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-6 text-zinc-400">Help build autonomous engineering with people in control.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              <Link href="/download" className="orbit-primary">Download V19 <ArrowRightIcon className="ml-2 h-4 w-4" /></Link>
              <Link href="/support" className="orbit-secondary">Meet the Founding Supporters program <ArrowRightIcon className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>
      </main>
      <Footer showCta={false} />
    </div>
  );
}


function StageBoard() { return <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-white/10 bg-[#0a0908]/95 text-zinc-200"><div className="border-b border-white/[0.07] px-5 py-4 text-sm">Request completeness</div>{phases.map((phase, index) => <div key={phase} className="flex items-center gap-3 border-b border-white/6 px-5 py-4 last:border-0"><span className={`h-2 w-2 rounded-full ${index < 4 ? 'bg-zinc-300' : 'bg-zinc-600'}`} /><span className="text-sm">{phase}</span><span className="ml-auto text-xs text-zinc-400">{index < 4 ? 'Recorded' : 'Review required'}</span></div>)}</div>; }
function HistoryBoard() { return <div className="mx-auto max-w-xl rounded-xl border border-white/10 bg-[#0a0908]/95 p-5 text-zinc-200"><p className="text-sm font-medium">Immutable history</p>{[4,3,2].map((version, index) => <div key={version} className="mt-4 rounded-lg border border-white/[0.07] bg-white/2.5 p-4"><div className="flex justify-between"><span className="text-sm">Revision {version}</span><span className="text-xs text-zinc-400">{index === 0 ? 'Current record' : 'Superseded'}</span></div><p className="mt-2 text-xs text-zinc-400">Actor recorded · changed field names only · SHA-256 digest</p></div>)}</div>; }
function ValidationBoard() { return <div className="mx-auto grid max-w-2xl gap-px overflow-hidden rounded-xl border border-white/10 bg-black/35 text-zinc-200 sm:grid-cols-2">{[["Trigger","Workflow accepted"],["Execution","No result yet"],["Technical validation","Required"],["Functional validation","Required"],["Rollback","Instruction recorded"],["Closure","Blocked until evidence"]].map(([label,value]) => <div key={label} className="bg-[#0a0908]/95 p-5"><p className="text-xs text-zinc-400">{label}</p><p className="mt-2 text-sm">{value}</p></div>)}</div>; }
function EvidenceCard({ icon, title, detail, eyebrow }: { icon: ReactNode; title: string; detail: string; eyebrow?:string }) { return <article className="rounded-xl border border-white/6 bg-[#171615] p-7"><span className="text-zinc-400">{icon}</span>{eyebrow&&<p className="mt-5 text-sm text-zinc-400">{eyebrow}</p>}<h3 className="mt-5 text-xl font-normal leading-6">{title}</h3><p className="mt-3 text-base leading-relaxed text-zinc-400">{detail}</p></article>; }
