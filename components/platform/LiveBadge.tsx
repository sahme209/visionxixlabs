/**
 * <LiveBadge/> — small pill that flags a row as real tenant state.
 *
 * Mirrors <DemoBadge/> but green/affirmative — paint this next to any
 * value that came from a Prisma read (not seeded). Together with
 * <DemoBadge/>, every metric on the platform should be self-labelling
 * as live-or-demo at a glance.
 */

interface LiveBadgeProps {
  /** Optional context shown in the tooltip — e.g. "fresh · 12s ago". */
  hint?: string;
}

export function LiveBadge({ hint }: LiveBadgeProps) {
  return (
    <span
      title={hint ?? "Live data — read from your tenant"}
      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-widest text-emerald-300"
    >
      <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
      live
    </span>
  );
}
