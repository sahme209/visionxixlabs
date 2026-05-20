/**
 * Pure tenant-export size estimator.
 *
 * Before producing a full tenant data export, operators want a
 * rough sense of how big the resulting JSON will be (so they don't
 * accidentally request a 500 MB blob). This estimator multiplies
 * per-slice row counts by typed average byte costs.
 *
 * Pure / deterministic. No DB.
 */

export interface SliceSizes {
  proposals: number;
  busMessages: number;
  rationaleRows: number;
  outboundRecords: number;
  billingPlanIncluded: boolean;
}

/** Empirical averages — refined over time. */
const AVG_BYTES: Record<keyof Omit<SliceSizes, "billingPlanIncluded">, number> = {
  proposals:        1_400,
  busMessages:        600,
  rationaleRows:    1_200,
  outboundRecords:    900,
};

const BILLING_PLAN_BYTES = 2_000;
const WRAPPER_BYTES = 1_500;        // schema header + counts + integrity hash

export interface ExportSizeReport {
  estimatedBytes: number;
  estimatedHumanReadable: string;
  perSlice: Record<keyof Omit<SliceSizes, "billingPlanIncluded">, number>;
  /** Verdict ladder. */
  size: "small" | "medium" | "large" | "very_large";
  warning: string | null;
}

const humanize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const sizeOf = (bytes: number): ExportSizeReport["size"] => {
  if (bytes < 100_000) return "small";              // < 100 KB
  if (bytes < 5_000_000) return "medium";           // < 5 MB
  if (bytes < 50_000_000) return "large";           // < 50 MB
  return "very_large";
};

const warnOf = (size: ExportSizeReport["size"]): string | null => {
  if (size === "very_large") return "Export is very large (>50 MB). Consider narrowing the window or splitting by slice.";
  if (size === "large") return "Export is large (>5 MB). Browser download is fine but email attachments may bounce.";
  return null;
};

export function estimateExportSize(sizes: SliceSizes): ExportSizeReport {
  const perSlice = {
    proposals:        sizes.proposals        * AVG_BYTES.proposals,
    busMessages:      sizes.busMessages      * AVG_BYTES.busMessages,
    rationaleRows:    sizes.rationaleRows    * AVG_BYTES.rationaleRows,
    outboundRecords:  sizes.outboundRecords  * AVG_BYTES.outboundRecords,
  };
  const slicesTotal =
    perSlice.proposals + perSlice.busMessages + perSlice.rationaleRows + perSlice.outboundRecords;
  const estimatedBytes = slicesTotal + WRAPPER_BYTES + (sizes.billingPlanIncluded ? BILLING_PLAN_BYTES : 0);
  const size = sizeOf(estimatedBytes);
  return {
    estimatedBytes,
    estimatedHumanReadable: humanize(estimatedBytes),
    perSlice,
    size,
    warning: warnOf(size),
  };
}
