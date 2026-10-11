"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CodeBracketIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const chapters = [
  {
    id: "ask",
    kicker: "01 · Select context",
    title: "Ask with the repository already attached.",
    copy: "Choose a repository, branch, and environment. Axiom carries that context into the conversation, so operators do not have to write identifiers into every request.",
  },
  {
    id: "ground",
    kicker: "02 · Ground the answer",
    title: "Inspect evidence before proposing a change.",
    copy: "The Agent reads the selected branch through audited, repository-scoped tools and cites the files it used. Read-only inspection can run immediately.",
  },
  {
    id: "approve",
    kicker: "03 · Govern the write",
    title: "Review the exact action, risk, and rollback.",
    copy: "A proposed write stops at an approval gate. The reviewer sees the diff, target, reason, risk, and recovery path before granting authority.",
  },
  {
    id: "deploy",
    kicker: "04 · Coordinate and execute",
    title: "Wait for the data dependency, then deploy safely.",
    copy: "Axiom verifies the selected Airflow DAG run before dispatching the approved release. The environment resolves to its configured target, while production remains separately gated.",
  },
  {
    id: "prove",
    kicker: "05 · Close with evidence",
    title: "Keep validation and recovery attached to the release.",
    copy: "A successful trigger is not treated as proof. Axiom preserves provider status, validation, approvals, audit events, and rollback readiness as separate evidence.",
  },
] as const;

const repositories = ["acme/payments-api", "acme/customer-web"];
const environments = ["Development · dev", "Test · test", "Production · prod"];

export function CinematicAxiomDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [repository, setRepository] = useState(repositories[0]);
  const [branch, setBranch] = useState("main");
  const [environment, setEnvironment] = useState(environments[0]);
  const chapter = chapters[activeIndex];

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!playing || reduceMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % chapters.length);
    }, 6200);
    return () => window.clearInterval(timer);
  }, [playing]);

  const progress = ((activeIndex + 1) / chapters.length) * 100;

  const chooseChapter = (index: number) => {
    setActiveIndex(index);
    setPlaying(false);
  };

  return (
    <section id="product-tour" className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/[0.06] px-3 py-1.5 text-[11px] font-medium text-orange-200">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Interactive simulation
          </span>
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.18em] text-orange-300">{chapter.kicker}</p>
          <h2 className="mt-3 max-w-xl text-3xl font-medium leading-tight tracking-[-0.045em] text-zinc-100 sm:text-5xl">
            {chapter.title}
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-zinc-400">{chapter.copy}</p>

          <div className="mt-8 space-y-1" role="tablist" aria-label="Product tour chapters">
            {chapters.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                onClick={() => chooseChapter(index)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  index === activeIndex ? "bg-white/[0.06] text-zinc-100" : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${index === activeIndex ? "bg-orange-400" : "bg-zinc-700"}`} />
                <span>{item.title}</span>
                <ChevronRightIcon className="ml-auto h-4 w-4 opacity-40 transition group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaying((current) => !current)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.05]"
            >
              {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => { setActiveIndex(0); setPlaying(true); }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200"
              aria-label="Replay product tour"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
            <span className="ml-2 text-xs tabular-nums text-zinc-600">{activeIndex + 1} / {chapters.length}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#111210] shadow-[0_32px_100px_-44px_rgba(249,115,22,0.34)]">
          <div className="h-0.5 bg-white/[0.05]">
            <div className="h-full bg-orange-400 transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex h-12 items-center border-b border-white/[0.07] px-4">
            <div className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
            <p className="flex-1 text-center text-xs text-zinc-500">Axiom Agent · simulated workspace</p>
            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-emerald-300">guardrails on</span>
          </div>

          <div className="grid min-h-[620px] md:grid-cols-[190px_minmax(0,1fr)]">
            <aside className="hidden border-r border-white/[0.07] bg-[#151614] p-4 md:block">
              <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-300/20 bg-orange-400/[0.08] font-semibold text-orange-200">A</span>
                <div><p className="text-sm font-medium text-zinc-100">Axiom Agent</p><p className="text-[10px] text-zinc-600">Desktop workspace</p></div>
              </div>
              <p className="mt-5 text-[9px] uppercase tracking-[0.16em] text-zinc-600">Deployment</p>
              {['Agent', 'Release workspace'].map((item, index) => <div key={item} className={`mt-2 rounded-lg px-3 py-2 text-xs ${index === 0 ? 'bg-white/[0.06] text-zinc-100' : 'text-zinc-500'}`}>{item}</div>)}
              <p className="mt-6 text-[9px] uppercase tracking-[0.16em] text-zinc-600">Workspace</p>
              {['GitHub repositories', 'Plugins & Skills', 'Settings'].map((item) => <div key={item} className="mt-2 px-3 py-2 text-xs text-zinc-500">{item}</div>)}
            </aside>

            <div className="flex min-w-0 flex-col">
              <div className="grid gap-2 border-b border-white/[0.07] p-3 sm:grid-cols-3">
                <ContextSelect label="Repository" value={repository} values={repositories} onChange={setRepository} />
                <ContextSelect label="Branch" value={branch} values={["main", "release/2026-10"]} onChange={setBranch} />
                <ContextSelect label="Environment" value={environment} values={environments} onChange={setEnvironment} />
              </div>
              <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
                <DemoScene chapter={chapter.id} repository={repository} environment={environment} />
              </div>
              <div className="border-t border-white/[0.07] p-4">
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3">
                  <span className="flex-1 text-sm text-zinc-500">Ask Axiom to inspect, change, or deploy…</span>
                  <span className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-950">Send</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-4 border-t border-white/[0.07] pt-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Scripted sample data. No cloud account, repository, AI credits, or deployment is touched.</p>
        <Link href="/demo" className="inline-flex items-center gap-2 font-medium text-orange-300 transition hover:text-orange-200">Explore every safe demo <ChevronRightIcon className="h-4 w-4" /></Link>
      </div>
    </section>
  );
}

function ContextSelect({ label, value, values, onChange }: { label: string; value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-[8px] uppercase tracking-[0.16em] text-zinc-600">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#171815] px-2 text-xs text-zinc-300 outline-none focus:border-orange-400/40">{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
}

function DemoScene({ chapter, repository, environment }: { chapter: typeof chapters[number]["id"]; repository: string; environment: string }) {
  if (chapter === "ask") return <SceneShell icon={<CodeBracketIcon className="h-5 w-5" />} label="You" title="Fix the timeout handling and prepare it for development."><p>Axiom has attached <strong>{repository}</strong>, branch <strong>main</strong>, and <strong>{environment}</strong>. No identifiers to retype.</p></SceneShell>;
  if (chapter === "ground") return <SceneShell icon={<CodeBracketIcon className="h-5 w-5" />} label="Repository evidence" title="The timeout is handled in two places."><div className="space-y-2 font-mono text-xs"><EvidenceLine path="src/client/retry.ts" detail="lines 42–68 · retry policy" /><EvidenceLine path="src/config/runtime.ts" detail="lines 14–22 · timeout default" /></div><p className="mt-4">Proposed change: make the timeout configurable and preserve the existing retry ceiling.</p></SceneShell>;
  if (chapter === "approve") return <div className="w-full max-w-xl rounded-2xl border border-orange-300/20 bg-[#171815] p-5 shadow-2xl"><div className="flex items-start gap-3"><ShieldCheckIcon className="mt-0.5 h-6 w-6 text-orange-300" /><div><p className="text-xs uppercase tracking-[0.14em] text-orange-300">Approval required · medium risk</p><h3 className="mt-2 text-lg font-medium text-zinc-100">Commit two reviewed file changes</h3></div></div><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><Fact label="Target" value={`${repository} · main`} /><Fact label="Environment" value={environment} /><Fact label="Rollback" value="Revert commit" /><Fact label="Authority" value="Workspace admin" /></dl><div className="mt-5 flex justify-end gap-2"><span className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-400">Reject</span><span className="rounded-lg bg-orange-400 px-4 py-2 text-xs font-semibold text-[#211006]">Approve action</span></div></div>;
  if (chapter === "deploy") return <div className="w-full max-w-xl space-y-3"><StatusRow label="Airflow · daily_customer_snapshot" value="Batch complete · dependencies satisfied" complete /><StatusRow label="Approval" value="Recorded for this environment" complete /><StatusRow label="GitHub workflow" value="Dispatched with short-lived OIDC" complete /><StatusRow label="AWS ECS" value="Waiting for steady state" /><StatusRow label="Automatic rollback" value="Armed" /></div>;
  return <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2"><Metric label="Technical validation" value="Passed" tone="green" /><Metric label="Functional validation" value="Awaiting owner" tone="orange" /><Metric label="Rollback readiness" value="Verified" tone="green" /><Metric label="Audit events" value="12 recorded" tone="neutral" /></div>;
}

function SceneShell({ icon, label, title, children }: { icon: React.ReactNode; label: string; title: string; children: React.ReactNode }) { return <div className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#171815] p-5 sm:p-6"><div className="flex items-center gap-2 text-orange-300">{icon}<span className="text-[10px] uppercase tracking-[0.16em]">{label}</span></div><h3 className="mt-4 text-xl font-medium tracking-[-0.025em] text-zinc-100">{title}</h3><div className="mt-4 text-sm leading-6 text-zinc-400">{children}</div></div>; }
function EvidenceLine({ path, detail }: { path: string; detail: string }) { return <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3"><p className="text-zinc-200">{path}</p><p className="mt-1 text-zinc-600">{detail}</p></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3"><dt className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{label}</dt><dd className="mt-1 text-zinc-300">{value}</dd></div>; }
function StatusRow({ label, value, complete = false }: { label: string; value: string; complete?: boolean }) { return <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#171815] p-4"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${complete ? 'bg-emerald-400/10 text-emerald-300' : 'bg-orange-400/10 text-orange-300'}`}>{complete ? <CheckCircleIcon className="h-5 w-5" /> : <ArrowPathIcon className="h-5 w-5" />}</span><div><p className="text-sm text-zinc-200">{label}</p><p className="text-xs text-zinc-500">{value}</p></div></div>; }
function Metric({ label, value, tone }: { label: string; value: string; tone: "green" | "orange" | "neutral" }) { const toneClass = tone === "green" ? "text-emerald-300" : tone === "orange" ? "text-orange-300" : "text-zinc-300"; return <div className="rounded-xl border border-white/[0.08] bg-[#171815] p-5"><p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">{label}</p><p className={`mt-3 text-lg font-medium ${toneClass}`}>{value}</p></div>; }
