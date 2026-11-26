"use client";
import { useId, useMemo, useState } from "react";
import { compareResolved } from "@/lib/releaseops/scopedVariableCompare";

/** Interactive, synthetic example of comparing two environments' configuration before promoting. No requests are made. */
const ENVIRONMENTS = [
  { id: "dev", name: "Development", vars: { API_BASE_URL: "https://api.dev.example.invalid", LOG_LEVEL: "debug", REPLICAS: "1", FEATURE_NEW_CHECKOUT: "on" } },
  { id: "staging", name: "Staging", vars: { API_BASE_URL: "https://api.staging.example.invalid", LOG_LEVEL: "info", REPLICAS: "2", FEATURE_NEW_CHECKOUT: "on", CACHE_TTL_SECONDS: "300" } },
  { id: "prod", name: "Production", vars: { API_BASE_URL: "https://api.example.invalid", LOG_LEVEL: "warn", REPLICAS: "6", FEATURE_NEW_CHECKOUT: "off" } },
] as const;
const entries = (id: string) => Object.entries(ENVIRONMENTS.find((e) => e.id === id)!.vars).map(([key, value]) => ({ key, value }));
const nameOf = (id: string) => ENVIRONMENTS.find((e) => e.id === id)!.name;

export function ConfigPromotionDemo() {
  const id = useId();
  const [from, setFrom] = useState("staging");
  const [to, setTo] = useState("prod");
  const diff = useMemo(() => compareResolved(entries(from), entries(to)), [from, to]);
  const picker = (label: string, value: string, set: (v: string) => void) => (
    <label className="text-xs text-zinc-400">{label}
      <select value={value} onChange={(e) => set(e.target.value)} className="mt-1 block w-44 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100">
        {ENVIRONMENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
    </label>);
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-[#111111] p-5" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="text-sm font-medium text-zinc-100">Try it: compare before promoting</p>
      <p className="mt-1 text-xs leading-5 text-zinc-400">Synthetic example. Pick two environments to see what configuration a release would meet when it moves.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">{picker("From", from, setFrom)}<span aria-hidden="true" className="pb-2 text-zinc-500">→</span>{picker("To", to, setTo)}</div>
      <div aria-live="polite" className="mt-4 min-h-24 text-sm">
        {from === to ? <p className="text-zinc-400">Choose two different environments.</p> : (
          <ul className="space-y-1.5 font-mono text-xs text-zinc-200">
            {diff.changed.map((c) => <li key={c.key}><span className="text-zinc-400">changes</span> {c.key}: {JSON.stringify(c.from)} → {JSON.stringify(c.to)}</li>)}
            {diff.onlyInTo.map((k) => <li key={k}><span className="text-zinc-400">only in {nameOf(to)}</span> {k}</li>)}
            {diff.onlyInFrom.map((k) => <li key={k} className="text-amber-200"><span className="text-amber-300/80">missing in {nameOf(to)}</span> {k}</li>)}
            {diff.same > 0 && <li className="font-sans text-zinc-400">{diff.same} unchanged</li>}
          </ul>)}
      </div>
    </div>);
}
