/**
 * Vitest unit tests for the pure multi-cloud cost normalizer.
 */

import { describe, it, expect } from "vitest";
import { normalizeMultiCloudCost, type RawCostLine } from "../multiCloudCostNormalizer";

const L = (
  provider: RawCostLine["provider"], service: string,
  amount: number, unit: RawCostLine["unit"], currency = "USD",
  dateKey = "2026-05-20",
): RawCostLine => ({ provider, service, dateKey, amount, currency, unit });

describe("multiCloudCostNormalizer", () => {
  it("empty input → zero totals", () => {
    const r = normalizeMultiCloudCost({ lines: [], fxToUsd: {} });
    expect(r.totalUsd).toBe(0);
    expect(r.rows.length).toBe(0);
  });

  it("usd unit kept as-is", () => {
    const r = normalizeMultiCloudCost({
      lines: [L("aws", "s3", 12.34, "usd")],
      fxToUsd: {},
    });
    expect(r.totalUsd).toBe(12.34);
  });

  it("micros_usd divided by 1_000_000", () => {
    const r = normalizeMultiCloudCost({
      lines: [L("gcp", "bigquery", 5_000_000, "micros_usd")],
      fxToUsd: {},
    });
    expect(r.totalUsd).toBe(5);
  });

  it("native currency uses fx map", () => {
    const r = normalizeMultiCloudCost({
      lines: [L("azure", "vm", 100, "native", "EUR")],
      fxToUsd: { EUR: 1.08 },
    });
    expect(r.totalUsd).toBe(108);
  });

  it("missing fx for native → row in unnormalized list", () => {
    const r = normalizeMultiCloudCost({
      lines: [L("azure", "vm", 100, "native", "JPY")],
      fxToUsd: { EUR: 1.08 },
    });
    expect(r.unnormalized.length).toBe(1);
    expect(r.totalUsd).toBe(0);
  });

  it("rollups: perProvider, perDay, perService sorted appropriately", () => {
    const r = normalizeMultiCloudCost({
      lines: [
        L("aws",   "s3",      100, "usd", "USD", "2026-05-20"),
        L("gcp",   "bigquery",  5_000_000, "micros_usd", "USD", "2026-05-20"),
        L("azure", "vm",      50, "usd", "USD", "2026-05-21"),
      ],
      fxToUsd: {},
    });
    expect(r.perProvider[0].provider).toBe("aws");      // largest spend
    expect(r.perDay[0].dateKey).toBe("2026-05-20");     // earliest
    expect(r.perService[0].service).toBe("s3");
  });

  it("rounds to 2 decimal places", () => {
    const r = normalizeMultiCloudCost({
      lines: [L("aws", "s3", 1.2345, "usd")],
      fxToUsd: {},
    });
    expect(r.totalUsd).toBe(1.23);
  });

  it("uppercases currency before fx lookup", () => {
    const r = normalizeMultiCloudCost({
      lines: [L("azure", "vm", 100, "native", "eur")],
      fxToUsd: { EUR: 1.08 },
    });
    expect(r.totalUsd).toBe(108);
  });
});
