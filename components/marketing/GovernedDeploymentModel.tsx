"use client";

import { useId, useState } from "react";
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

const STATE_TEXT: Record<FlowStationState, string> = {
  passed: "Passed", current: "In progress", pending: "Waiting", blocked: "Blocked", warning: "Needs attention", unreached: "Not reached",
};
const STATE_CLASS: Record<FlowStationState, string> = {
  passed: "border-emerald-300/50 text-emerald-200", current: "border-white text-white", pending: "border-sky-300/40 text-sky-200",
  blocked: "border-rose-400/60 text-rose-200", warning: "border-amber-300/60 text-amber-200", unreached: "border-zinc-700 text-zinc-400",
};
const LOG_CLASS = { ok: "text-emerald-200", blocked: "text-rose-200", warning: "text-amber-200" } as const;

/** Homepage governed-deployment model (visual language v4). Illustrative; never a live deployment. */
export function GovernedDeploymentModel() {
  const id = useId();
  const [scenarioId, setScenarioId] = useState<FlowScenarioId>("approved");
  const scenario = flowScenario(scenarioId);
  const [selected, setSelected] = useState(3);
  const choose = (index: number) => setSelected(index);

  const shown = scenario.stop;
  const gauges = flowGauges(scenario, shown);
  const log = flowAuditLog(scenario, shown);
  const station = FLOW_STATIONS[selected];

  const stateDot: Record<FlowStationState, string> = {
    passed: "bg-emerald-300", current: "bg-white", pending: "bg-sky-300/70", blocked: "bg-rose-400", warning: "bg-amber-300", unreached: "bg-zinc-700",
  };

  return (
    <section aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 lg:px-10" style={{ scrollMarginTop: 96 }}>
      <div className="mx-auto max-w-4xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sky-300/80">Illustrative model · not a live deployment</p>
        <h2 id={`${id}-title`} className="mt-4 text-3xl font-medium tracking-[-0.04em] text-white sm:text-[44px] sm:leading-[1.1]">How a governed deployment moves through V19</h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
          One release, from request to recorded outcome, including the paths where a check fails, a reviewer says no or the result is unknown.
        </p>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-white/8 bg-[#0a0908]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-4 sm:px-5">
          <div role="group" aria-label="Scenario" className="flex flex-wrap gap-2">
            {FLOW_SCENARIOS.map((s) => (
              <button key={s.id} type="button" aria-pressed={s.id === scenarioId} onClick={() => setScenarioId(s.id)}
                className={`min-h-11 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors sm:text-sm ${s.id === scenarioId ? "bg-white text-zinc-950" : "text-zinc-300 hover:text-white"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <ol aria-label="Stages in this scenario" className="grid grid-cols-1 gap-3 px-4 py-8 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
              {FLOW_STATIONS.map((s, i) => {
                const state = flowStationState(scenario, i, shown);
                return (
                  <li key={s.id} className={`rounded-xl border bg-white/2 px-4 py-3 text-sm ${STATE_CLASS[state]}`}>
                    <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span> {s.name}
                    <span className="mt-0.5 block text-xs">{STATE_TEXT[state]}</span>
                  </li>
                );
              })}
            </ol>
        </div>

        <div className="space-y-4 border-t border-white/8 px-4 py-4 sm:px-5">
          <p className="text-sm leading-6 text-zinc-200">{scenario.caption}</p>
          <div role="group" aria-label="Inspect a stage" className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/2 p-1 sm:grid-cols-4 lg:grid-cols-8">
            {FLOW_STATIONS.map((s, i) => {
              const state = flowStationState(scenario, i, shown);
              return (
                <button key={s.id} type="button" aria-pressed={i === selected} aria-controls={`${id}-inspector`} onClick={() => choose(i)}
                  className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${i === selected ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`}>
                  <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${stateDot[state]}`} />
                  <span className="min-w-0 wrap-break-word"><span className="font-mono text-zinc-400">{String(i + 1).padStart(2, "0")}</span> {s.name}</span>
                  <span className="sr-only">, {STATE_TEXT[state]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p id={`${id}-gauge-label`} className="mt-5 text-xs leading-6 text-zinc-400">Illustrative scenario values · sample AI usage, credits and status · not your workspace activity</p>
      <dl aria-describedby={`${id}-gauge-label`} className="mt-2 grid grid-cols-2 overflow-hidden rounded-xl border border-white/8 bg-white/2 font-mono sm:grid-cols-5 sm:divide-x sm:divide-white/6" aria-live="polite">
        {([["Stage", gauges.stage], ["AI tokens", gauges.tokens.toLocaleString("en-US")],
          [gauges.aiCreditState === "held" ? "AI credit held" : "AI credit settled", `$${gauges.aiCreditUsd.toFixed(2)}`],
          ["Approval", gauges.approval], ["Rollout / health", gauges.outcome]] as const).map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">{k}</dt>
            <dd className="mt-1 text-sm text-white">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 grid gap-3 lg:grid-cols-[3fr_2fr]">
        <section id={`${id}-inspector`} aria-label={station.name} className="overflow-hidden rounded-xl border border-white/8 bg-[#0a0908]">
          <div className="flex items-center justify-between gap-3 border-b border-white/6 px-5 py-3">
            <h3 className="text-sm font-medium text-white"><span className="font-mono text-zinc-400">{String(selected + 1).padStart(2, "0")}</span> {station.name}</h3>
            <span className="truncate font-mono text-[11px] text-zinc-400">{station.systems}</span>
          </div>
          <div className="grid gap-5 px-5 py-4 text-sm leading-relaxed text-zinc-300 sm:grid-cols-2">
            <div>
              <p className="text-zinc-200">{station.summary}</p>
              <h4 className="mt-4 text-[10px] uppercase tracking-[0.16em] text-zinc-400">What happens inside</h4>
              <ol className="mt-2 list-decimal space-y-1 pl-5">{station.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Data in → out</h4>
                <p className="mt-1.5 font-mono text-xs text-sky-200/90">{station.dataIn.join(", ")} → {station.dataOut.join(", ")}</p>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">Guarantee</h4>
                <p className="mt-1.5">{station.guarantee}</p>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">If it fails</h4>
                <p className="mt-1.5">{station.onFailure}</p>
              </div>
            </div>
          </div>
        </section>
        <section aria-label="Audit stream" className="overflow-hidden rounded-xl border border-white/8 bg-[#0a0908]">
          <div className="flex items-center justify-between border-b border-white/6 px-5 py-3">
            <h3 className="text-sm font-medium text-white">Audit stream</h3>
            <span className="font-mono text-[11px] text-zinc-400">sample · illustrative ids</span>
          </div>
          <div role="log" aria-label="Sample audit entries">
            <ol className="space-y-1.5 px-5 py-4 font-mono text-xs">
              {log.map((entry) => (
                <li key={`${entry.at}-${entry.event}`} className={LOG_CLASS[entry.level]}>{entry.at} {entry.event} <span className="text-zinc-400">{entry.detail}</span></li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </section>
  );
}
