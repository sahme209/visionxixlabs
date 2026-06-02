"use client";

/**
 * OpenPaletteChip — Phase 576.
 *
 * The header's ⌘K hint used to be inert text. Now it's a button that
 * opens the command palette via the `axiom:open-palette` CustomEvent
 * the palette listens for. Keyboard shortcut still works the same.
 */

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export function OpenPaletteChip() {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          document.dispatchEvent(new CustomEvent("axiom:open-palette"));
        } catch { /* old browsers — fallback is the ⌘K key shortcut */ }
      }}
      className="hidden md:inline-flex items-center gap-1.5 text-[10.5px] font-mono text-zinc-400 hover:text-white px-2 py-1 rounded-full border border-white/[0.06] hover:border-white/[0.18] hover:bg-white/[0.02] transition-colors"
      aria-label="Open command palette"
    >
      <MagnifyingGlassIcon className="h-3 w-3" />
      <span>jump</span>
      <span className="text-zinc-600 mx-1">·</span>
      <kbd className="border border-white/[0.08] rounded px-1 py-px">⌘K</kbd>
    </button>
  );
}
