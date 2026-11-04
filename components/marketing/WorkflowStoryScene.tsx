"use client";

import { motion } from "framer-motion";
import { CodeBracketIcon, CommandLineIcon, ShieldCheckIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import type { StoryScene } from "./workflowStories";

export interface StoryContext { repository: string; branch: string; environment: string }
export type SampleDecision = "approved" | "rejected" | null;
interface Props {
  scene: StoryScene; context: StoryContext; fraction: number; reducedMotion: boolean; active: boolean;
  decision: SampleDecision; onDecision: (decision: Exclude<SampleDecision, null>) => void;
}
const code = ["export function retryPolicy(", "  timeoutMs = 8_000,", ") {", "  return {", "    maxAttempts: 3,", "    timeoutMs,", "  };", "}"].join("\n");
const terminal = ["$ npm run typecheck", "", "> tsc --noEmit", "", "[sample] Process exited with code 0", "[sample] No deployment was requested."].join("\n");
const panel = "rounded-xl border border-white/10 bg-[#141617] p-4 sm:p-5";
export const storyButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 disabled:opacity-40";
function Typed({ text, fraction }: { text: string; fraction: number }) {
  const shown = text.slice(0, Math.ceil(text.length * Math.min(1, fraction * 1.8)));
  return <><span className="sr-only">{text}</span><span aria-hidden="true">{shown}<span className={shown.length < text.length ? "text-orange-300" : "invisible"}>▍</span></span></>;
}
export function WorkflowStoryScene({ scene, context, fraction, reducedMotion, active, decision, onDecision }: Props) {
  const progress = reducedMotion ? 1 : fraction;
  return <div className="relative min-h-[320px] min-w-0 sm:min-h-[340px]">
    <motion.div key={scene} initial={false} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
      {scene === "context" && <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-zinc-400"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-400/10 text-orange-200">A</span> Axiom Agent <span className="ml-auto rounded border border-white/10 px-2 py-1">Engineer</span></div>
        <div className={`${panel} ml-5 border-white/10 bg-white/[0.025]`}><p className="text-sm leading-6 text-zinc-100"><Typed text="Make the request timeout configurable. Keep the retry ceiling unchanged, then prepare a review." fraction={progress} /></p></div>
        <div className={panel}><p className="text-[10px] uppercase tracking-widest text-orange-200">Attached sample context</p><dl className="mt-4 grid gap-3"><Fact label="Repository" value={context.repository} /><Fact label="Branch" value={context.branch} /><Fact label="Environment" value={context.environment} /></dl></div>
      </div>}
      {(scene === "editor" || scene === "proposal") && <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0c0e]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 text-xs text-zinc-300"><CodeBracketIcon className="h-4 w-4 text-orange-300" /> retry-policy.ts <span className="ml-auto text-[10px] text-orange-200">{scene === "proposal" ? "Proposed diff" : progress < 0.8 ? "Sample edit" : "Sample saved"}</span></div>
        <div className="flex min-h-[235px]"><div className="hidden w-28 shrink-0 border-r border-white/[0.06] p-3 text-[10px] text-zinc-400 sm:block"><p className="mb-3 uppercase tracking-widest">Files</p><p className="rounded bg-orange-300/10 px-1 py-2 text-orange-200">retry-policy.ts</p><p className="mt-3">runtime.ts</p><p className="mt-3">package.json</p></div><div className="min-w-0 flex-1 p-3 sm:p-4"><p className="mb-3 font-mono text-[11px] text-rose-300">− timeoutMs: 3_000</p><pre className="whitespace-pre-wrap break-words font-mono text-xs leading-7 text-emerald-200"><Typed text={code} fraction={progress} /></pre></div></div>
        <div className="border-t border-white/10 px-3 py-3 text-[11px] leading-5 text-zinc-400">1 file · retry ceiling preserved · {context.branch}</div>
      </div>}
      {(scene === "check" || scene === "github") && <div className={`${panel} border-white/15`}>
        <div className="flex items-center gap-2 text-orange-200"><ShieldCheckIcon className="h-5 w-5" /><p className="text-[10px] uppercase tracking-[0.15em]">Human review · sample only</p></div>
        <h3 className="mt-4 text-lg font-medium text-zinc-100">{scene === "check" ? "Run the project type check?" : "Publish branch and open a pull request?"}</h3>
        <dl className="mt-4 grid gap-3 text-xs"><Fact label="Target" value={`${context.repository} · ${context.branch}`} /><Fact label={scene === "check" ? "Command" : "Recovery"} value={scene === "check" ? "npm run typecheck" : "Review the change; revert the commit if needed"} /></dl>
        <p className="mt-4 text-xs leading-6 text-zinc-400">{scene === "check" ? "Repository scripts require approval. Environment variables are restricted; local files and stored credentials can still be read with your user permissions. The check has a 5-minute timeout and separate 1 MB limits for standard output and error output." : "The sample action is scoped to this working branch. No merge, deployment or cloud permission is included."}</p>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" className={storyButton} onClick={() => onDecision("rejected")}>Reject sample</button><button type="button" className={`${storyButton} border-orange-300/30 bg-orange-300 !text-[#251407] hover:bg-orange-200`} onClick={() => onDecision("approved")}>Simulate approval</button></div>
        {decision && <p role="status" className="mt-4 text-xs text-orange-200">{decision === "approved" ? "Sample decision recorded" : "Sample rejected · no action taken"}</p>}
      </div>}
      {scene === "output" && <div className="overflow-hidden rounded-xl border border-white/10 bg-[#090b0d]">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs text-zinc-300"><CommandLineIcon className="h-4 w-4 text-orange-300" /> Bounded check output <span className="ml-auto text-[9px] uppercase text-orange-200">Scripted</span></div>
        <pre className="min-h-[235px] whitespace-pre-wrap break-words p-4 font-mono text-xs leading-7 text-zinc-300"><Typed text={terminal} fraction={progress} /></pre>
        <p className="border-t border-white/10 p-3 text-[11px] leading-5 text-zinc-400">An approved project check, not a general-purpose terminal.</p>
      </div>}
      {scene === "terraform" && <div className={`${panel} space-y-4`}><p className="text-[10px] uppercase tracking-widest text-orange-200">Terraform · configuration preview</p><pre className="whitespace-pre-wrap break-words rounded-lg bg-black/30 p-4 font-mono text-xs leading-7 text-zinc-300"><Typed text={'# Illustrative configuration\nvariable "request_timeout_ms" {\n  type    = number\n  default = 8000\n}'} fraction={progress} /></pre><p className="text-xs leading-6 text-zinc-400">Draft for manual review. No plan was created and no cloud account was contacted.</p></div>}
      {(scene === "evidence" || scene === "hold" || scene === "receipt") && <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 text-orange-200"><ShieldCheckIcon className="h-5 w-5" /><span className="text-xs font-medium">{scene === "receipt" ? "Decision and outcome are separate" : "Saved Terraform plan evidence"}</span></div>
        {(scene === "receipt" ? ["A sample decision is not proof of execution", "GitHub write not performed", "AWS ECS health not observed", "Recovery evidence not verified"] : ["Configuration preview · illustrative", "Trusted customer plan producer unavailable", "Current target authority unavailable", "Terraform apply disabled"]).map((text, i) => <div key={text} className={`${panel} flex items-start gap-3`}><span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300" style={{ opacity: progress >= i * 0.15 ? 1 : 0.4 }} /><span className="text-xs leading-5 text-zinc-300">{text}</span></div>)}
        <p className="text-xs leading-6 text-zinc-400">Cloud end-to-end acceptance is unverified.</p>
      </div>}
    </motion.div>
    {!reducedMotion && fraction < 0.95 && <motion.div aria-hidden="true" className="pointer-events-none absolute hidden text-orange-200 sm:block" animate={{ left: `${18 + Math.min(1, fraction * 2) * 62}%`, top: `${20 + Math.min(1, fraction * 2) * 43}%` }} transition={{ duration: active ? 0.08 : 0, ease: "linear" }}><ArrowUpRightIcon className="h-6 w-6 rotate-[-35deg] fill-[#171815] drop-shadow-lg" /><span className="ml-4 rounded bg-orange-300 px-2 py-1 text-[9px] font-medium text-[#251407]">Demo cursor</span></motion.div>}
  </div>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</dt><dd className="mt-1 break-words text-xs leading-5 text-zinc-200">{value}</dd></div>; }
