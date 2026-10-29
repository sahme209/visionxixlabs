import { useState } from "react";
import type { AgentModelChoice } from "../lib/agentModelSelection";

/** Shared composer control: native select supplies keyboard behavior and groups. */
export function AgentModelSelector({ options, value, onChange, disabled, loading = false, label = "Agent" }: {
  options: readonly AgentModelChoice[];
  value: string;
  onChange: (key: string) => void;
  disabled: boolean;
  loading?: boolean;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filtered = options.filter(option =>
    `${option.label} ${option.modelId} ${option.vendor}`.toLowerCase().includes(needle),
  );
  const selected = options.find(option => option.key === value);
  const vendors = [...new Set(filtered.map(option => option.vendor))];

  return <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
    <input
      type="search"
      aria-label={`Search ${label} models`}
      placeholder="Search models"
      value={query}
      onChange={event => setQuery(event.target.value)}
      disabled={disabled}
      className="w-32 rounded-md border border-white/10 bg-[#151719] px-2 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
    />
    <select
      aria-label={`${label} model`}
      value={loading ? "__checking__" : value}
      onChange={event => {
        const option = options.find(item => item.key === event.target.value);
        if (option && !option.unavailableReason) onChange(option.key);
      }}
      disabled={disabled || !options.length}
      className="w-52 max-w-full rounded-md border border-white/10 bg-[#151719] px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-white/25 disabled:opacity-50"
    >
      {loading ? <option value="__checking__">Checking workspace models…</option> : <>
      {!options.length && <option value="">No model enabled</option>}
      {selected && !filtered.some(option => option.key === selected.key) && <option value={selected.key} hidden disabled={Boolean(selected.unavailableReason)}>{selected.label}{selected.unavailableReason ? " · Unavailable" : ""}</option>}
      {vendors.map(vendor => <optgroup key={vendor} label={vendor}>
        {filtered.filter(option => option.vendor === vendor).map(option =>
          <option key={option.key} value={option.key} disabled={Boolean(option.unavailableReason)}>{option.label}{option.unavailableReason ? " · Unavailable" : ""}</option>,
        )}
      </optgroup>)}
      </>}
    </select>
    {!loading && options.length > 0 && !filtered.length && <span role="status">No approved model matches this search.</span>}
  </div>;
}
