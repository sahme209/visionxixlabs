"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { DesktopPreviewFrame } from "./DesktopPreviewFrame";
import {usePreviewSequence} from "./usePreviewSequence";
import { WORKFLOW_STORIES } from "./workflowStories";
import { WorkflowStoryScene, storyButton, type SampleDecision, type StoryContext } from "./WorkflowStoryScene";

const storyPreviewDescriptions = {
  workspace: "Edit a file and review a project check.",
  agent: "Inspect a proposal and make a sample decision.",
  cloud: "See why a release stays on hold.",
} as const;

export function CinematicAxiomDemo({
  variant = "section",
  showDemoLink = true,
  showStoryPreviews = false,
}: { variant?: "section" | "hero"; showDemoLink?: boolean; showStoryPreviews?: boolean } = {}) {
  const [storyIndex, setStoryIndex] = useState(0);
  const [context, setContext] = useState<StoryContext>({ repository: "acme/customer-web", branch: "feature/timeout", environment: "Development" });
  const [decision, setDecision] = useState<SampleDecision>(null);
  const story = WORKFLOW_STORIES[storyIndex];
  const guide = showStoryPreviews ? story.guide : { href: "/docs/approval-workflow", label: "Read approval workflow" };
  const [stepIndex, setStepIndex] = useState(0);
  const step = story.steps[stepIndex] ?? story.steps[0];
  const stepsRef = useRef<HTMLDivElement>(null);
  const sceneRef=useRef<HTMLDivElement>(null);
  const stageHeadingRef=useRef<HTMLHeadingElement>(null);
  const focusResponse = useRef(false);
  const viewResponse = useCallback((block: ScrollLogicalPosition = "nearest") => {
    sceneRef.current?.focus({ preventScroll: true });
    const target = block === "nearest" && window.innerWidth >= 1024 ? stageHeadingRef.current : sceneRef.current;
    target?.scrollIntoView?.({ block, inline: "nearest" });
  }, []);
  function returnToStep() {
    const control = stepsRef.current?.querySelector<HTMLButtonElement>('button[aria-current="step"]');
    control?.focus({ preventScroll: true });
    control?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
  useEffect(() => {
    if (focusResponse.current) {
      focusResponse.current = false;
      viewResponse();
    }
  }, [stepIndex, viewResponse]);
  const reveal=usePreviewSequence(sceneRef,`${storyIndex}:${stepIndex}:${context.repository}:${context.branch}:${context.environment}`);
  function selectStory(index: number) {
    setStoryIndex(index);
    setDecision(null);
    setStepIndex(0);
  }
  function choose(index: number) {
    if (index === stepIndex) return;
    setDecision(null);
    setStepIndex(index);
  }
  function changeContext(key: keyof StoryContext, value: string) { setContext(current => ({ ...current, [key]: value })); setDecision(null); setStepIndex(0); }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const focused = event.target instanceof HTMLElement ? event.target.closest("button") : null;
    const current = focused ? buttons.indexOf(focused) : stepIndex;
    let destination: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        destination = Math.min(story.steps.length - 1, current + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        destination = Math.max(0, current - 1);
        break;
      case "Home":
        destination = 0;
        break;
      case "End":
        destination = story.steps.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    choose(destination);
    buttons[destination]?.focus();
  }
  return <section id="product-tour" tabIndex={-1} aria-label="V19 interactive workflow stories" className={variant === "hero" ? "mt-10 min-w-0 text-left" : "mx-auto max-w-[1280px] scroll-mt-16 px-5 py-16 sm:px-8 lg:px-10 lg:py-20"}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-[10px] font-medium text-zinc-400"><span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> Interactive simulation · scripted walkthrough</span>
      <div
        className={showStoryPreviews ? "grid w-full gap-3 sm:grid-cols-3" : "flex flex-wrap gap-2"}
        role="group"
        aria-label="Choose a workflow story"
      >
        {WORKFLOW_STORIES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={index === storyIndex}
            onClick={() => selectStory(index)}
            className={`${showStoryPreviews
              ? "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 rounded-lg border border-white/15 p-2 text-left text-xs text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 sm:grid-cols-1 sm:content-start"
              : storyButton} ${index === storyIndex ? "border-white/40 bg-white/8 text-zinc-100" : ""}`}
          >
            {showStoryPreviews && (
              <Image
                src={`/media/workflow-stories/${item.id}.webp`}
                alt=""
                width={640}
                height={320}
                unoptimized
                className="h-auto w-full rounded-md border border-white/10"
              />
            )}
            <span>
              <span className={showStoryPreviews ? "block text-sm font-medium" : undefined}>{item.label}</span>
              {showStoryPreviews && <span className="mt-1 block font-normal leading-5 text-zinc-400">{storyPreviewDescriptions[item.id]}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
    <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-300">{story.eyebrow}</p>
        <h2 ref={stageHeadingRef} className="scroll-mt-24 mt-3 text-2xl font-medium leading-tight tracking-[-0.035em] text-zinc-100 sm:text-3xl">{step.title}</h2>
        <p className="mt-4 text-sm leading-6 text-zinc-400">{step.caption}</p>
        <div ref={stepsRef} className="mt-5 grid gap-1" role="group" aria-label="Story steps" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End" onKeyDown={keyboard}>{story.steps.map((item, index) => <button key={item.title} type="button" aria-current={index === stepIndex ? "step" : undefined} aria-label={`Step ${index + 1}: ${item.title}`} onClick={() => choose(index)} className={`flex min-h-11 scroll-mt-24 items-center gap-3 rounded-lg px-3 py-2 text-left text-xs leading-5 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-300 ${index === stepIndex ? "bg-white/6 text-zinc-100" : "text-zinc-400 hover:bg-white/3"}`}><span className={`font-mono text-[10px] ${index === stepIndex ? "text-zinc-300" : "text-zinc-400"}`}>0{index + 1}</span>{item.title}</button>)}</div>
        <p role="status" aria-label="Current story step" aria-live="polite" aria-atomic="true" className="mt-5 text-xs tabular-nums text-zinc-400"><span aria-hidden="true">{stepIndex + 1} / {story.steps.length}</span><span className="sr-only">Step {stepIndex + 1} of {story.steps.length}: {step.title}</span></p>
        <p className="mt-3 text-[11px] leading-5 text-zinc-400">Choose a step to inspect its sample state. Or follow the actions inside the app preview. Decisions here are samples only.</p>
        {showStoryPreviews && <button type="button" className={`${storyButton} mt-3`} onClick={() => viewResponse("start")}>View sample response</button>}
      </div>
      <DesktopPreviewFrame view={story.id === "workspace" ? "repository-workspace" : story.id === "agent" ? "agent" : "deployment-requests"}>
        <div className="h-0.5 bg-white/5" aria-hidden="true"><div className="h-full bg-zinc-400" style={{ width: `${((stepIndex + 1) / story.steps.length) * 100}%` }} /></div>
        <div className="grid gap-3 border-b border-white/8 p-4 sm:grid-cols-3"><ContextSelect label="Repository" value={context.repository} values={["acme/customer-web", "acme/payments-api"]} onChange={value => changeContext("repository", value)} /><ContextSelect label="Branch" value={context.branch} values={["feature/timeout", "review/retry-policy"]} onChange={value => changeContext("branch", value)} /><ContextSelect label="Environment" value={context.environment} values={["Development", "Test", "Production · held"]} onChange={value => changeContext("environment", value)} /></div>
        <div ref={sceneRef} tabIndex={-1} role="region" aria-label="Sample workflow response" className="scroll-mt-24 p-4 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-zinc-300 sm:p-5"><WorkflowStoryScene scene={step.scene} context={context} fraction={reveal.fraction} reducedMotion={reveal.reducedMotion} active={reveal.active} decision={decision} onContinue={stepIndex < story.steps.length - 1 ? () => { focusResponse.current = true; choose(stepIndex + 1); } : undefined} onDecision={value => { setStepIndex(stepIndex); setDecision(value); }} /></div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-white/10 bg-white/2 px-4 py-3">
          <p className="text-[11px] leading-5 text-zinc-400">Illustrated from V19 workflows. Sample content; no live actions.</p>
          {showStoryPreviews && <button type="button" className={storyButton} onClick={returnToStep}>Back to selected step</button>}
        </div>
      </DesktopPreviewFrame>
    </div>
    <div className="mt-5 rounded-lg border border-white/8 bg-white/2 p-4"><p className="text-[10px] font-medium uppercase tracking-widest text-zinc-300">Current availability</p><p className="mt-2 text-xs leading-6 text-zinc-400">{story.limitation}</p><Link href={guide.href} onNavigate={() => window.dispatchEvent(new Event("axiom:documentation-navigation-intent"))} className="mt-2 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-zinc-300 underline-offset-4 hover:underline">{guide.label} <ChevronRightIcon className="h-3 w-3" /></Link></div>
    <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-5 text-xs leading-6 text-zinc-400 sm:flex-row sm:items-center sm:justify-between"><p>Scripted sample data. No cloud account, repository, AI credits, or deployment is touched.</p>{showDemoLink && <Link href="/demo" className="inline-flex min-h-11 shrink-0 items-center gap-2 font-medium text-zinc-300">Explore every safe demo <ChevronRightIcon className="h-4 w-4" /></Link>}</div>
  </section>;
}
function ContextSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="min-w-0"><span className="mb-2 block text-[9px] uppercase tracking-widest text-zinc-400">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#171615] px-2 text-xs text-zinc-200 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-300">{values.map(item => <option key={item}>{item}</option>)}</select></label>;
}
