/**
 * Honest source tagging — every dataset that crosses Axiom's surface carries
 * a `source` indicating whether it reflects real scans/connectors, demo
 * fixtures, or pre-release preview data.
 *
 * This is the SINGLE source of truth for the tag. All modules importing
 * a `"live" | "preview" | "demo"` union should import from here.
 */

export type DataSource = "live" | "preview" | "demo";

export interface Sourced {
  /** Where this data originated — never silently fake live. */
  source: DataSource;
}

export const SOURCE_LABEL: Record<DataSource, string> = {
  live:    "Live",
  preview: "Preview",
  demo:    "Demo",
};

export const SOURCE_DESCRIPTION: Record<DataSource, string> = {
  live:    "Built from a real, recent connector scan.",
  preview: "Pre-release surface — shape is real, data not yet wired to a live connector.",
  demo:    "Demo fixtures — illustrative only.",
};

/** Returns true when callers should warn the user that values aren't live. */
export function isPreviewOrDemo(source: DataSource): boolean {
  return source !== "live";
}
