"use client";

import { useId, useState } from "react";
import styles from "./pipeFlow.module.css";

export type PipeFlowTone = "sky" | "teal" | "violet" | "amber" | "emerald";
export type PipeFlowStage = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly parts: readonly { readonly title: string; readonly detail: string }[];
  readonly guarantee: string;
  readonly onFailure: string;
  readonly passesOn: { readonly label: string; readonly detail: string } | null;
  readonly tone: PipeFlowTone;
};

const num = (i: number) => String(i + 1).padStart(2, "0");

/**
 * Shared calm v4 pipe-flow explanation: stages stacked top to bottom, data bits flowing
 * through each stage's steps, and a labelled packet travelling down the pipe to the next stage.
 * Plain HTML and CSS: sharp text at page size, keyboard and screen-reader friendly, no GPU.
 */
export function PipeFlow({ stages, label, defaultStage = 0 }: { stages: readonly PipeFlowStage[]; label: string; defaultStage?: number }) {
  const id = useId();
  const [selected, setSelected] = useState(defaultStage);
  const [paused, setPaused] = useState(false);
  const stage = stages[selected];

  return (
    <div className={styles.flow}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-xs tracking-[0.08em] text-zinc-500">Data flows top to bottom · choose a stage to read it</p>
        <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused}
          className="rounded-full border border-white/10 px-3.5 py-1.5 text-sm text-zinc-300 hover:text-white">{paused ? "Play" : "Pause"} flow</button>
      </div>

      <ol aria-label={label} className={paused ? styles.paused : undefined}>
        {stages.map((s, i) => {
          const tone = styles[s.tone];
          const on = i === selected;
          return (
            <li key={s.id} className={tone}>
              <button type="button" aria-pressed={on} aria-controls={`${id}-detail`} onClick={() => setSelected(i)}
                className={`block w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${styles.stage} ${on ? styles.stageSelected : ""}`}>
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-lg text-zinc-100"><span className={`mr-2 font-mono text-sm ${styles.number}`}>{num(i)}</span>{s.title}</span>
                  <span className="text-[15px] text-zinc-400">{s.summary}</span>
                </span>
                <span className="relative mt-4 grid gap-2 sm:grid-cols-3 sm:gap-7">
                  <span aria-hidden="true" className={`hidden sm:block ${styles.tube}`}>
                    {[0, 1, 2].map((k) => <span key={k} className={styles.bit} style={{ animationDelay: `${-(k * 1.2 + i * 0.4)}s` }} />)}
                  </span>
                  {s.parts.map((p) => (
                    <span key={p.title} className="relative z-[1] block rounded-lg border border-white/[0.08] bg-[#0b0e13] px-3.5 py-3">
                      <span className="block text-[15px] text-zinc-100">{p.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-zinc-400">{p.detail}</span>
                    </span>
                  ))}
                </span>
              </button>
              {s.passesOn && (
                <div className={styles.link}>
                  <span aria-hidden="true" className={styles.vtube} />
                  <span aria-hidden="true" className={styles.packet} style={{ animationDelay: `${-i * 0.6}s` }} />
                  <p className="absolute left-[56px] top-1/2 -translate-y-1/2 pr-4 text-sm leading-6">
                    <span className="sr-only">Passes on: </span>
                    <span className="font-mono text-zinc-200">{s.passesOn.label}</span>
                    <span className="text-zinc-500"> — {s.passesOn.detail}</span>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <section id={`${id}-detail`} aria-label={stage.title} aria-live="polite" className={`mt-4 rounded-xl border border-white/[0.08] bg-[#07090d] px-6 py-5 ${styles[stage.tone]}`}>
        <h3 className="text-lg text-zinc-100"><span className={`mr-2 font-mono text-base ${styles.number}`}>{num(selected)}</span>{stage.title}</h3>
        <p className="mt-1 text-base leading-7 text-zinc-300">{stage.summary}</p>
        <dl className="mt-4 grid gap-5 text-[15px] leading-7 sm:grid-cols-3">
          <div><dt className="text-sm text-zinc-500">Guarantee</dt><dd className="mt-1 text-zinc-200">{stage.guarantee}</dd></div>
          <div><dt className="text-sm text-zinc-500">If something fails</dt><dd className="mt-1 text-zinc-200">{stage.onFailure}</dd></div>
          <div><dt className="text-sm text-zinc-500">Passes on</dt><dd className="mt-1 text-zinc-200">{stage.passesOn ? <><span className="font-mono">{stage.passesOn.label}</span> — {stage.passesOn.detail}</> : "A recorded outcome: the end of this request."}</dd></div>
        </dl>
      </section>
    </div>
  );
}
