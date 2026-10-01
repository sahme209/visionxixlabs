import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  CheckCircleIcon,
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
    <div className="axiom-canvas axiom-product-canvas min-h-screen text-[#ecece8]">
      <Navigation />
      <main>
        <section className="mx-auto max-w-[1720px] px-5 pb-20 pt-36 sm:px-8 lg:px-12 lg:pb-28 lg:pt-44">
          <div className="max-w-[760px]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Axiom Agent · deployment operations</p>
            <h1 className="mt-7 text-[clamp(3.1rem,6vw,6.4rem)] font-medium leading-[0.94] tracking-[-0.06em] text-[#f1f1ed]">
              Turn the request into the playbook.
            </h1>
            <p className="mt-8 max-w-[650px] text-lg leading-8 text-zinc-400 sm:text-xl">
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

          <div className="mt-16 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#171714] p-3 sm:p-6 lg:mt-20 lg:p-10">
            <DeploymentLifecycleDemo />
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-[#11110f] py-12">
          <p className="text-center text-sm text-zinc-500">Built-in controls used throughout the verified workflow</p>
          <div className="mx-auto mt-7 grid max-w-[1720px] grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] px-5 sm:grid-cols-4 lg:grid-cols-8 lg:px-0">
            {capabilities.map((item) => <div key={item} className="flex min-h-24 items-center justify-center bg-[#171714] px-4 text-center text-xs font-medium leading-5 text-zinc-300">{item}</div>)}
          </div>
        </section>

        <section className="mx-auto max-w-[1720px] space-y-10 px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <EditorialPanel
            eyebrow="01 · Structured intake"
            title="Five stages. No hidden assumptions."
            copy="The request captures the deployment window, affected scope, exact execution, production validation, and recovery path before a playbook is treated as ready."
            visual={<StageBoard />}
          />
          <EditorialPanel
            reverse
            eyebrow="02 · Revision integrity"
            title="Every meaningful edit has an author and a version."
            copy="Updates use optimistic concurrency. If the record changed elsewhere, Axiom stops and asks the operator to reconcile instead of silently overwriting newer work."
            visual={<HistoryBoard />}
          />
          <EditorialPanel
            eyebrow="03 · Operational truth"
            title="A green workflow is not production validation."
            copy="Axiom keeps trigger state, execution state, technical validation, functional validation, rollback readiness, and closure evidence separate so the interface never invents certainty."
            visual={<ValidationBoard />}
          />
        </section>

        <section className="border-y border-white/[0.06] bg-[#11110f] px-5 py-24 sm:px-8 lg:px-10">
          <h2 className="mx-auto max-w-[1720px] text-center text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Designed around production reality.</h2>
          <div className="mx-auto mt-12 grid max-w-[1720px] gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] md:grid-cols-3">
            <EvidenceCard icon={<ShieldCheckIcon className="h-6 w-6" />} title="Policy remains authoritative" detail="Desktop preferences cannot weaken organization approvals, permission boundaries, or production gates." />
            <EvidenceCard icon={<FingerPrintIcon className="h-6 w-6" />} title="Browser-authorized desktop sessions" detail="Sign-in and account creation happen in the system browser through an expiring, one-time device-bound challenge." />
            <EvidenceCard icon={<ClockIcon className="h-6 w-6" />} title="Reconnect without rewriting history" detail="Last-known records remain visible and are explicitly marked stale with the last successful service-response time." />
          </div>
        </section>

        <section className="mx-auto max-w-[1720px] px-5 py-24 sm:px-8 lg:px-12">
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

function EditorialPanel({ eyebrow, title, copy, visual, reverse = false }: { eyebrow: string; title: string; copy: string; visual: ReactNode; reverse?: boolean }) {
  return <article className="grid overflow-hidden rounded-2xl border border-white/[0.06] bg-[#171714] lg:grid-cols-[0.72fr_1.28fr]">
    <div className={`flex min-h-72 flex-col justify-end p-7 sm:p-10 lg:p-12 ${reverse ? "lg:order-2" : ""}`}><p className="text-[11px] uppercase tracking-[0.16em] text-orange-500">{eyebrow}</p><h2 className="mt-5 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">{title}</h2><p className="mt-4 max-w-lg text-base leading-7 text-zinc-500">{copy}</p></div>
    <div className={`m-3 min-h-[420px] rounded-xl border border-white/[0.06] bg-[#cac8bf] p-5 text-[#171714] sm:m-5 sm:p-8 ${reverse ? "lg:order-1" : ""}`}>{visual}</div>
  </article>;
}

function StageBoard() { return <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-black/15 bg-[#151613] text-zinc-200 shadow-2xl"><div className="border-b border-white/[0.07] px-5 py-4 text-sm">Request completeness</div>{phases.map((phase, index) => <div key={phase} className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4 last:border-0"><CheckCircleIcon className={`h-5 w-5 ${index < 4 ? 'text-emerald-400' : 'text-amber-300'}`} /><span className="text-sm">{phase}</span><span className="ml-auto text-xs text-zinc-600">{index < 4 ? 'Complete' : 'Review required'}</span></div>)}</div>; }
function HistoryBoard() { return <div className="mx-auto max-w-xl rounded-xl border border-black/15 bg-[#151613] p-5 text-zinc-200 shadow-2xl"><p className="text-sm font-medium">Immutable history</p>{[4,3,2].map((version, index) => <div key={version} className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex justify-between"><span className="text-sm">Revision {version}</span><span className="text-xs text-zinc-600">{index === 0 ? 'Current' : 'Superseded'}</span></div><p className="mt-2 text-xs text-zinc-500">Actor recorded · changed field names only · SHA-256 digest</p></div>)}</div>; }
function ValidationBoard() { return <div className="mx-auto grid max-w-2xl gap-px overflow-hidden rounded-xl border border-black/15 bg-black/20 text-zinc-200 shadow-2xl sm:grid-cols-2">{[["Trigger","Workflow accepted"],["Execution","No result yet"],["Technical validation","Required"],["Functional validation","Required"],["Rollback","Instruction recorded"],["Closure","Blocked until evidence"]].map(([label,value]) => <div key={label} className="bg-[#151613] p-5"><p className="text-xs text-zinc-600">{label}</p><p className="mt-2 text-sm">{value}</p></div>)}</div>; }
function EvidenceCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <article className="min-h-64 bg-[#171714] p-7 sm:p-9"><span className="text-zinc-400">{icon}</span><h3 className="mt-12 text-xl font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{detail}</p></article>; }
