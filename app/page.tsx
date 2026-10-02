import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  ClockIcon,
  FingerPrintIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { DeploymentLifecycleDemo } from "@/components/marketing/DeploymentLifecycleDemo";

const phases = ["Window", "Scope", "Execution", "Validation", "Recovery"];

const capabilities = [
  "Tenant-scoped records",
  "Versioned request history",
  "Optimistic concurrency",
  "Authored audit changes",
  "Explicit supersession",
  "Honest stale-data states",
  "Approval-gated execution",
  "Evidence-led closure",
];

const highlights = [
  { date: "Sep 30, 2026", title: "Secure browser pairing for Axiom Agent", href: "/changelog" },
  { date: "Sep 29, 2026", title: "Immutable request history and privacy-safe summaries", href: "/changelog" },
  { date: "Sep 28, 2026", title: "Verified request-to-playbook desktop workflow", href: "/changelog" },
  { date: "Sep 27, 2026", title: "Explicit reconnect and stale-record handling", href: "/changelog" },
];

export default function Home() {
  return (
    <div className="axiom-canvas min-h-screen text-[#ecece8]">
      <Navigation />
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-18 pt-28 sm:px-8 lg:pb-24 lg:pt-36">
          <div className="max-w-[700px]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Axiom Agent · deployment operations</p>
            <h1 className="mt-6 text-[clamp(2.7rem,4.65vw,5rem)] font-medium leading-[0.98] tracking-[-0.05em] text-[#f1f1ed]">
              Turn the request into the playbook.
            </h1>
            <p className="mt-7 max-w-[620px] text-base leading-7 text-zinc-400 sm:text-lg">
              A governed desktop workspace for deployment intake, review, execution guidance, production validation, and audit-ready closure.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/download" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#efefec] px-7 py-3 text-sm font-semibold text-[#151513] hover:bg-white">
                Download Axiom Agent <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href="/demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-7 py-3 text-sm font-medium text-zinc-200 hover:bg-white/[0.08]">
                Explore the isolated demo <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="relative mt-14 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#171714] p-3 shadow-2xl shadow-black/30 sm:p-5 lg:mt-16 lg:p-8">
            <div
              aria-hidden
              className="absolute inset-0 scale-105 bg-cover bg-[position:60%_center] opacity-75 sm:bg-center"
              style={{ backgroundImage: "url('/images/axiom-hero-landscape-v1.png')" }}
            />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,10,12,0.12),rgba(9,10,12,0.42)_42%,rgba(9,10,12,0.86))]" />
            <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/35 to-transparent" />
            <div className="relative">
              <div className="mb-3 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300/80">
                <span>Release operations, made visible</span>
                <span className="hidden sm:inline">Axiom Agent preview</span>
              </div>
              <DeploymentLifecycleDemo />
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-[#11110f] px-5 py-10 sm:px-8">
          <p className="text-center text-xs text-zinc-500">Built-in controls used throughout the verified workflow</p>
          <div className="mx-auto mt-6 grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-4">
            {capabilities.map((item) => <div key={item} className="flex min-h-20 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 text-center text-[11px] font-medium leading-4 text-zinc-300">{item}</div>)}
          </div>
        </section>

        <section className="mx-auto max-w-6xl space-y-8 px-5 py-20 sm:px-8 lg:py-28">
          <EditorialPanel
            eyebrow="01 · Structured intake"
            title="Five stages. No hidden assumptions."
            copy="The request captures the deployment window, affected scope, exact execution, production validation, and recovery path before a playbook is treated as ready."
            backdrop="/images/axiom-intake-landscape-v1.png"
            visual={<StageBoard />}
          />
          <EditorialPanel
            reverse
            eyebrow="02 · Revision integrity"
            title="Every meaningful edit has an author and a version."
            copy="Updates use optimistic concurrency. If the record changed elsewhere, Axiom stops and asks the operator to reconcile instead of silently overwriting newer work."
            backdrop="/images/axiom-history-landscape-v1.png"
            visual={<HistoryBoard />}
          />
          <EditorialPanel
            eyebrow="03 · Operational truth"
            title="A green workflow is not production validation."
            copy="Axiom keeps trigger state, execution state, technical validation, functional validation, rollback readiness, and closure evidence separate so the interface never invents certainty."
            backdrop="/images/axiom-validation-landscape-v1.png"
            visual={<ValidationBoard />}
          />
        </section>

        <section className="border-y border-white/[0.06] bg-[#11110f] px-5 py-20 sm:px-8 lg:px-10">
          <h2 className="mx-auto max-w-5xl text-center text-3xl font-medium tracking-[-0.04em] sm:text-4xl">Designed around production reality.</h2>
          <div className="mx-auto mt-9 grid max-w-5xl gap-3 md:grid-cols-3">
            <EvidenceCard icon={<ShieldCheckIcon className="h-6 w-6" />} title="Policy remains authoritative" detail="Desktop preferences cannot weaken organization approvals, permission boundaries, or production gates." />
            <EvidenceCard icon={<FingerPrintIcon className="h-6 w-6" />} title="Browser-authorized desktop sessions" detail="Sign-in and account creation happen in the system browser through an expiring, one-time device-bound challenge." />
            <EvidenceCard icon={<ClockIcon className="h-6 w-6" />} title="Reconnect without rewriting history" detail="Last-known records remain visible and are explicitly marked stale with the last successful service-response time." />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <h2 className="text-3xl font-medium tracking-[-0.035em]">Recent highlights</h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] md:grid-cols-2 xl:grid-cols-4">
            {highlights.map((item) => (
              <Link key={item.title} href={item.href} className="min-h-40 bg-[#171714] p-5 transition hover:bg-[#1b1b18]">
                <p className="text-sm text-zinc-600">{item.date} · Product</p>
                <p className="mt-3 text-lg leading-7 text-zinc-200">{item.title}</p>
              </Link>
            ))}
          </div>
          <Link href="/changelog" className="mt-6 inline-flex items-center gap-2 text-sm text-orange-500 hover:text-orange-400">View all product changes <ArrowRightIcon className="h-4 w-4" /></Link>
        </section>

        <section className="px-5 py-28 text-center sm:px-8 lg:py-40">
          <h2 className="text-[clamp(3.5rem,8vw,7.8rem)] font-medium leading-none tracking-[-0.065em]">Start with a verified request.</h2>
          <Link href="/download" className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#efefec] px-8 py-3 text-sm font-semibold text-[#151513] hover:bg-white">Download Axiom Agent <ArrowRightIcon className="h-4 w-4" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function EditorialPanel({ eyebrow, title, copy, visual, backdrop, reverse = false }: { eyebrow: string; title: string; copy: string; visual: ReactNode; backdrop: string; reverse?: boolean }) {
  return <article className="relative grid overflow-hidden rounded-2xl border border-white/[0.08] bg-[#171714] lg:grid-cols-[0.72fr_1.28fr]">
    <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url('${backdrop}')` }} />
    <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,13,12,0.9),rgba(12,13,12,0.58)_48%,rgba(12,13,12,0.35))]" />
    <div className={`relative flex min-h-72 flex-col justify-end p-7 sm:p-10 lg:p-12 ${reverse ? "lg:order-2" : ""}`}><p className="text-[11px] uppercase tracking-[0.16em] text-orange-300">{eyebrow}</p><h2 className="mt-5 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">{title}</h2><p className="mt-4 max-w-lg text-base leading-7 text-zinc-300/75">{copy}</p></div>
    <div className={`relative m-3 min-h-[400px] rounded-xl border border-white/[0.08] bg-black/35 p-5 text-zinc-100 shadow-2xl shadow-black/35 backdrop-blur-[2px] sm:m-5 sm:p-8 ${reverse ? "lg:order-1" : ""}`}>{visual}</div>
  </article>;
}

function StageBoard() { return <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-white/[0.1] bg-[#10110f]/95 text-zinc-200 shadow-2xl"><div className="border-b border-white/[0.07] px-5 py-4 text-sm">Request completeness</div>{phases.map((phase, index) => <div key={phase} className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4 last:border-0"><span className={`h-2 w-2 rounded-full ${index < 4 ? 'bg-orange-300' : 'bg-zinc-600'}`} /><span className="text-sm">{phase}</span><span className="ml-auto text-xs text-zinc-500">{index < 4 ? 'Recorded' : 'Review required'}</span></div>)}</div>; }
function HistoryBoard() { return <div className="mx-auto max-w-xl rounded-xl border border-white/[0.1] bg-[#10110f]/95 p-5 text-zinc-200 shadow-2xl"><p className="text-sm font-medium">Immutable history</p>{[4,3,2].map((version, index) => <div key={version} className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex justify-between"><span className="text-sm">Revision {version}</span><span className="text-xs text-zinc-500">{index === 0 ? 'Current record' : 'Superseded'}</span></div><p className="mt-2 text-xs text-zinc-500">Actor recorded · changed field names only · SHA-256 digest</p></div>)}</div>; }
function ValidationBoard() { return <div className="mx-auto grid max-w-2xl gap-px overflow-hidden rounded-xl border border-white/[0.1] bg-black/35 text-zinc-200 shadow-2xl sm:grid-cols-2">{[["Trigger","Workflow accepted"],["Execution","No result yet"],["Technical validation","Required"],["Functional validation","Required"],["Rollback","Instruction recorded"],["Closure","Blocked until evidence"]].map(([label,value]) => <div key={label} className="bg-[#10110f]/95 p-5"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-sm">{value}</p></div>)}</div>; }
function EvidenceCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <article className="min-h-60 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-7 sm:p-8"><span className="text-zinc-400">{icon}</span><h3 className="mt-10 text-lg font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{detail}</p></article>; }
