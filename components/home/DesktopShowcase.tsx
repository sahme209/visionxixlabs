import Link from "next/link";
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const workflowStages = ["Window", "Scope", "Execution", "Validation", "Recovery"];

export function DesktopShowcase() {
  return (
    <section className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid items-end gap-8 border-t border-white/[0.08] pt-10 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Axiom Desktop</p>
            <h2 className="mt-4 max-w-xl text-[clamp(2.4rem,4vw,4.5rem)] font-medium leading-[0.98] tracking-[-0.045em] text-white">
              The operational record stays with the work.
            </h2>
          </div>
          <div className="max-w-2xl lg:justify-self-end">
            <p className="text-[17px] leading-7 text-zinc-400">
              Capture a deployment request, produce a versioned playbook, and keep approvals,
              validation, rollback, and evidence visible in one installed workspace.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/download" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-200">
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download desktop app
              </Link>
              <Link href="/demo" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.035] px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.07]">
                Explore the isolated demo <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-16 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#171817]">
          <div className="flex h-10 items-center border-b border-white/[0.07] px-4">
            <div className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            </div>
            <p className="flex-1 text-center text-[11px] text-zinc-500">Axiom Agent · illustrative workspace</p>
          </div>

          <div className="grid min-h-[520px] lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="border-b border-white/[0.07] bg-[#141515] p-4 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.10] bg-white/[0.04] text-sm font-semibold">A</span>
                <div>
                  <p className="text-sm font-semibold text-white">Axiom Agent</p>
                  <p className="text-[10px] text-zinc-500">Desktop workspace</p>
                </div>
              </div>
              <nav className="mt-5 space-y-5" aria-label="Illustrative desktop navigation">
                <PreviewNavGroup label="Deployment" items={["Requests & playbooks"]} active="Requests & playbooks" />
                <PreviewNavGroup label="Workspace" items={["Documentation", "Settings"]} />
              </nav>
              <div className="mt-28 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-[11px] text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Production access active
              </div>
            </aside>

            <div className="min-w-0 bg-[#111212]">
              <header className="flex h-[68px] items-center justify-between border-b border-white/[0.07] px-6">
                <div>
                  <p className="text-sm font-semibold text-white">Requests & playbooks</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Governed intake into a versioned deployment playbook</p>
                </div>
                <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-300">Workspace verified</span>
              </header>

              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-white">Deployment requests</h3>
                    <p className="mt-1 text-sm text-zinc-500">Service last responded today at 3:42 PM.</p>
                  </div>
                  <button type="button" className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950">New request</button>
                </div>

                <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#191a1a] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Production configuration rollout</p>
                      <p className="mt-1 text-[10px] text-zinc-500">Illustrative record · request version 1 · correlation ID retained</p>
                    </div>
                    <span className="rounded-md border border-amber-400/20 bg-amber-400/[0.07] px-2 py-1 text-[10px] uppercase tracking-wide text-amber-200">Awaiting approval</span>
                  </div>

                  <div className="mt-5 grid grid-cols-5 gap-2">
                    {workflowStages.map((stage, index) => (
                      <div key={stage} className={`rounded-lg border px-2 py-2 text-center text-[10px] ${index < 3 ? "border-white/[0.10] bg-white/[0.05] text-zinc-200" : "border-white/[0.05] text-zinc-600"}`}>
                        {index + 1}. {stage}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <Detail icon={DocumentTextIcon} label="Current record" value="Request v1" />
                    <Detail icon={ShieldCheckIcon} label="Approval gate" value="Platform owner" />
                    <Detail icon={ClockIcon} label="Change window" value="22:00–23:00 ET" />
                  </div>

                  <div className="mt-5 border-t border-white/[0.07] pt-4">
                    <p className="text-[11px] font-medium text-zinc-300">Latest playbook · v4</p>
                    <ol className="mt-3 grid gap-2 text-[11px] text-zinc-500 md:grid-cols-2">
                      {["Confirm approved request version", "Run documented production trigger", "Validate expected production result", "Attach evidence and close"].map((step) => (
                        <li key={step} className="flex items-center gap-2">
                          <CheckCircleIcon className="h-4 w-4 shrink-0 text-zinc-400" /> {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] md:grid-cols-3">
          <Feature title="Versioned by default" detail="Request and playbook versions remain explicit throughout review." />
          <Feature title="Human authority stays visible" detail="Approval gates and responsible roles remain attached to each stage." />
          <Feature title="Failure remains honest" detail="Stale data, deferred validation, and unavailable adapters are labeled directly." />
        </div>
      </div>
    </section>
  );
}

function PreviewNavGroup({ label, items, active }: { label: string; items: string[]; active?: string }) {
  return (
    <div>
      <p className="px-2 text-[11px] text-zinc-500">{label}</p>
      <div className="mt-1.5 space-y-1">
        {items.map((item) => (
          <div key={item} className={`rounded-lg border px-3 py-2 text-[12px] ${item === active ? "border-white/[0.07] bg-white/[0.07] text-white" : "border-transparent text-zinc-500"}`}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
      <Icon className="h-4 w-4 text-zinc-500" />
      <p className="mt-3 text-[10px] text-zinc-600">{label}</p>
      <p className="mt-0.5 text-[12px] text-zinc-300">{value}</p>
    </div>
  );
}

function Feature({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="bg-[#151615] p-5">
      <p className="text-sm font-medium text-zinc-100">{title}</p>
      <p className="mt-2 text-[12px] leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}
