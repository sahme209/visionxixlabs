"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { DocsSidebar } from "./DocsSidebar";

/** A disclosure, not a modal: desktop contents remain persistent. */
export function DocsContents() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);

  function restoreNarrowFocus() {
    if (!window.matchMedia("(min-width: 1024px)").matches && panel.current?.contains(document.activeElement)) button.current?.focus();
  }

  function close() {
    restoreNarrowFocus();
    setOpen(false);
  }

  useEffect(() => {
    // Client navigation retains this layout. Do not leave focus in a panel that
    // is about to collapse, or reopen the full catalog above the next article.
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    restoreNarrowFocus();
    setOpen(false);
  }, [pathname]);

  return (
    <aside onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); } }} className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-4 lg:border-r lg:border-white/[0.04]">
      <button ref={button} type="button" aria-expanded={open} aria-controls="docs-contents-panel"
        onClick={() => setOpen(value => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 lg:hidden">
        Documentation contents
        <ChevronDownIcon aria-hidden="true" className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div ref={panel} id="docs-contents-panel"
        className={`${open ? "block" : "hidden"} mt-4 max-h-[60vh] overflow-y-auto rounded-xl border border-white/[0.06] p-3 lg:mt-0 lg:block lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:p-0`}>
        <div className="mb-6 border-b border-white/[0.04] pb-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-orange-400">Documentation</p>
          <p className="text-sm text-zinc-300">Self-serve guides for the Axiom platform.</p>
        </div>
        <DocsSidebar />
      </div>
    </aside>
  );
}
