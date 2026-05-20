/**
 * Vitest unit tests for the SaaS inventory clusterer.
 */

import { describe, it, expect } from "vitest";
import { clusterSaasInventory, type SaasObservation } from "../saasInventoryClusterer";

const OBS = (appLabel: string, domain: string, seats: number, monthlySpendUSD: number): SaasObservation =>
  ({ appLabel, domain, seats, monthlySpendUSD });

describe("saasInventoryClusterer", () => {
  it("empty input → zero totals", () => {
    const r = clusterSaasInventory([]);
    expect(r.totalObservations).toBe(0);
    expect(r.totalVendors).toBe(0);
    expect(r.clusters.length).toBe(0);
  });

  it("groups by normalized vendor key (slack.com + Slack → one)", () => {
    const r = clusterSaasInventory([
      OBS("Slack", "slack.com", 50, 500),
      OBS("slack", "slack.com", 25, 250),
    ]);
    expect(r.totalVendors).toBe(1);
    expect(r.clusters[0].totalSeats).toBe(75);
    expect(r.clusters[0].totalMonthlySpend).toBe(750);
  });

  it("flags potentialDuplicate when multiple distinct labels merge", () => {
    const r = clusterSaasInventory([
      OBS("Slack", "slack.com", 10, 100),
      OBS("Slack Connect", "slack.com", 5, 50),
    ]);
    expect(r.duplicateGroups.length).toBe(1);
    expect(r.duplicateGroups[0].labels).toEqual(["Slack", "Slack Connect"]);
  });

  it("clusters sorted by monthly spend desc", () => {
    const r = clusterSaasInventory([
      OBS("Notion", "notion.so", 5, 100),
      OBS("Slack", "slack.com", 100, 5000),
      OBS("Linear", "linear.app", 20, 800),
    ]);
    // When the label stem is shorter than the domain stem, label wins as
    // the vendor key (e.g. "linear" beats "linearapp"). Slack's ".com" is
    // stripped so both stems collapse to "slack".
    expect(r.clusters.map((c) => c.vendorKey)).toEqual(["slack", "linear", "notion"]);
  });

  it("clamps negative seats / spend to 0", () => {
    const r = clusterSaasInventory([OBS("Slack", "slack.com", -10, -50)]);
    expect(r.totalSeats).toBe(0);
    expect(r.totalMonthlySpend).toBe(0);
  });

  it("treats empty domain by falling back to label", () => {
    const r = clusterSaasInventory([OBS("CustomApp", "", 3, 30)]);
    expect(r.totalVendors).toBe(1);
    expect(r.clusters[0].labels).toEqual(["CustomApp"]);
  });
});
