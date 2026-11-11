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
import { forced3d, prefersReducedMotion, supportsWebGL } from "./webglSupport";

const STATE_TEXT: Record<FlowStationState, string> = {
  passed: "Passed", current: "In progress", pending: "Waiting", blocked: "Blocked", warning: "Needs attention", unreached: "Not reached",
};
const STATE_CLASS: Record<FlowStationState, string> = {
  passed: "border-emerald-300/50 text-emerald-200", current: "border-white text-white", pending: "border-sky-300/40 text-sky-200",
  blocked: "border-rose-400/60 text-rose-200", warning: "border-amber-300/60 text-amber-200", unreached: "border-zinc-700 text-zinc-500",
};
const LOG_CLASS = { ok: "text-emerald-200", blocked: "text-rose-200", warning: "text-amber-200" } as const;

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
    const force = forced3d();
    if ((!force && !supportsWebGL()) || typeof IntersectionObserver === "undefined") { setMode("2d"); return; }
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
            frameGuard: !force,
            onReached: (k) => setReached(k),
            onSelect: (i) => { flyOnSelect.current = true; setSelected(i); },
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
  // Fly the camera only after the visitor picks a stage; until then the scene keeps its overview.
  const flyOnSelect = useRef(false);
  const choose = (index: number) => { flyOnSelect.current = true; setSelected(index); };
  useEffect(() => { sceneRef.current?.select(selected, flyOnSelect.current); }, [selected, mode]);

  const shown = Math.max(0, reached);
  const gauges = flowGauges(scenario, shown);
  const log = flowAuditLog(scenario, shown);
  const station = FLOW_STATIONS[selected];
  const canAnimate = mode === "3d" && !reducedMotion;

  const stateDot: Record<FlowStationState, string> = {
    passed: "bg-emerald-300", current: "bg-white", pending: "bg-sky-300/70", blocked: "bg-rose-400", warning: "bg-amber-300", unreached: "bg-zinc-700",
  };

  return (
    <section aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 lg:px-10" style={{ scrollMarginTop: 96 }}>
      <div className="mx-auto max-w-4xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sky-300/80">Illustrative model · not a live deployment</p>
        <h2 id={`${id}-title`} className="mt-4 text-3xl font-medium tracking-[-0.04em] text-white sm:text-[44px] sm:leading-[1.1]">How a governed deployment moves through Axiom</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
          One release, from request to recorded outcome, including the paths where a check fails, a reviewer says no or the result is unknown.
        </p>
      </div>

      <div ref={frameRef} className="relative mt-12 h-[560px] overflow-hidden rounded-2xl border border-white/8 bg-[#03050a] shadow-[0_40px_120px_-40px_rgba(111,195,255,0.25)] sm:h-[620px]">
        <canvas ref={canvasRef} aria-hidden="true" className={`h-full w-full ${mode === "3d" ? "block cursor-grab" : "hidden"}`} />

        <div className="absolute inset-x-3 top-3 flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label="Scenario" className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-sm">
            {FLOW_SCENARIOS.map((s) => (
              <button key={s.id} type="button" aria-pressed={s.id === scenarioId} onClick={() => setScenarioId(s.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm ${s.id === scenarioId ? "bg-white text-zinc-950" : "text-zinc-300 hover:text-white"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {canAnimate && (
              <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause model" : "Play model"}
                className="rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm hover:text-white sm:text-sm">{playing ? "Pause" : "Play"}</button>
            )}
            {mode === "3d" && (
              <button type="button" onClick={() => sceneRef.current?.overview()} className="rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm hover:text-white sm:text-sm">Overview</button>
            )}
          </div>
        </div>

        {mode !== "3d" && (
          <ol aria-label="Stages in this scenario" className="grid h-full grid-cols-2 content-center gap-2 px-4 pb-32 pt-20 sm:grid-cols-4 sm:px-10">
            {FLOW_STATIONS.map((s, i) => {
              const state = flowStationState(scenario, i, shown);
              return (
                <li key={s.id} className={`rounded-xl border bg-white/2 px-4 py-3 text-sm ${STATE_CLASS[state]}`}>
                  <span className="font-mono text-xs opacity-70">{String(i + 1).padStart(2, "0")}</span> {s.name}
                  <span className="mt-0.5 block text-xs opacity-80">{STATE_TEXT[state]}</span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="absolute inset-x-3 bottom-3 space-y-2">
          <p className="pointer-events-none px-1 text-sm text-zinc-200">{scenario.caption}</p>
          <div role="group" aria-label="Inspect a stage" className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-black/55 p-1 backdrop-blur-sm lg:grid-cols-8">
            {FLOW_STATIONS.map((s, i) => {
              const state = flowStationState(scenario, i, shown);
              return (
                <button key={s.id} type="button" aria-pressed={i === selected} aria-controls={`${id}-inspector`} onClick={() => choose(i)}
                  className={`flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${i === selected ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`}>
                  <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${stateDot[state]}`} />
                  <span className="truncate"><span className="font-mono text-zinc-500">{String(i + 1).padStart(2, "0")}</span> {s.name}</span>
                  <span className="sr-only">, {STATE_TEXT[state]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-white/8 bg-white/2 font-mono sm:grid-cols-5 sm:divide-x sm:divide-white/6" aria-live="polite">
        {([["Stage", gauges.stage], ["AI tokens", gauges.tokens.toLocaleString("en-US")],
          [gauges.aiCreditState === "held" ? "AI credit held" : "AI credit settled", `$${gauges.aiCreditUsd.toFixed(2)}`],
          ["Approval", gauges.approval], ["Rollout / health", gauges.outcome]] as const).map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{k}</dt>
            <dd className="mt-1 text-sm text-white">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 grid gap-3 lg:grid-cols-[3fr_2fr]">
        <section id={`${id}-inspector`} aria-label={station.name} className="overflow-hidden rounded-xl border border-white/8 bg-[#07090d]">
          <div className="flex items-center justify-between gap-3 border-b border-white/6 px-5 py-3">
            <h3 className="text-sm font-medium text-white"><span className="font-mono text-zinc-500">{String(selected + 1).padStart(2, "0")}</span> {station.name}</h3>
            <span className="truncate font-mono text-[11px] text-zinc-500">{station.systems}</span>
          </div>
          <div className="grid gap-5 px-5 py-4 text-sm leading-relaxed text-zinc-300 sm:grid-cols-2">
            <div>
              <p className="text-zinc-200">{station.summary}</p>
              <h4 className="mt-4 text-[10px] uppercase tracking-[0.16em] text-zinc-500">What happens inside</h4>
              <ol className="mt-2 list-decimal space-y-1 pl-5">{station.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Data in → out</h4>
                <p className="mt-1.5 font-mono text-xs text-sky-200/90">{station.dataIn.join(", ")} → {station.dataOut.join(", ")}</p>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Guarantee</h4>
                <p className="mt-1.5">{station.guarantee}</p>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">If it fails</h4>
                <p className="mt-1.5">{station.onFailure}</p>
              </div>
            </div>
          </div>
        </section>
        <section aria-label="Audit stream" className="overflow-hidden rounded-xl border border-white/8 bg-[#07090d]">
          <div className="flex items-center justify-between border-b border-white/6 px-5 py-3">
            <h3 className="text-sm font-medium text-white">Audit stream</h3>
            <span className="font-mono text-[11px] text-zinc-500">sample · illustrative ids</span>
          </div>
          <ol role="log" aria-live="polite" className="space-y-1.5 px-5 py-4 font-mono text-xs">
            {log.map((e) => (
              <li key={`${e.at}-${e.event}`} className={LOG_CLASS[e.level]}>{e.at} {e.event} <span className="text-zinc-500">{e.detail}</span></li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
