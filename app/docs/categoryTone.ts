/**
 * Per-category tone classes for the public docs page. Kept in its
 * own module so the server component stays free of inline ternary
 * spaghetti.
 */

export const CATEGORY_TONE: Record<string, string> = {
  operator:      "bg-violet-500/[0.06] text-violet-300 border-violet-500/30",
  providers:     "bg-white/[0.06] text-zinc-300 border-white/30",
  telemetry:     "bg-cyan-500/[0.06] text-cyan-300 border-cyan-500/30",
  security:      "bg-rose-500/[0.06] text-rose-300 border-rose-500/30",
  cost:          "bg-emerald-500/[0.06] text-emerald-300 border-emerald-500/30",
  containers:    "bg-sky-500/[0.06] text-sky-300 border-sky-500/30",
  autonomy:      "bg-violet-500/[0.06] text-violet-300 border-violet-500/30",
  notifications: "bg-fuchsia-500/[0.06] text-fuchsia-300 border-fuchsia-500/30",
  audit:         "bg-zinc-500/[0.06] text-zinc-300 border-zinc-500/30",
  setup:         "bg-indigo-500/[0.06] text-indigo-300 border-indigo-500/30",
  default:       "bg-white/[0.04] text-zinc-300 border-white/[0.08]",
};
