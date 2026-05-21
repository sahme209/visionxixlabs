/**
 * <DemoBadge/> — small pill that flags a row as seeded demo data.
 *
 * Mandatory next to every row sourced from lib/platform/platformSeedData.
 * Operators must always be able to tell at a glance whether a number
 * is real tenant state or seeded illustration.
 */

export function DemoBadge() {
  return (
    <span
      title="Seeded demo data — not from your tenant"
      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-widest text-amber-300"
    >
      <span className="h-1 w-1 rounded-full bg-amber-400" />
      demo
    </span>
  );
}
