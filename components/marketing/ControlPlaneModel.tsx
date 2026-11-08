"use client";

import { useId } from "react";
import { CONTROL_PLANE_DEFAULT_LAYER, CONTROL_PLANE_LAYERS } from "@/lib/marketing/controlPlaneModel";
import { PipeFlow } from "./pipeKit/PipeFlow";

/** Product page control-plane explanation (calm v4 pipe flow). Illustrative; never a live system. */
export function ControlPlaneModel() {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8 lg:px-10" style={{ scrollMarginTop: 96 }}>
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs tracking-[0.12em] text-sky-200/70">Illustrative model · architecture, not a live system</p>
        <h2 id={`${id}-title`} className="mt-4 text-3xl font-normal tracking-[-0.02em] text-zinc-100 sm:text-5xl">Inside the Axiom control plane</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
          Every request flows through five stages. Each stage checks one thing, guarantees one thing and passes something specific to the next. If any check fails, the request stops there, safely and on record.
        </p>
      </div>
      <div className="mt-12">
        <PipeFlow stages={CONTROL_PLANE_LAYERS} label="Control-plane layers" defaultStage={CONTROL_PLANE_DEFAULT_LAYER} />
      </div>
    </section>
  );
}
