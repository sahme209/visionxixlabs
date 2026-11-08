"use client";

import { useEffect, useId, useState } from "react";
import { CONTROL_PLANE_DEFAULT_LAYER, CONTROL_PLANE_LAYERS, layerNumber } from "@/lib/marketing/controlPlaneModel";
import type { ControlPlaneSceneHandle } from "./controlPlaneScene/createControlPlaneScene";
import { useLazyScene } from "./visualKit/useLazyScene";

/** Product page control-plane model (visual language v4, calm). Illustrative; never a live system. */
export function ControlPlaneModel() {
  const id = useId();
  const [selected, setSelected] = useState(CONTROL_PLANE_DEFAULT_LAYER);
  const [exploded, setExploded] = useState(true);
  const [playing, setPlaying] = useState(true);
  const { mode, reducedMotion, frameRef, canvasRef, sceneRef } = useLazyScene<ControlPlaneSceneHandle>(async (canvas, env) => {
    const { createControlPlaneScene } = await import("./controlPlaneScene/createControlPlaneScene");
    return createControlPlaneScene(canvas, { ...env, onSelect: (i) => setSelected(i) });
  });

  useEffect(() => { sceneRef.current?.select(selected); }, [selected, mode]);
  useEffect(() => { sceneRef.current?.setExploded(exploded); }, [exploded, mode]);
  useEffect(() => { sceneRef.current?.setPlaying(playing); }, [playing, mode]);

  const layer = CONTROL_PLANE_LAYERS[selected];
  const pill = (on: boolean) => `rounded-full px-3.5 py-1.5 text-sm transition-colors ${on ? "bg-white/90 text-zinc-950" : "text-zinc-300 hover:text-white"}`;

  return (
    <section aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8 lg:px-10" style={{ scrollMarginTop: 96 }}>
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs tracking-[0.12em] text-sky-200/70">Illustrative model · architecture, not a live system</p>
        <h2 id={`${id}-title`} className="mt-4 text-3xl font-normal tracking-[-0.02em] text-zinc-100 sm:text-5xl">Inside the Axiom control plane</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
          Five layers, one request path. Each layer has one job, one guarantee and a defined way to fail safely. Choose a layer to read what it does.
        </p>
      </div>

      <div ref={frameRef} className="relative mt-12 h-[520px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#03050a] sm:h-[580px]">
        <canvas ref={canvasRef} aria-hidden="true" className={`h-full w-full ${mode === "3d" ? "block cursor-grab" : "hidden"}`} />

        {mode === "3d" && (
          <div className="absolute right-3 top-3 flex gap-1">
            <div role="group" aria-label="View" className="flex gap-1 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur">
              <button type="button" aria-pressed={exploded} onClick={() => setExploded(true)} className={pill(exploded)}>Exploded</button>
              <button type="button" aria-pressed={!exploded} onClick={() => setExploded(false)} className={pill(!exploded)}>Assembled</button>
            </div>
            {!reducedMotion && (
              <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause model" : "Play model"}
                className="rounded-full border border-white/10 bg-black/50 px-3.5 py-1.5 text-sm text-zinc-200 backdrop-blur hover:text-white">{playing ? "Pause" : "Play"}</button>
            )}
          </div>
        )}

        {mode !== "3d" && (
          <ol aria-label="Control-plane layers" className="flex h-full flex-col justify-center gap-2 px-4 py-6 sm:px-16">
            {CONTROL_PLANE_LAYERS.map((l, i) => (
              <li key={l.id} className={`rounded-xl border px-5 py-3 ${i === selected ? "border-white/40 bg-white/[0.05]" : "border-sky-200/15 bg-white/[0.02]"}`}>
                <p className="text-base text-zinc-100"><span className="font-mono text-sm text-zinc-500">{layerNumber(i)}</span> {l.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{l.parts.map((p) => p.title).join(" · ")}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div role="group" aria-label="Choose a layer" className="mt-3 grid grid-cols-1 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1 sm:grid-cols-5">
        {CONTROL_PLANE_LAYERS.map((l, i) => (
          <button key={l.id} type="button" aria-pressed={i === selected} aria-controls={`${id}-inspector`} onClick={() => setSelected(i)}
            className={`rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${i === selected ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"}`}>
            <span className="font-mono text-zinc-500">{layerNumber(i)}</span> {l.title}
          </button>
        ))}
      </div>

      <section id={`${id}-inspector`} aria-label={layer.title} aria-live="polite" className="mt-3 rounded-xl border border-white/[0.08] bg-[#07090d] px-6 py-5">
        <h3 className="text-lg font-normal text-zinc-100"><span className="font-mono text-base text-zinc-500">{layerNumber(selected)}</span> {layer.title}</h3>
        <p className="mt-1 text-base leading-7 text-zinc-300">{layer.summary}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {layer.parts.map((p) => (
            <li key={p.title} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <h4 className="text-sm text-zinc-100">{p.title}</h4>
              <p className="mt-1 text-sm leading-6 text-zinc-400">{p.detail}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-5 grid gap-4 text-sm leading-6 sm:grid-cols-2">
          <div><dt className="text-xs tracking-[0.08em] text-zinc-500">Guarantee</dt><dd className="mt-1 text-zinc-300">{layer.guarantee}</dd></div>
          <div><dt className="text-xs tracking-[0.08em] text-zinc-500">If something fails</dt><dd className="mt-1 text-zinc-300">{layer.onFailure}</dd></div>
        </dl>
      </section>
    </section>
  );
}
