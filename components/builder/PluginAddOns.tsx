"use client";

import { useState } from "react";
import { PuzzlePieceIcon } from "@heroicons/react/24/outline";

export type PluginInfo = {
  id: string;
  name: string;
  description: string;
  billingImpactCents: number;
};

export function PluginAddOns({
  plugins = [],
  selectedPluginIds = [],
  onChange,
}: {
  plugins?: PluginInfo[];
  selectedPluginIds?: string[];
  onChange?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedPluginIds));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    onChange?.(Array.from(next));
  };

  if (plugins.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <PuzzlePieceIcon className="h-4 w-4" />
        Add-on Plugins
      </h3>
      <div className="flex flex-wrap gap-2">
        {plugins.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-600/50 px-3 py-2 transition hover:bg-zinc-800/50"
          >
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              className="rounded"
            />
            <span className="text-sm text-zinc-200">{p.name}</span>
            {p.billingImpactCents > 0 && (
              <span className="text-xs text-zinc-500">
                +${(p.billingImpactCents / 100).toFixed(2)}/mo
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
