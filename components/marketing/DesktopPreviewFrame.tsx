"use client";

import type { ReactNode } from "react";
import { CUSTOMER_NAVIGATION } from "@/desktop/src/lib/customerNavigation";

type PreviewView = "agent" | "repository-workspace" | "deployment-requests";

/** Real customer navigation, with an explicitly illustrated content area.
 * No desktop client, credential, provider, or operational API is instantiated. */
export function DesktopPreviewFrame({ view, children }: { view: PreviewView; children: ReactNode }) {
  const title = CUSTOMER_NAVIGATION.map(group => group.items.find(item => item.id === view)?.label).find(Boolean);
  return <div className="desktop-demo-frame min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#111214]">
    <div className="flex h-10 items-center gap-3 border-b border-white/[0.07] px-4 text-[11px] text-zinc-400">
      <span className="flex gap-1.5" aria-hidden="true">{[1, 2, 3].map(dot => <span key={dot} className="h-2 w-2 rounded-full bg-zinc-600" />)}</span>
      <span className="flex-1 text-center">Axiom Agent · {title}</span>
      <span className="text-[9px] uppercase tracking-widest text-zinc-400">Scripted preview</span>
    </div>
    <div className="grid min-w-0 xl:grid-cols-[176px_minmax(0,1fr)]">
      <aside className="hidden border-r border-white/[0.07] bg-[#151719] px-3 py-5 xl:block" aria-label="Navigation illustrated from the desktop application">
        <p className="px-2 text-xs font-medium text-zinc-100">Axiom Agent</p>
        <div className="mt-6 space-y-6">{CUSTOMER_NAVIGATION.map(group => <div key={group.kind}>
          <p className="px-2 text-[10px] text-zinc-400">{group.label}</p>
          <ul className="mt-2 space-y-1">{group.items.map(item => <li key={item.id} className={`flex items-center gap-2 border-l-2 px-2 py-2 text-[11px] ${item.id === view ? "border-zinc-100 text-zinc-100" : "border-transparent text-zinc-400"}`}>
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-xs border border-current" /><span>{item.label}</span>
          </li>)}</ul>
        </div>)}</div>
        <p className="mt-8 border-t border-white/[0.07] px-2 pt-3 text-[10px] leading-5 text-zinc-400">Illustrated navigation.<br />No connected account.</p>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  </div>;
}
