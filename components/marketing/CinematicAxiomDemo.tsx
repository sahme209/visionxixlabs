"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "@heroicons/react/24/outline";
import { DesktopPreviewFrame } from "./DesktopPreviewFrame";
import { WORKFLOW_STORIES } from "./workflowStories";
import { useStoryPlayback } from "./useStoryPlayback";
import { WorkflowStoryScene, storyButton, type SampleDecision, type StoryContext } from "./WorkflowStoryScene";

export function CinematicAxiomDemo({ variant = "section" }: { variant?: "section" | "hero" } = {}) {
  const [storyIndex, setStoryIndex] = useState(0);
  const [context, setContext] = useState<StoryContext>({ repository: "acme/customer-web", branch: "feature/timeout", environment: "Development" });
  const [decision, setDecision] = useState<SampleDecision>(null);
  const story = WORKFLOW_STORIES[storyIndex];
  const container = useRef<HTMLElement>(null);
  const playback = useStoryPlayback(story.steps, container);
  const step = story.steps[playback.index] ?? story.steps[0];
  function selectStory(index: number) { setStoryIndex(index); setDecision(null); playback.reset(); }
  function choose(index: number) { setDecision(null); playback.choose(index); }
  function changeContext(key: keyof StoryContext, value: string) { setContext(current => ({ ...current, [key]: value })); setDecision(null); playback.reset(); }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowRight") { event.preventDefault(); choose(playback.index + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); choose(playback.index - 1); }
    if (event.key === "Home") { event.preventDefault(); choose(0); }
    if (event.key === "End") { event.preventDefault(); choose(story.steps.length - 1); }
  }
  return <section ref={container} id="product-tour" aria-label="Axiom interactive workflow stories" className={variant === "hero" ? "mt-10 min-w-0 text-left" : "mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-10 lg:py-20"}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-[10px] font-medium text-zinc-400"><span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> Interactive simulation · scripted walkthrough</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a workflow story">{WORKFLOW_STORIES.map((item, index) => <button key={item.id} type="button" aria-pressed={index === storyIndex} onClick={() => selectStory(index)} className={`${storyButton} ${index === storyIndex ? "border-white/25 bg-white/[0.06] text-zinc-100" : ""}`}>{item.label}</button>)}</div>
    </div>
    <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-300">{story.eyebrow}</p>
        <h2 className="mt-3 text-2xl font-medium leading-tight tracking-[-0.035em] text-zinc-100 sm:text-3xl">{step.title}</h2>
        <p className="mt-4 text-sm leading-6 text-zinc-400">{step.caption}</p>
        <div className="mt-5 grid gap-1" aria-label="Story steps">{story.steps.map((item, index) => <button key={item.title} type="button" aria-current={index === playback.index ? "step" : undefined} aria-label={`Step ${index + 1}: ${item.title}`} onClick={() => choose(index)} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left text-xs leading-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-300 ${index === playback.index ? "bg-white/[0.06] text-zinc-100" : "text-zinc-400 hover:bg-white/[0.03]"}`}><span className={`font-mono text-[10px] ${index === playback.index ? "text-zinc-300" : "text-zinc-500"}`}>0{index + 1}</span>{item.title}</button>)}</div>
        <div role="group" aria-label="Story playback" onKeyDown={keyboard} className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" className={storyButton} aria-label={playback.playing ? "Pause story" : "Play story"} disabled={playback.reducedMotion} onClick={playback.toggle}>{playback.playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}{playback.playing ? "Pause" : "Play"}</button>
          <button type="button" className={storyButton} aria-label="Replay story" onClick={() => { setDecision(null); playback.replay(); }}><ArrowPathIcon className="h-4 w-4" /></button>
          <button type="button" className={storyButton} aria-label="Previous step" disabled={playback.index === 0} onClick={() => choose(playback.index - 1)}><ChevronLeftIcon className="h-4 w-4" /></button>
          <button type="button" className={storyButton} aria-label="Next step" disabled={playback.index === story.steps.length - 1} onClick={() => choose(playback.index + 1)}><ChevronRightIcon className="h-4 w-4" /></button>
          <span className="ml-1 text-xs tabular-nums text-zinc-400">{playback.index + 1} / {story.steps.length}</span>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-zinc-400">{playback.reducedMotion ? "Reduced motion · use the step controls" : playback.playing && !playback.active ? "Playback paused while out of view" : step.review ? "Playback stops at review. Decisions here are samples only." : "Play the sequence, or explore each step at your own pace."}</p>
      </div>
      <DesktopPreviewFrame view={story.id === "workspace" ? "repository-workspace" : story.id === "agent" ? "agent" : "deployment-requests"}>
        <div className="h-0.5 bg-white/5" aria-hidden="true"><div className="h-full bg-zinc-400" style={{ width: `${((playback.index + playback.fraction) / story.steps.length) * 100}%` }} /></div>
        <div className="grid gap-3 border-b border-white/[0.08] p-4 sm:grid-cols-3"><ContextSelect label="Repository" value={context.repository} values={["acme/customer-web", "acme/payments-api"]} onChange={value => changeContext("repository", value)} /><ContextSelect label="Branch" value={context.branch} values={["feature/timeout", "review/retry-policy"]} onChange={value => changeContext("branch", value)} /><ContextSelect label="Environment" value={context.environment} values={["Development", "Test", "Production · held"]} onChange={value => changeContext("environment", value)} /></div>
        <div className="p-4 sm:p-5"><WorkflowStoryScene scene={step.scene} context={context} fraction={playback.fraction} reducedMotion={playback.reducedMotion} active={playback.active} decision={decision} onDecision={value => { playback.choose(playback.index); setDecision(value); }} /></div>
        <div className="border-t border-white/10 bg-white/[0.02] px-4 py-3"><p className="text-[11px] leading-5 text-zinc-400">Illustrated from Axiom workflows. Sample content; no live actions.</p></div>
      </DesktopPreviewFrame>
    </div>
    <div className="mt-5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"><p className="text-[10px] font-medium uppercase tracking-widest text-zinc-300">Current availability</p><p className="mt-2 text-xs leading-6 text-zinc-400">{story.limitation}</p><Link href="/docs/approval-workflow" onNavigate={() => window.dispatchEvent(new Event("axiom:documentation-navigation-intent"))} className="mt-2 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-zinc-300 underline-offset-4 hover:underline">Read approval workflow <ChevronRightIcon className="h-3 w-3" /></Link></div>
    <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-5 text-xs leading-6 text-zinc-400 sm:flex-row sm:items-center sm:justify-between"><p>Scripted sample data. No cloud account, repository, AI credits, or deployment is touched.</p><Link href="/demo" className="inline-flex min-h-11 shrink-0 items-center gap-2 font-medium text-zinc-300">Explore every safe demo <ChevronRightIcon className="h-4 w-4" /></Link></div>
  </section>;
}
function ContextSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="min-w-0"><span className="mb-2 block text-[9px] uppercase tracking-widest text-zinc-400">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#191b1d] px-2 text-xs text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-300">{values.map(item => <option key={item}>{item}</option>)}</select></label>;
}
