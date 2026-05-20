/**
 * Pure multi-cloud cost normalizer.
 *
 * Each cloud reports cost lines in its own currency + units (AWS in
 * UnblendedCost USD; Azure in PreTaxCost in any currency; GCP cost in
 * USD micros). This module folds the raw lines into a single tenant-
 * wide USD-per-day total + per-provider rollup.
 *
 * Pure / deterministic. Caller supplies FX rates.
 */

export type CloudProvider = "aws" | "azure" | "gcp";

export interface RawCostLine {
  provider: CloudProvider;
  service: string;
  dateKey: string;       // YYYY-MM-DD
  amount: number;
  /** ISO 4217 currency. */
  currency: string;
  /** "usd" | "micros_usd" | "native". */
  unit: "usd" | "micros_usd" | "native";
}

export interface NormalizedLine {
  provider: CloudProvider;
  service: string;
  dateKey: string;
  usd: number;
}

export interface CostReport {
  totalUsd: number;
  perProvider: Array<{ provider: CloudProvider; usd: number }>;
  perDay: Array<{ dateKey: string; usd: number }>;
  perService: Array<{ service: string; usd: number }>;
  /** Lines that couldn't be normalized (e.g. unknown currency). */
  unnormalized: RawCostLine[];
  rows: NormalizedLine[];
}

export interface NormalizerInput {
  lines: readonly RawCostLine[];
  /** ISO 4217 → USD multipliers (e.g. EUR: 1.08). USD itself = 1. */
  fxToUsd: Record<string, number>;
}

const round = (n: number): number => Math.round(n * 100) / 100;

function normalizeOne(line: RawCostLine, fx: Record<string, number>): number | null {
  if (line.unit === "usd") return line.amount;
  if (line.unit === "micros_usd") return line.amount / 1_000_000;
  if (line.unit === "native") {
    const mult = fx[line.currency.toUpperCase()];
    if (typeof mult !== "number") return null;
    return line.amount * mult;
  }
  return null;
}

export function normalizeMultiCloudCost(input: NormalizerInput): CostReport {
  const rows: NormalizedLine[] = [];
  const unnormalized: RawCostLine[] = [];
  const perProvider = new Map<CloudProvider, number>();
  const perDay = new Map<string, number>();
  const perService = new Map<string, number>();
  let totalUsd = 0;

  for (const line of input.lines) {
    const usd = normalizeOne(line, input.fxToUsd);
    if (usd === null || !Number.isFinite(usd)) {
      unnormalized.push(line);
      continue;
    }
    rows.push({ provider: line.provider, service: line.service, dateKey: line.dateKey, usd });
    totalUsd += usd;
    perProvider.set(line.provider, (perProvider.get(line.provider) ?? 0) + usd);
    perDay.set(line.dateKey, (perDay.get(line.dateKey) ?? 0) + usd);
    perService.set(line.service, (perService.get(line.service) ?? 0) + usd);
  }

  return {
    totalUsd: round(totalUsd),
    perProvider: [...perProvider.entries()]
      .map(([provider, usd]) => ({ provider, usd: round(usd) }))
      .sort((a, b) => b.usd - a.usd),
    perDay: [...perDay.entries()]
      .map(([dateKey, usd]) => ({ dateKey, usd: round(usd) }))
      .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1)),
    perService: [...perService.entries()]
      .map(([service, usd]) => ({ service, usd: round(usd) }))
      .sort((a, b) => b.usd - a.usd),
    unnormalized,
    rows,
  };
}
