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
 * Shared calm v4 pipe-flow explanation, balanced to fit one screen.
 * Left: the pipe, with each stage as a compact row and a labelled packet moving between them.
 * Right: the chosen stage in full (its three parts, guarantee, failure behaviour, what it passes on).
 * Plain HTML and CSS: sharp text, keyboard and screen-reader friendly, no GPU.
 */
export function PipeFlow({ stages, label, defaultStage = 0 }: { stages: readonly PipeFlowStage[]; label: string; defaultStage?: number }) {
  const id = useId();
  const [selected, setSelected] = useState(defaultStage);
  const [paused, setPaused] = useState(false);
  const stage = stages[selected];

  return (
    <div className={`${styles.flow} grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-stretch`}>
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-mono text-xs tracking-[0.08em] text-zinc-500">Choose a stage</p>
          <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:text-white">{paused ? "Play" : "Pause"} flow</button>
        </div>
        <ol aria-label={label} className={paused ? styles.paused : undefined}>
          {stages.map((s, i) => {
            const on = i === selected;
            return (
              <li key={s.id} className={styles[s.tone]}>
                <button type="button" aria-pressed={on} aria-controls={`${id}-detail`} onClick={() => setSelected(i)}
                  className={`block w-full rounded-lg border border-white/[0.07] bg-white/1.5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-sky-300 ${styles.stage} ${on ? styles.stageSelected : ""}`}>
                  <span className="block text-[15px] text-zinc-100"><span className={`mr-2 font-mono text-xs ${styles.number}`}>{num(i)}</span>{s.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-zinc-500">{s.parts.map((p) => p.title).join(" · ")}</span>
                </button>
                {s.passesOn && (
                  <div className={styles.link}>
                    <span aria-hidden="true" className={styles.vtube} />
                    <span aria-hidden="true" className={styles.packet} style={{ animationDelay: `${-i * 0.6}s` }} />
                    <p className="absolute left-[40px] top-1/2 -translate-y-1/2 truncate pr-2 text-xs">
                      <span className="sr-only">Passes on: </span>
                      <span className="font-mono text-zinc-400">{s.passesOn.label}</span>
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <section id={`${id}-detail`} aria-label={stage.title} aria-live="polite" className={`flex flex-col justify-between gap-4 rounded-xl border border-white/8 bg-[#07090d] p-5 ${styles[stage.tone]}`}>
        <div>
        <h3 className="text-lg text-zinc-100"><span className={`mr-2 font-mono text-sm ${styles.number}`}>{num(selected)}</span>{stage.title}</h3>
        <p className="mt-1 text-[15px] leading-7 text-zinc-300">{stage.summary}</p>
        </div>
        <div className="relative grid gap-2 sm:grid-cols-3 sm:gap-4">
          <span aria-hidden="true" className={`hidden sm:block ${styles.tube} ${paused ? styles.paused : ""}`}>
            {[0, 1, 2].map((k) => <span key={k} className={styles.bit} style={{ animationDelay: `${-k * 1.2}s` }} />)}
          </span>
          {stage.parts.map((p) => (
            <div key={p.title} className="relative z-1 rounded-lg border border-white/8 bg-[#0b0e13] px-3 py-2.5">
              <p className="text-sm text-zinc-100">{p.title}</p>
              <p className="mt-1 text-[13px] leading-5 text-zinc-400">{p.detail}</p>
            </div>
          ))}
        </div>
        <dl className="grid gap-4 border-t border-white/6 pt-4 text-sm leading-6 sm:grid-cols-3">
          <div><dt className="text-xs text-zinc-500">Guarantee</dt><dd className="mt-1 text-zinc-200">{stage.guarantee}</dd></div>
          <div><dt className="text-xs text-zinc-500">If something fails</dt><dd className="mt-1 text-zinc-200">{stage.onFailure}</dd></div>
          <div><dt className="text-xs text-zinc-500">Passes on</dt><dd className="mt-1 text-zinc-200">{stage.passesOn ? <><span className="font-mono">{stage.passesOn.label}</span> — {stage.passesOn.detail}</> : "A recorded outcome: the end of this request."}</dd></div>
        </dl>
      </section>
    </div>
  );
}
