/** AgentTokenMintForm — Phase 642. */

"use client";

import { KeyIcon } from "@heroicons/react/24/outline";

export function AgentTokenMintForm({ connectorSlug }: { connectorSlug: string }) {
  return (
    <form action="/api/agents/mint-token" method="POST" className="space-y-3">
      <input type="hidden" name="connectorSlug" value={connectorSlug} />
      <div>
        <label htmlFor="agentLabel" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">agent label</label>
        <input
          id="agentLabel"
          name="agentLabel"
          required
          maxLength={120}
          placeholder="e.g. vcenter-scanner-prod-01"
          className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
        />
        <p className="text-[10px] text-zinc-500 mt-1 font-mono">used in audit logs to identify which agent instance is pushing</p>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10.5px] text-zinc-500 font-mono">TTL 365 days · token shown once, save it immediately</p>
        <button
          type="submit"
          className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors inline-flex items-center gap-1.5"
        >
          <KeyIcon className="h-3.5 w-3.5" />
          mint token →
        </button>
      </div>
    </form>
  );
}
