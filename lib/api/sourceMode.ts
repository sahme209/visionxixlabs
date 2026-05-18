/**
 * Canonical API sourceMode union.
 *
 * Every typed read-only report on the platform tags its data with a
 * closed sourceMode literal so the UI can render an honest pill (live /
 * preview / blocked / etc.) without inventing a state.
 *
 * Different sub-systems historically named their unions differently
 * (`AxiomOSSourceMode`, `PrioritySourceMode`, `EvidenceSourceMode`,
 * etc.). This module is the *canonical superset*: anything that ends
 * up at the API boundary downcasts into this.
 *
 * Why a superset rather than a strict union: the safety we want is
 * "every pill the UI renders is in this set". A new sub-system that
 * adds, say, `"partial_live"` should be representable here without a
 * codegen step.
 */

export type ApiSourceMode =
  | "live"           // Real connector / canonical state, confidently sourced
  | "partial_live"   // Some real signals, some synthetic
  | "preview"        // Shape real, data not wired to a live source yet
  | "foundation"     // Foundational scaffolding (no per-tenant data)
  | "expanding"      // Live but actively growing coverage
  | "planned"        // Roadmap — no implementation yet
  | "blocked"        // Implementation blocked on external dependency
  | "disabled"       // Switched off (env flag / policy)
  | "unknown";       // Honest "we don't know yet"

export const SOURCE_MODE_LABEL: Record<ApiSourceMode, string> = {
  live:         "Live",
  partial_live: "Partial live",
  preview:      "Preview",
  foundation:   "Foundation",
  expanding:    "Expanding",
  planned:      "Planned",
  blocked:      "Blocked",
  disabled:     "Disabled",
  unknown:      "Unknown",
};

export const SOURCE_MODE_TONE: Record<ApiSourceMode, "emerald" | "cyan" | "amber" | "violet" | "rose" | "zinc"> = {
  live:         "emerald",
  partial_live: "cyan",
  preview:      "amber",
  foundation:   "violet",
  expanding:    "cyan",
  planned:      "zinc",
  blocked:      "rose",
  disabled:     "rose",
  unknown:      "zinc",
};

/**
 * Cast a string from a sub-system into the canonical API sourceMode.
 * Unknown values fall back to `"unknown"` rather than throwing — that
 * way an envelope can still ship to the client honestly.
 */
export function asApiSourceMode(value: string | undefined | null): ApiSourceMode {
  switch (value) {
    case "live":
    case "partial_live":
    case "preview":
    case "foundation":
    case "expanding":
    case "planned":
    case "blocked":
    case "disabled":
    case "unknown":
      return value;
    default:
      return "unknown";
  }
}

/**
 * Conservative rollup of multiple sub-system source modes. The
 * weakest mode wins so the operator never sees a "live" pill on a
 * report that includes a "preview" sub-component.
 */
export function rollupApiSourceMode(modes: ApiSourceMode[]): ApiSourceMode {
  if (modes.length === 0) return "unknown";
  const order: ApiSourceMode[] = [
    "unknown", "disabled", "blocked", "planned",
    "foundation", "preview", "expanding", "partial_live", "live",
  ];
  let lowest = order.length;
  for (const m of modes) {
    const idx = order.indexOf(m);
    if (idx >= 0 && idx < lowest) lowest = idx;
  }
  return order[lowest] ?? "unknown";
}
