"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  FLOW_SCENARIOS,
  FLOW_STATIONS,
  flowAuditLog,
  flowGauges,
  flowScenario,
  flowStationState,
  type FlowScenarioId,
  type FlowStationState,
} from "@/lib/marketing/governedFlowModel";
import type { GovernedSceneHandle } from "./governedScene/createGovernedScene";

const STATE_TEXT: Record<FlowStationState, string> = {
  passed: "Passed", current: "In progress", pending: "Waiting", blocked: "Blocked", warning: "Needs attention", unreached: "Not reached",
};
const STATE_CLASS: Record<FlowStationState, string> = {
  passed: "border-emerald-300/50 text-emerald-200", current: "border-white text-white", pending: "border-sky-300/40 text-sky-200",
  blocked: "border-rose-400/60 text-rose-200", warning: "border-amber-300/60 text-amber-200", unreached: "border-zinc-700 text-zinc-500",
};
const LOG_CLASS = { ok: "text-emerald-200", blocked: "text-rose-200", warning: "text-amber-200" } as const;

function supportsWebGL(): boolean {
  if (typeof window === "undefined" || typeof WebGLRenderingContext === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    // failIfMajorPerformanceCaveat refuses software rendering (no GPU), where the scene would
    // saturate the main thread; those visitors get the 2D stage rail instead.
    const opts: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true };
    const gl = probe.getContext("webgl2", opts) ?? probe.getContext("webgl", opts);
    if (!gl) return false;
    // Some software GPUs (e.g. SwiftShader in headless Chrome) do not raise the caveat; refuse them by name too.
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Homepage governed-deployment model (visual language v4). Illustrative; never a live deployment. */
export function GovernedDeploymentModel() {
  const id = useId();
  const [scenarioId, setScenarioId] = useState<FlowScenarioId>("approved");
  const scenario = flowScenario(scenarioId);
  const [reached, setReached] = useState(scenario.stop);
  const [selected, setSelected] = useState(3);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<"pending" | "3d" | "2d">("pending");
  const [reducedMotion, setReducedMotion] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GovernedSceneHandle | null>(null);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    if (!supportsWebGL() || typeof IntersectionObserver === "undefined") { setMode("2d"); return; }
    let cancelled = false;
    const frame = frameRef.current;
    if (!frame) return;
    const load = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      load.disconnect();
      import("./governedScene/createGovernedScene")
        .then(({ createGovernedScene }) => {
          if (cancelled || !canvasRef.current) return;
          sceneRef.current = createGovernedScene(canvasRef.current, {
            reducedMotion: prefersReducedMotion(),
            onReached: (k) => setReached(k),
            onSelect: (i) => setSelected(i),
            onTooSlow: () => { sceneRef.current?.dispose(); sceneRef.current = null; setMode("2d"); },
          });
          setMode("3d");
        })
        .catch(() => { if (!cancelled) setMode("2d"); });
    }, { rootMargin: "300px" });
    load.observe(frame);
    const visibility = new IntersectionObserver((entries) => sceneRef.current?.setVisible(entries.some((e) => e.isIntersecting)));
    visibility.observe(frame);
    return () => {
      cancelled = true; load.disconnect(); visibility.disconnect();
      sceneRef.current?.dispose(); sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.setScenario(scenario);
    else setReached(scenario.stop);
  }, [scenario, mode]);
  useEffect(() => { sceneRef.current?.setPlaying(playing); }, [playing, mode]);
  useEffect(() => { sceneRef.current?.select(selected); }, [selected, mode]);

  const shown = Math.max(0, reached);
  const gauges = flowGauges(scenario, shown);
  const log = flowAuditLog(scenario, shown);
  const station = FLOW_STATIONS[selected];
  const canAnimate = mode === "3d" && !reducedMotion;

  return (
    <section aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80">Illustrative model · not a live deployment</p>
      <h2 id={`${id}-title`} className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">How a governed deployment moves through Axiom</h2>
      <p className="mt-3 max-w-3xl text-zinc-300">
        Follow one release from request to recorded outcome, including what happens when a check fails, a reviewer says no or the result is unknown.
        Axiom governs the decision; your source and your cloud stay yours.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Scenario">
        {FLOW_SCENARIOS.map((s) => (
          <button key={s.id} type="button" aria-pressed={s.id === scenarioId} onClick={() => setScenarioId(s.id)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${s.id === scenarioId ? "border-sky-300/70 bg-sky-400/10 text-sky-100" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`}>
            {s.label}
          </button>
        ))}
        {canAnimate && (
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause model" : "Play model"}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500">{playing ? "Pause" : "Play"}</button>
        )}
        {mode === "3d" && (
          <button type="button" onClick={() => sceneRef.current?.overview()} className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500">Overview</button>
        )}
      </div>

      <div ref={frameRef} className="relative mt-4 h-[420px] overflow-hidden rounded-xl border border-zinc-800 bg-[#03050a] sm:h-[460px]">
        <canvas ref={canvasRef} aria-hidden="true" className={`h-full w-full ${mode === "3d" ? "block cursor-grab" : "hidden"}`} />
        {mode !== "3d" && (
          <ol aria-label="Stages in this scenario" className="grid h-full grid-cols-2 content-center gap-2 p-4 sm:grid-cols-4">
            {FLOW_STATIONS.map((s, i) => {
              const state = flowStationState(scenario, i, shown);
              return (
                <li key={s.id} className={`rounded-lg border px-3 py-2 text-sm ${STATE_CLASS[state]}`}>
                  <span className="font-mono text-xs opacity-70">{String(i + 1).padStart(2, "0")}</span> {s.name}
                  <span className="block text-xs opacity-80">{STATE_TEXT[state]}</span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="pointer-events-none absolute inset-x-4 bottom-3 text-sm text-zinc-200">{scenario.caption}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-live="polite">
        {([["Stage", gauges.stage], ["AI tokens", gauges.tokens.toLocaleString("en-US")],
          [gauges.aiCreditState === "held" ? "AI credit held" : "AI credit settled", `$${gauges.aiCreditUsd.toFixed(2)}`],
          ["Approval", gauges.approval], ["Rollout / health", gauges.outcome]] as const).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-zinc-900/70 px-3 py-2">
            <dt className="text-xs text-zinc-400">{k}</dt>
            <dd className="text-sm font-medium text-white">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Inspect a stage">
        {FLOW_STATIONS.map((s, i) => (
          <button key={s.id} type="button" aria-pressed={i === selected} aria-controls={`${id}-inspector`} onClick={() => setSelected(i)}
            className={`rounded-md border px-3 py-1.5 text-left text-sm ${i === selected ? "border-sky-300/70 text-sky-100" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"}`}>
            <span className="font-mono text-xs text-zinc-500">{String(i + 1).padStart(2, "0")}</span> {s.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <section id={`${id}-inspector`} aria-label={station.name} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 text-sm leading-relaxed text-zinc-300">
          <h3 className="text-base font-semibold text-white">{String(selected + 1).padStart(2, "0")} · {station.name}</h3>
          <p className="mt-1">{station.summary}</p>
          <h4 className="mt-3 text-xs uppercase tracking-wider text-zinc-500">What happens inside</h4>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">{station.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          <h4 className="mt-3 text-xs uppercase tracking-wider text-zinc-500">Data in → out</h4>
          <p className="mt-1 font-mono text-xs">{station.dataIn.join(", ")} → {station.dataOut.join(", ")}</p>
          <h4 className="mt-3 text-xs uppercase tracking-wider text-zinc-500">Systems</h4>
          <p className="mt-1">{station.systems}</p>
          <h4 className="mt-3 text-xs uppercase tracking-wider text-zinc-500">Guarantee</h4>
          <p className="mt-1">{station.guarantee}</p>
          <h4 className="mt-3 text-xs uppercase tracking-wider text-zinc-500">If it fails</h4>
          <p className="mt-1">{station.onFailure}</p>
        </section>
        <section aria-label="Audit stream" className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
          <h3 className="text-base font-semibold text-white">Audit stream</h3>
          <p className="text-xs text-zinc-500">Sample entries; illustrative identifiers.</p>
          <ol role="log" aria-live="polite" className="mt-2 space-y-1 font-mono text-xs">
            {log.map((e) => (
              <li key={`${e.at}-${e.event}`} className={LOG_CLASS[e.level]}>{e.at} {e.event} <span className="text-zinc-400">{e.detail}</span></li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
