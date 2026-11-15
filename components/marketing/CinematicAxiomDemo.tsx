"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { DesktopPreviewFrame } from "./DesktopPreviewFrame";
import {usePreviewSequence} from "./usePreviewSequence";
import { WORKFLOW_STORIES } from "./workflowStories";
import { WorkflowStoryScene, storyButton, type SampleDecision, type StoryContext } from "./WorkflowStoryScene";

export function CinematicAxiomDemo({ variant = "section" }: { variant?: "section" | "hero" } = {}) {
  const [storyIndex, setStoryIndex] = useState(0);
  const [context, setContext] = useState<StoryContext>({ repository: "acme/customer-web", branch: "feature/timeout", environment: "Development" });
  const [decision, setDecision] = useState<SampleDecision>(null);
  const story = WORKFLOW_STORIES[storyIndex];
  const [stepIndex, setStepIndex] = useState(0);
  const step = story.steps[stepIndex] ?? story.steps[0];
  const sceneRef=useRef<HTMLDivElement>(null);
  const focusResponse = useRef(false);
  useEffect(() => {
    if (focusResponse.current) { focusResponse.current = false; sceneRef.current?.focus(); }
  }, [stepIndex]);
  const reveal=usePreviewSequence(sceneRef,`${storyIndex}:${stepIndex}:${context.repository}:${context.branch}:${context.environment}`);
  function selectStory(index: number) { setStoryIndex(index); setDecision(null); setStepIndex(0); }
  function choose(index: number) { setDecision(null); setStepIndex(Math.max(0, Math.min(story.steps.length - 1, index))); }
  function changeContext(key: keyof StoryContext, value: string) { setContext(current => ({ ...current, [key]: value })); setDecision(null); setStepIndex(0); }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowRight") { event.preventDefault(); choose(stepIndex + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); choose(stepIndex - 1); }
    if (event.key === "Home") { event.preventDefault(); choose(0); }
    if (event.key === "End") { event.preventDefault(); choose(story.steps.length - 1); }
  }
  return <section id="product-tour" aria-label="Axiom interactive workflow stories" className={variant === "hero" ? "mt-10 min-w-0 text-left" : "mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-10 lg:py-20"}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-[10px] font-medium text-zinc-400"><span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> Interactive simulation · scripted walkthrough</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a workflow story">{WORKFLOW_STORIES.map((item, index) => <button key={item.id} type="button" aria-pressed={index === storyIndex} onClick={() => selectStory(index)} className={`${storyButton} ${index === storyIndex ? "border-white/25 bg-white/6 text-zinc-100" : ""}`}>{item.label}</button>)}</div>
    </div>
    <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-300">{story.eyebrow}</p>
        <h2 className="mt-3 text-2xl font-medium leading-tight tracking-[-0.035em] text-zinc-100 sm:text-3xl">{step.title}</h2>
        <p className="mt-4 text-sm leading-6 text-zinc-400">{step.caption}</p>
        <div className="mt-5 grid gap-1" role="group" aria-label="Story steps" onKeyDown={keyboard}>{story.steps.map((item, index) => <button key={item.title} type="button" aria-current={index === stepIndex ? "step" : undefined} aria-label={`Step ${index + 1}: ${item.title}`} onClick={() => choose(index)} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left text-xs leading-5 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-300 ${index === stepIndex ? "bg-white/6 text-zinc-100" : "text-zinc-400 hover:bg-white/3"}`}><span className={`font-mono text-[10px] ${index === stepIndex ? "text-zinc-300" : "text-zinc-500"}`}>0{index + 1}</span>{item.title}</button>)}</div>
        <p role="status" aria-label="Current story step" aria-live="polite" aria-atomic="true" className="mt-5 text-xs tabular-nums text-zinc-400"><span aria-hidden="true">{stepIndex + 1} / {story.steps.length}</span><span className="sr-only">Step {stepIndex + 1} of {story.steps.length}: {step.title}</span></p>
        <p className="mt-3 text-[11px] leading-5 text-zinc-400">Choose a step to inspect its sample state. Or follow the actions inside the app preview. Decisions here are samples only.</p>
      </div>
      <DesktopPreviewFrame view={story.id === "workspace" ? "repository-workspace" : story.id === "agent" ? "agent" : "deployment-requests"}>
        <div className="h-0.5 bg-white/5" aria-hidden="true"><div className="h-full bg-zinc-400" style={{ width: `${((stepIndex + 1) / story.steps.length) * 100}%` }} /></div>
        <div className="grid gap-3 border-b border-white/8 p-4 sm:grid-cols-3"><ContextSelect label="Repository" value={context.repository} values={["acme/customer-web", "acme/payments-api"]} onChange={value => changeContext("repository", value)} /><ContextSelect label="Branch" value={context.branch} values={["feature/timeout", "review/retry-policy"]} onChange={value => changeContext("branch", value)} /><ContextSelect label="Environment" value={context.environment} values={["Development", "Test", "Production · held"]} onChange={value => changeContext("environment", value)} /></div>
        <div ref={sceneRef} tabIndex={-1} aria-label="Sample workflow response" className="p-4 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-zinc-300 sm:p-5"><WorkflowStoryScene scene={step.scene} context={context} fraction={reveal.fraction} reducedMotion={reveal.reducedMotion} active={reveal.active} decision={decision} onContinue={stepIndex < story.steps.length - 1 ? () => { focusResponse.current = true; choose(stepIndex + 1); } : undefined} onDecision={value => { setStepIndex(stepIndex); setDecision(value); }} /></div>
        <div className="border-t border-white/10 bg-white/2 px-4 py-3"><p className="text-[11px] leading-5 text-zinc-400">Illustrated from Axiom workflows. Sample content; no live actions.</p></div>
      </DesktopPreviewFrame>
    </div>
    <div className="mt-5 rounded-lg border border-white/8 bg-white/2 p-4"><p className="text-[10px] font-medium uppercase tracking-widest text-zinc-300">Current availability</p><p className="mt-2 text-xs leading-6 text-zinc-400">{story.limitation}</p><Link href="/docs/approval-workflow" onNavigate={() => window.dispatchEvent(new Event("axiom:documentation-navigation-intent"))} className="mt-2 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-zinc-300 underline-offset-4 hover:underline">Read approval workflow <ChevronRightIcon className="h-3 w-3" /></Link></div>
    <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-5 text-xs leading-6 text-zinc-400 sm:flex-row sm:items-center sm:justify-between"><p>Scripted sample data. No cloud account, repository, AI credits, or deployment is touched.</p><Link href="/demo" className="inline-flex min-h-11 shrink-0 items-center gap-2 font-medium text-zinc-300">Explore every safe demo <ChevronRightIcon className="h-4 w-4" /></Link></div>
  </section>;
}
function ContextSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="min-w-0"><span className="mb-2 block text-[9px] uppercase tracking-widest text-zinc-400">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#171615] px-2 text-xs text-zinc-200 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-300">{values.map(item => <option key={item}>{item}</option>)}</select></label>;
}
